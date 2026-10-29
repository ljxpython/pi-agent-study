/**
 * 底栏显示偏好的跨进程持久化（Pi 0.85.1）。
 *
 * 只依赖 Node 内置模块（`node:fs` / `node:path`），不导入 Pi 运行时，
 * 因此可以脱离 Pi 直接跑测试。**未引入任何第三方库，不产生新的运行依赖。**
 *
 * 冻结口径：
 * - 记录文件：`<agentDir>/lesson3-context-panel/state.json`，内容 `{ version: 1, enabled: boolean }`。
 * - 首次无记录 → 默认开启（`DEFAULT_ENABLED`）。
 * - 「读取最新值 → 计算新值 → 提交」整段在**跨进程文件锁**内完成，不是只护住最后一步写文件。
 * - 写入用同目录临时文件 + `fsync` + `rename` 原子替换；读者只会看到完整的旧记录或完整的新记录。
 * - 记录损坏或字段不合法 → 读取按临时开启处理，且**拒绝提交**（不静默覆盖原文件）。
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";

/** 记录格式版本。读到其他版本的记录按损坏处理，不猜测兼容性。 */
export const STATE_FORMAT_VERSION = 1;
/** `getAgentDir()` 下的子目录名（本练习专用，不与其他扩展或 Pi 自身配置混放）。 */
export const STATE_DIR_NAME = "lesson3-context-panel";
export const STATE_FILE_NAME = "state.json";
export const LOCK_FILE_NAME = "state.lock";

/** 首次无记录时的默认值：开启。 */
export const DEFAULT_ENABLED = true;

/** 获取锁的等待上限：2 秒。超过即放弃本次保存，明确反馈而不是无限等。 */
export const LOCK_WAIT_MS = 2_000;
/** 两次尝试之间的间隔。 */
export const LOCK_RETRY_MS = 40;
/** 锁文件 mtime 超过该时长视为陈旧（持锁进程已崩溃），可被接管，避免永久死锁。 */
export const LOCK_STALE_MS = 10_000;
/** 单次提交最多接管几次陈旧锁，防止两个进程反复互抢。 */
export const MAX_LOCK_STEALS = 3;
/** 提示文案里的原因最长保留字符数，避免把整段栈信息塞进通知。 */
const MAX_REASON_LENGTH = 160;

/** 读取结果：正常 / 首次无记录 / 损坏（不可用）。 */
export type StateReadResult =
  | { kind: "ok"; enabled: boolean }
  | { kind: "missing" }
  | { kind: "corrupt"; reason: string };

/** 提交结果：成功 / 因损坏被拒 / 等待锁超时 / 写入失败。后三者都意味着**未保存**。 */
export type CommitResult =
  | { kind: "ok"; enabled: boolean }
  | { kind: "corrupt"; reason: string }
  | { kind: "lock-timeout"; waitedMs: number }
  | { kind: "write-failed"; reason: string };

export interface PanelStateStore {
  /** 记录文件绝对路径；只用于提示里的恢复指引。 */
  readonly statePath: string;
  /** 只读一次当前记录。不做加锁：原子替换保证读到的是完整记录。 */
  read(): StateReadResult;
  /**
   * 在跨进程锁内完成「读取最新值 → 计算新值 → 提交」。
   * 传函数表示相对当前共享值计算（toggle 用它，**以共享记录为起点，不以本窗口缓存为起点**）。
   */
  commit(next: boolean | ((current: boolean) => boolean)): Promise<CommitResult>;
}

export interface PanelStateStoreOptions {
  statePath: string;
  /** 以下三个参数仅供测试缩短等待；生产使用上面导出的默认值。 */
  lockWaitMs?: number;
  lockRetryMs?: number;
  lockStaleMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** `getAgentDir()` → 本练习的记录文件绝对路径。 */
export function resolveStatePath(agentDir: string): string {
  return path.join(agentDir, STATE_DIR_NAME, STATE_FILE_NAME);
}

function describeValue(value: unknown): string {
  return value === undefined ? "缺失" : JSON.stringify(value);
}

function clip(text: string): string {
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH)}…` : text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return clip(error.message);
  }
  return clip(String(error));
}

/**
 * 解析记录文本。纯函数，不接触文件系统。
 * `version` 不是 `STATE_FORMAT_VERSION`、`enabled` 不是布尔值、顶层不是对象、内容不是 JSON —— 一律算损坏。
 * 多余字段忽略（不参与校验，也不影响结果）。
 */
export function parseStateRecord(text: string): StateReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "corrupt", reason: "内容不是合法 JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "corrupt", reason: "顶层不是 JSON 对象" };
  }
  const record = parsed as Record<string, unknown>;
  if (record.version !== STATE_FORMAT_VERSION) {
    return { kind: "corrupt", reason: `格式版本不受支持（version=${describeValue(record.version)}）` };
  }
  if (typeof record.enabled !== "boolean") {
    return { kind: "corrupt", reason: `enabled 不是布尔值（${describeValue(record.enabled)}）` };
  }
  return { kind: "ok", enabled: record.enabled };
}

/** 序列化记录。固定键顺序与缩进，便于人工检查与 diff。 */
export function serializeStateRecord(enabled: boolean): string {
  return `${JSON.stringify({ version: STATE_FORMAT_VERSION, enabled }, null, 2)}\n`;
}

let tempCounter = 0;

/**
 * 同目录临时文件 + fsync + rename 原子替换。
 * 同目录保证 rename 不跨设备（跨设备 rename 会退化成复制，失去原子性）。
 */
function writeStateAtomic(statePath: string, enabled: boolean): void {
  const dir = path.dirname(statePath);
  const tempPath = path.join(dir, `.${STATE_FILE_NAME}.${process.pid}.${tempCounter++}.tmp`);
  const text = serializeStateRecord(enabled);
  const fd = openSync(tempPath, "wx");
  try {
    writeSync(fd, text);
    // 先把内容真正落盘，再替换。这样崩溃后读者看到的仍是完整记录，而不是空文件。
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tempPath, statePath);
  } catch (error) {
    // 替换失败不能把临时文件留在目录里。
    rmSync(tempPath, { force: true });
    throw error;
  }
}

type LockAttempt = { kind: "acquired" } | { kind: "timeout"; waitedMs: number } | { kind: "failed"; reason: string };

function tryCreateLock(lockPath: string): void {
  // `wx` = 仅在不存在时创建，POSIX 下是原子的跨进程互斥原语。
  writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, time: Date.now() })}\n`, { flag: "wx" });
}

