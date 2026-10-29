/**
 * 故障注入夹具（仅供测试使用）。
 *
 * 铁律：所有写入都必须落在 `mkdtempSync` 造出的临时目录里，且目录名带固定前缀。
 * `assertFixturePath` 会在每次造故障前校验路径中确实含该前缀，因此这里**不可能**
 * 写到使用者的真实偏好（`~/.pi/agent/lesson3-context-panel/`）、认证或配置目录，
 * 也不会改动任何目录权限。
 *
 * 本模块不参与真实运行：`extensions/context-panel-store.ts` 不引用它。
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

/** 临时夹具目录前缀；同时充当「只许写这里」的白名单标记。 */
export const FIXTURE_PREFIX = "pi-context-panel-fixture-";

const REAL_AGENT_DIR = path.resolve(path.join(homedir(), ".pi", "agent"));

export interface FixtureRoot {
  /** 本次用例独占的临时根目录（已在系统临时目录内）。 */
  readonly dir: string;
  /** 删除整个临时根目录。 */
  cleanup(): void;
}

function isInside(parent: string, child: string): boolean {
  const resolved = path.resolve(child);
  return resolved === parent || resolved.startsWith(`${parent}${path.sep}`);
}

/** 最后一道闸：不是夹具目录里的路径，一律拒绝写入。 */
export function assertFixturePath(target: string): string {
  const resolved = path.resolve(target);
  if (!resolved.split(path.sep).some((segment) => segment.startsWith(FIXTURE_PREFIX))) {
    throw new Error(`拒绝对非夹具路径写入：${resolved}（夹具目录名前缀必须是 ${FIXTURE_PREFIX}）`);
  }
  const tmp = path.resolve(tmpdir());
  if (!isInside(tmp, resolved) && !isInside(path.join("/private", tmp), resolved)) {
    throw new Error(`拒绝对系统临时目录之外的路径写入：${resolved}`);
  }
  if (isInside(REAL_AGENT_DIR, resolved)) {
    throw new Error(`拒绝对真实 Pi 用户配置目录写入：${resolved}`);
  }
  return resolved;
}

/** 建一个独占的临时夹具根目录。 */
export function createFixtureRoot(label: string): FixtureRoot {
  const dir = assertFixturePath(mkdtempSync(path.join(tmpdir(), `${FIXTURE_PREFIX}${label}-`)));
  return {
    dir,
    cleanup() {
      // 有的用例会把夹具目录降权（模拟不可写），删除前先恢复自己的权限。
      try {
        chmodSync(dir, 0o700);
      } catch {
        // 恢复失败不影响下面的强制删除尝试。
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** 注入故障⑤：把夹具目录降为只读（仅作用于临时夹具，用完由 restoreDirectory 还原）。 */
export function makeDirectoryReadOnly(dir: string): void {
  chmodSync(assertFixturePath(dir), 0o500);
}

/** 还原夹具目录权限（默认 0o700），使清理与后续断言仍可进行。 */
export function restoreDirectory(dir: string): void {
  chmodSync(assertFixturePath(dir), 0o700);
}

/** 夹具内的记录文件路径（与 `resolveStatePath` 的目录约定一致）。 */
export function recordPathIn(root: FixtureRoot): string {
  return assertFixturePath(path.join(root.dir, "lesson3-context-panel", "state.json"));
}

/** 夹具内的锁文件路径（与 store 的实现约定一致）。 */
export function lockPathFor(statePath: string): string {
  return assertFixturePath(path.join(path.dirname(statePath), "state.lock"));
}

/** 注入故障①：写一条损坏记录（内容可以是任意非法文本）。 */
export function writeCorruptRecord(statePath: string, text: string): void {
  const target = assertFixturePath(statePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
}

/** 写一条合法记录，用于「已存在旧偏好」的场景。 */
export function writeValidRecord(statePath: string, enabled: boolean, version = 1): void {
  const target = assertFixturePath(statePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify({ version, enabled }, null, 2)}\n`);
}

/** 注入故障②：用一个普通文件占住路径中间一段，使存储位置无法写入。 */
export function blockPathComponent(root: FixtureRoot, name = "blocker"): string {
  const blocker = assertFixturePath(path.join(root.dir, name));
  writeFileSync(blocker, "我不是目录\n");
  return path.join(blocker, "nested", "state.json");
}

/** 注入故障③：让记录文件路径本身是一个目录，使原子替换的 rename 失败。 */
export function makeRecordPathDirectory(statePath: string): void {
  mkdirSync(assertFixturePath(statePath), { recursive: true });
}

/**
 * 注入故障④：预先占住锁文件，模拟另一个进程正在提交。
 * `ageMs` 用于伪造持锁时长（配合陈旧锁接管逻辑）。
 */
export function placeLock(statePath: string, options: { ageMs?: number; pid?: number } = {}): string {
  const lockPath = lockPathFor(statePath);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const now = Date.now();
  writeFileSync(lockPath, `${JSON.stringify({ pid: options.pid ?? 999_999, time: now - (options.ageMs ?? 0) })}\n`);
  if (options.ageMs) {
    const when = new Date(now - options.ageMs);
    utimesSync(lockPath, when, when);
  }
  return lockPath;
}