function lockMtimeMs(lockPath: string): number | undefined {
  try {
    return statSync(lockPath).mtimeMs;
  } catch {
    return undefined;
  }
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (typeof code === "string") return code;
  }
  return describeError(error);
}

export function createPanelStateStore(options: PanelStateStoreOptions): PanelStateStore {
  const statePath = options.statePath;
  const lockPath = path.join(path.dirname(statePath), LOCK_FILE_NAME);
  const lockWaitMs = options.lockWaitMs ?? LOCK_WAIT_MS;
  const lockRetryMs = options.lockRetryMs ?? LOCK_RETRY_MS;
  const lockStaleMs = options.lockStaleMs ?? LOCK_STALE_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  function read(): StateReadResult {
    let text: string;
    try {
      text = readFileSync(statePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // 文件不存在（含路径中某一段不是目录）都按「首次无记录」处理：默认开启。
      if (code === "ENOENT" || code === "ENOTDIR") return { kind: "missing" };
      return { kind: "corrupt", reason: describeError(error) };
    }
    return parseStateRecord(text);
  }

  async function acquireLock(): Promise<LockAttempt> {
    const startedAt = Date.now();
    let steals = 0;
    for (;;) {
      try {
        tryCreateLock(lockPath);
        return { kind: "acquired" };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // 目录建不出来（例如该位置被一个普通文件占住）：连锁都放不下，直接判写入失败。
        if (code !== "EEXIST") return { kind: "failed", reason: describeFailure(error) };

        const mtimeMs = lockMtimeMs(lockPath);
        const now = Date.now();
        if (mtimeMs !== undefined && now - mtimeMs > lockStaleMs && steals < MAX_LOCK_STEALS) {
          steals += 1;
          rmSync(lockPath, { force: true });
          continue;
        }
        if (now - startedAt >= lockWaitMs) {
          return { kind: "timeout", waitedMs: now - startedAt };
        }
        await sleep(lockRetryMs);
      }
    }
  }

  async function commit(next: boolean | ((current: boolean) => boolean)): Promise<CommitResult> {
    try {
      mkdirSync(path.dirname(statePath), { recursive: true });
    } catch (error) {
      return { kind: "write-failed", reason: describeFailure(error) };
    }

    const lock = await acquireLock();
    if (lock.kind === "timeout") return { kind: "lock-timeout", waitedMs: lock.waitedMs };
    if (lock.kind === "failed") return { kind: "write-failed", reason: lock.reason };

    try {
      // 锁内重读：以共享记录为起点，而不是本窗口的旧缓存。
      const current = read();
      if (current.kind === "corrupt") {
        // 不静默覆盖：损坏记录必须先由使用者修复或移走。
        return { kind: "corrupt", reason: current.reason };
      }
      const base = current.kind === "missing" ? DEFAULT_ENABLED : current.enabled;
      const value = typeof next === "function" ? next(base) : next;
      writeStateAtomic(statePath, value);
      return { kind: "ok", enabled: value };
    } catch (error) {
      return { kind: "write-failed", reason: describeError(error) };
    } finally {
      // 无论成功、失败还是抛错都在这里释放；正常路径下锁文件不会残留。
      rmSync(lockPath, { force: true });
    }
  }

  return { statePath, read, commit };
}

/** 记录文件是否已存在（诊断用；不影响读写语义）。 */
export function stateFileExists(statePath: string): boolean {
  return existsSync(statePath);
}

/** 泄露给测试的小工具：确认锁文件已释放。 */
export function lockFileExists(statePath: string): boolean {
  return existsSync(path.join(path.dirname(statePath), LOCK_FILE_NAME));
}

/** 仅供测试：清掉可能残留的锁文件，避免一个失败的用例影响后续。 */
export function clearLockFile(statePath: string): void {
  try {
    unlinkSync(path.join(path.dirname(statePath), LOCK_FILE_NAME));
  } catch {
    // 不存在就好，正是我们想要的状态。
  }
}
