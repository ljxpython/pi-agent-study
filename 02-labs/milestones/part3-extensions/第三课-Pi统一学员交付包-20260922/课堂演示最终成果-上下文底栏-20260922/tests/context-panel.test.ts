/**
 * 针对性测试：数值与取整、未知态、超范围、宽度边界（用真实 pi-tui 宽度工具）、
 * 命令参数语义、偏好提交与失败反馈、加载边界与生命周期、组件行为。
 *
 * 说明：宽度断言使用 `@earendil-works/pi-tui` 的实际 `visibleWidth` / `truncateToWidth`
 * （由 scripts/check.mjs 通过 PI_TUI_ENTRY 注入路径），不是本地复刻的近似实现。
 * 偏好存储在本文件里用**内存假存储**驱动，只证明核心的分支与顺序；
 * 真实文件、锁与故障注入在 tests/context-panel-store.test.ts 里用真实文件系统验证。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { ContextUsage } from "@earendil-works/pi-coding-agent";

import {
  BAR_CELLS,
  BAR_EMPTY,
  BAR_FILLED,
  CONTEXT_PANEL_COMMAND,
  CONTEXT_PANEL_DESCRIPTION,
  CONTEXT_PANEL_USAGE,
  PENDING_LINE,
  composePanelLine,
  corruptNotice,
  createContextPanelExtension,
  formatPercent,
  planSegments,
  resolvePanelState,
  toBarCells,
  toLevel,
  type PanelColor,
  type PanelComponent,
  type PanelContext,
  type PanelFooterFactory,
  type PanelHostApi,
  type PanelMeasure,
  type PanelTheme,
} from "../extensions/context-panel-core.ts";
import {
  DEFAULT_ENABLED,
  type CommitResult,
  type PanelStateStore,
  type StateReadResult,
} from "../extensions/context-panel-store.ts";

const piTuiEntry = process.env.PI_TUI_ENTRY;
if (!piTuiEntry) {
  throw new Error("PI_TUI_ENTRY 未设置：请用 `npm run check` / `npm test`（scripts/check.mjs 会注入 pi-tui 实际路径）");
}
const measure: PanelMeasure = await import(pathToFileURL(piTuiEntry).href);

/** 不着色的主题：宽度断言必须基于真实可见宽度。 */
const plainTheme: PanelTheme = { fg: (_color, text) => text };
/** 带标记的主题：用于断言语义色确实被使用。 */
const tagTheme: PanelTheme = { fg: (color, text) => `<${color}>${text}</${color}>` };

function contextUsage(percent: number | null): ContextUsage {
  return { tokens: percent === null ? null : 1_234, contextWindow: 200_000, percent };
}

/**
 * 内存假存储：模拟共享记录与提交结果，不接触文件系统。
 * `disk` 可被 externalWrite 改动，用来模拟「另一个窗口改了偏好」。
 */
class FakeStore implements PanelStateStore {
  readonly statePath = "/fake/lesson3-context-panel/state.json";
  commits: Array<boolean | ((current: boolean) => boolean)> = [];
  resolved: boolean[] = [];
  reads = 0;
  outcome: "ok" | "lock-timeout" | "write-failed" = "ok";
  disk: "missing" | { enabled: boolean } | { corrupt: string };

  constructor(initial: "missing" | boolean | { corrupt: string } = "missing") {
    this.disk = initial === "missing" ? "missing" : typeof initial === "boolean" ? { enabled: initial } : initial;
  }

  read(): StateReadResult {
    this.reads += 1;
    const disk = this.disk;
    if (disk === "missing") return { kind: "missing" };
    if ("corrupt" in disk) return { kind: "corrupt", reason: disk.corrupt };
    return { kind: "ok", enabled: disk.enabled };
  }

  async commit(next: boolean | ((current: boolean) => boolean)): Promise<CommitResult> {
    this.commits.push(next);
    if (this.outcome === "lock-timeout") return { kind: "lock-timeout", waitedMs: 2_000 };
    if (this.outcome === "write-failed") return { kind: "write-failed", reason: "EACCES: permission denied" };
    const disk = this.disk;
    if (disk !== "missing" && "corrupt" in disk) return { kind: "corrupt", reason: disk.corrupt };
    const base = disk === "missing" ? DEFAULT_ENABLED : disk.enabled;
    const value = typeof next === "function" ? next(base) : next;
    this.disk = { enabled: value };
    this.resolved.push(value);
    return { kind: "ok", enabled: value };
  }

  /** 模拟另一个窗口提交了新偏好。 */
  externalWrite(enabled: boolean): void {
    this.disk = { enabled };
  }

  get saved(): boolean | undefined {
    return this.disk === "missing" || "corrupt" in this.disk ? undefined : this.disk.enabled;
  }
}

interface ContextRecorder {
  ctx: PanelContext;
  footers: Array<PanelFooterFactory | undefined>;
  notifications: Array<{ message: string; type: string | undefined }>;
  usageReads: number;
}

function createContext(mode: string, usage: ContextUsage | undefined): ContextRecorder {
  const recorder: ContextRecorder = {
    footers: [],
    notifications: [],
    usageReads: 0,
    ctx: {
      mode,
      ui: {
        setFooter(factory) {
          recorder.footers.push(factory);
        },
        notify(message, type) {
          recorder.notifications.push({ message, type });
        },
      },
      getContextUsage() {
        recorder.usageReads += 1;
        return usage;
      },
    },
  };
  return recorder;
}

interface HostRecorder {
  host: PanelHostApi;
  commands: Map<string, { description?: string; handler: (args: string, ctx: PanelContext) => Promise<void> }>;
  events: Map<string, (event: unknown, ctx: PanelContext) => void>;
}

function createHost(): HostRecorder {
  const recorder: HostRecorder = {
    commands: new Map(),
    events: new Map(),
    host: {
      registerCommand(name, options) {
        recorder.commands.set(name, options);
      },
      on(event, handler) {
        recorder.events.set(event, handler);
      },
    },
  };
  return recorder;
}

interface Harness extends HostRecorder {
  store: FakeStore;
  handler: (args: string, ctx: PanelContext) => Promise<void>;
}

function createHarness(initial: "missing" | boolean | { corrupt: string } = "missing"): Harness {
  const { host, commands, events } = createHost();
  const store = new FakeStore(initial);
  createContextPanelExtension(host, { measure, store });
  const handler = commands.get(CONTEXT_PANEL_COMMAND)?.handler;
  assert.ok(handler, "应当已注册命令处理函数");
  return { host, commands, events, store, handler };
}

/** 已安装的底栏工厂数量（每次安装都会 push 一个函数，卸载 push undefined）。 */
function installedCount(recorder: ContextRecorder): number {
  return recorder.footers.filter((factory) => factory !== undefined).length;
}

function latestComponent(recorder: ContextRecorder): PanelComponent {
  const factory = [...recorder.footers].reverse().find((entry) => entry !== undefined);
  assert.ok(factory, "应当已安装底栏组件");
  return factory({}, plainTheme, {});
}

function renderLine(recorder: ContextRecorder, width: number): string {
  const lines = latestComponent(recorder).render(width);
  assert.equal(lines.length, 1, "底栏必须只占一行");
  return lines[0] ?? "";
}

function assertWithin(line: string, width: number): void {
  assert.ok(measure.visibleWidth(line) <= width, `行宽 ${measure.visibleWidth(line)} 不应超过 ${width}`);
}

function lastNotification(recorder: ContextRecorder): { message: string; type: string | undefined } {
  const last = recorder.notifications.at(-1);
  assert.ok(last, "应当已产生一条通知");
  return last;
}

test("取整规则：格数四舍五入且限幅 0—10", () => {
  assert.equal(toBarCells(0), 0);
  assert.equal(toBarCells(4.9), 0);
  assert.equal(toBarCells(5), 1, "5% 四舍五入进一格");
  assert.equal(toBarCells(62.5), 6);
  assert.equal(toBarCells(94.9), 9);
  assert.equal(toBarCells(95), 10);
  assert.equal(toBarCells(100), 10);
  assert.equal(toBarCells(137.2), BAR_CELLS, "格数硬上限 10");
  assert.equal(toBarCells(-30), 0, "格数硬下限 0");
});

test("数值规则：固定一位小数", () => {
  assert.equal(formatPercent(62.5), "62.5%");
  assert.equal(formatPercent(0), "0.0%");
  assert.equal(formatPercent(99.96), "100.0%");
});

test("状态解析：正常值、有效 0、未知、非有限数、超范围各自分流", () => {
  assert.deepEqual(resolvePanelState(contextUsage(0)), { kind: "value", percent: 0, cells: 0, level: "success" });
  assert.equal(resolvePanelState(contextUsage(62.5)).kind, "value");
  assert.equal(resolvePanelState(undefined).kind, "pending");
  assert.equal(resolvePanelState(null).kind, "pending");
  assert.equal(resolvePanelState(contextUsage(null)).kind, "pending");
  assert.equal(resolvePanelState(contextUsage(Number.NaN)).kind, "pending");
  assert.equal(resolvePanelState(contextUsage(Number.POSITIVE_INFINITY)).kind, "pending");
  assert.equal(resolvePanelState(contextUsage(Number.NEGATIVE_INFINITY)).kind, "pending");
  assert.equal(resolvePanelState(contextUsage(100.5)).kind, "out-of-range");
  assert.equal(resolvePanelState(contextUsage(-0.1)).kind, "out-of-range");
  assert.equal(resolvePanelState(contextUsage(100)).kind, "value", "100% 是正常值上界");
});

test("语义色阈值：> 70 warning，> 90 error", () => {
  assert.equal(toLevel(0), "success");
  assert.equal(toLevel(70), "success");
  assert.equal(toLevel(70.1), "warning");
  assert.equal(toLevel(90), "warning");
  assert.equal(toLevel(90.1), "error");
  assert.equal(toLevel(100), "error");
});

test("有效 0：正常形态显示 0.0% 与空条形", () => {
  const state = resolvePanelState(contextUsage(0));
  const line = composePanelLine(state, 80, plainTheme, measure);
  assert.equal(line, `上下文 ${BAR_EMPTY.repeat(BAR_CELLS)} 0.0%`);
  assert.ok(!line.includes(BAR_FILLED));
});

test("未知态：显示“上下文：待更新”，不出现百分比、不出现条形、不兜底 0%", () => {
  for (const usage of [undefined, null, contextUsage(null), contextUsage(Number.NaN)]) {
    const state = resolvePanelState(usage);
    const line = composePanelLine(state, 80, plainTheme, measure);
    assert.equal(line, PENDING_LINE);
    assert.ok(!line.includes("%"), "未知态不应出现百分比");
    assert.ok(!line.includes(BAR_FILLED) && !line.includes(BAR_EMPTY), "未知态不应画条形");
    assert.ok(!line.includes("0.0%"));
  }
});

test("超范围：明确降级并保留真实数字，不按正常形态显示", () => {
  const over = composePanelLine(resolvePanelState(contextUsage(137.2)), 80, plainTheme, measure);
  assert.ok(over.includes("超出范围"));
  assert.ok(over.includes("137.2%"));
  assert.ok(!over.includes(BAR_FILLED) && !over.includes(BAR_EMPTY), "超范围不画条形");

  const under = composePanelLine(resolvePanelState(contextUsage(-3)), 80, plainTheme, measure);
  assert.ok(under.includes("超出范围"));
  assert.ok(under.includes("-3.0%"));
});

test("语义色：标签与空条 dim，填充条与数值跟随等级色", () => {
  const line = composePanelLine(resolvePanelState(contextUsage(95)), 80, tagTheme, measure);
  assert.ok(line.includes("<dim>上下文</dim>"));
  assert.ok(line.includes("<error>"));
  assert.ok(!line.includes("<success>"), "95% 不应使用 success 色");

  const mid = composePanelLine(resolvePanelState(contextUsage(75)), 80, tagTheme, measure);
  assert.ok(mid.includes("<warning>"));

  const pending = composePanelLine(resolvePanelState(undefined), 80, tagTheme, measure);
  assert.ok(pending.includes("<dim>"));
});

test("宽度边界：60/80/120 列均为完整形态且不越界", () => {
  const state = resolvePanelState(contextUsage(62.5));
  for (const width of [60, 80, 120]) {
    const line = composePanelLine(state, width, plainTheme, measure);
    assert.equal(line, "上下文 ██████░░░░ 62.5%", `${width} 列应为完整形态`);
    assertWithin(line, width);
  }
});

test("宽度边界：放不下条形时只省略条形，保留标签与数值", () => {
  const state = resolvePanelState(contextUsage(62.5));
  const full = composePanelLine(state, 200, plainTheme, measure);
  const exact = measure.visibleWidth(full);

  assert.equal(composePanelLine(state, exact, plainTheme, measure), full, "正好放得下时保留条形");
  const compact = composePanelLine(state, exact - 1, plainTheme, measure);
  assert.equal(compact, "上下文 62.5%");
  assert.ok(!compact.includes(BAR_FILLED), "省略条形");
  assertWithin(compact, exact - 1);
  assert.equal(measure.visibleWidth(compact), 12, "紧凑形态只含标签、空格与数值");
});

test("宽度边界：极窄时按可见宽度截断，不越界", () => {
  const state = resolvePanelState(contextUsage(62.5));
  for (const width of [11, 8, 5, 3, 1]) {
    const line = composePanelLine(state, width, plainTheme, measure);
    assertWithin(line, width);
  }
  assert.equal(composePanelLine(state, 0, plainTheme, measure), "", "宽度 0 返回空行而不是报错");
});

test("宽度边界：中文按双列计算，未知态与超范围态同样不越界", () => {
  assert.equal(measure.visibleWidth("上下文"), 6, "中文每字 2 列");
  assert.equal(measure.visibleWidth(`${BAR_FILLED}${BAR_EMPTY}`), 2, "条形字符各 1 列");

  for (const usage of [undefined, contextUsage(137.2), contextUsage(0), contextUsage(62.5)]) {
    const state = resolvePanelState(usage);
    for (const width of [60, 80, 120, 20, 14, 6, 2]) {
      const line = composePanelLine(state, width, plainTheme, measure);
      assertWithin(line, width);
    }
  }
});

test("分段计划：正常值 6 段（标签/空格/填充/空/空格/数值），省略条形后 3 段", () => {
  const state = resolvePanelState(contextUsage(62.5));
  assert.deepEqual(
    planSegments(state, true).map((segment) => segment.text),
    ["上下文", " ", BAR_FILLED.repeat(6), BAR_EMPTY.repeat(4), " ", "62.5%"],
  );
  assert.deepEqual(
    planSegments(state, false).map((segment) => segment.text),
    ["上下文", " ", "62.5%"],
  );
});

test("命令注册：只注册 context-panel，且不再注册 E1 的 context-usage", () => {
  const { commands } = createHarness();
  assert.deepEqual([...commands.keys()], [CONTEXT_PANEL_COMMAND]);
  assert.equal(commands.get(CONTEXT_PANEL_COMMAND)?.description, CONTEXT_PANEL_DESCRIPTION);
});

test("on：提交 true，成功后安装面板并显示当前读数", async () => {
  const { handler, store } = createHarness(false);
  const recorder = createContext("tui", contextUsage(50));

  await handler("on", recorder.ctx);

  assert.deepEqual(store.resolved, [true], "on 就是一次明确偏好提交");
  assert.equal(installedCount(recorder), 1);
  assert.equal(renderLine(recorder, 80), "上下文 █████░░░░░ 50.0%");
  assert.deepEqual(recorder.notifications, [], "成功保存不额外提示，画面变化就是反馈");
});

test("off：提交 false，成功后移除底栏", async () => {
  const { handler, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));
  await handler("on", recorder.ctx);

  await handler("off", recorder.ctx);

  assert.deepEqual(store.resolved, [true, false]);
  assert.equal(recorder.footers.at(-1), undefined, "off 恢复原生底栏");
});

test("toggle 与无参数：都相对共享记录反转，且每次都提交", async () => {
  const { handler, store } = createHarness(false);
  const recorder = createContext("tui", contextUsage(50));

  await handler("toggle", recorder.ctx);
  assert.deepEqual(store.resolved, [true], "由 false 反转为 true");
  assert.equal(installedCount(recorder), 1);

  await handler("", recorder.ctx);
  assert.deepEqual(store.resolved, [true, false], "无参数从开启状态反转关闭");
  assert.equal(recorder.footers.at(-1), undefined);

  await handler("  toggle  ", recorder.ctx);
  assert.deepEqual(store.resolved, [true, false, true], "两端空白按同一语义处理");

  await handler("  on  ", recorder.ctx);
  assert.deepEqual(store.resolved, [true, false, true, true], "on 无论当前值都提交 true");
});

test("toggle 以共享记录为起点，不以本窗口缓存为起点", async () => {
  const { handler, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));

  await handler("on", recorder.ctx);
  assert.equal(store.saved, true);

  // 另一个窗口把偏好改成 false；本窗口没有收到任何通知，也没有本地缓存可依赖。
  store.externalWrite(false);

  await handler("toggle", recorder.ctx);

  const lastCommit = store.commits.at(-1);
  assert.equal(typeof lastCommit, "function", "toggle 必须提交一个相对函数，而不是本窗口算好的常量");
  assert.equal((lastCommit as (current: boolean) => boolean)(false), true, "以共享记录的 false 为起点");
  assert.equal((lastCommit as (current: boolean) => boolean)(true), false, "同一函数对 true 也成立");
  assert.equal(store.saved, true);
  assert.equal(installedCount(recorder), 2, "结果 true → 安装面板");
});

test("重复 on：每次都提交并重装，不叠加、不报错", async () => {
  const { handler, store } = createHarness(false);
  const recorder = createContext("tui", contextUsage(50));

  await handler("on", recorder.ctx);
  await handler("on", recorder.ctx);
  await handler("on", recorder.ctx);

  assert.deepEqual(store.resolved, [true, true, true], "每次 on 都是一次明确偏好操作");
  assert.equal(recorder.footers.length, 3, "每次都重装（用于夺回被其他扩展占用的底栏）");
  assert.ok(
    recorder.footers.every((entry) => entry !== undefined),
    "重装过程中不应短暂退回原生底栏",
  );
  assert.equal(renderLine(recorder, 80), "上下文 █████░░░░░ 50.0%");
  assert.deepEqual(recorder.notifications, []);

  await handler("off", recorder.ctx);
  await handler("off", recorder.ctx);
  assert.deepEqual(store.resolved, [true, true, true, false, false], "重复 off 也是提交，但不报错");
  assert.equal(recorder.footers.at(-1), undefined);
  assert.deepEqual(recorder.notifications, []);
});

test("非法参数：只提示用法，不提交、不改显示、不查询", async () => {
  const { handler, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));
  await handler("on", recorder.ctx);
  const beforeFooters = recorder.footers.length;

  for (const args of ["wrong", "1", "ON", "enable", "on off"]) {
    await handler(args, recorder.ctx);
    assert.deepEqual(recorder.notifications.at(-1), { message: CONTEXT_PANEL_USAGE, type: "warning" });
    assert.equal(recorder.footers.length, beforeFooters, `args=${args} 不应改动底栏`);
    assert.equal(recorder.usageReads, 0, "非法参数不应查询上下文");
  }

  assert.deepEqual(store.commits.length, 1, "非法参数一次都不提交偏好");
  assert.equal(store.saved, true, "偏好未被改写");
});

test("保存失败：明确提示未保存，且不改变当前显示", async () => {
  const { handler, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));
  await handler("on", recorder.ctx);
  const footersBefore = recorder.footers.length;

  store.outcome = "write-failed";
  await handler("off", recorder.ctx);

  const notice = lastNotification(recorder);
  assert.equal(notice.type, "warning");
  assert.ok(notice.message.includes("未保存"), `提示必须说明未保存：${notice.message}`);
  assert.ok(notice.message.includes("EACCES"), "提示带上失败原因");
  assert.ok(notice.message.includes("当前显示保持不变"), "提示声明画面维持原样");
  assert.equal(recorder.footers.length, footersBefore, "显示未被改动，也没有追加安装/卸载");
  assert.equal(store.saved, true, "偏好文件仍是旧值");
});

test("等待锁超时：提示等待上限与未保存，显示不变", async () => {
  const { handler, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));
  await handler("on", recorder.ctx);
  const footersBefore = recorder.footers.length;

  store.outcome = "lock-timeout";
  await handler("off", recorder.ctx);

  const notice = lastNotification(recorder);
  assert.equal(notice.type, "warning");
  assert.ok(notice.message.includes("未保存"));
  assert.ok(notice.message.includes("2.0 秒"), `提示要写出等待上限：${notice.message}`);
  assert.equal(recorder.footers.length, footersBefore);
  assert.equal(store.saved, true);
});

test("记录损坏：加载时提示并临时开启，写入被拒且不覆盖原文件", async () => {
  const { handler, store, events } = createHarness({ corrupt: "enabled 不是布尔值" });
  const recorder = createContext("tui", contextUsage(50));

  events.get("session_start")?.({ reason: "startup" }, recorder.ctx);

  assert.equal(installedCount(recorder), 1, "损坏时临时按开启显示");
  const startupNotice = lastNotification(recorder);
  assert.equal(startupNotice.message, corruptNotice(store.statePath, "enabled 不是布尔值"));
  assert.ok(startupNotice.message.includes(store.statePath), "提示里给出可执行的恢复路径");

  // 明确的 off 操作也无法落盘：损坏记录必须先修复，不能被静默覆盖。
  await handler("off", recorder.ctx);
  const offNotice = lastNotification(recorder);
  assert.ok(offNotice.message.includes("偏好记录损坏"), `损坏下 off 必须报出记录问题：${offNotice.message}`);
  assert.ok(offNotice.message.includes("未覆盖原文件"), "明确说明没有覆盖原文件");
  assert.equal(installedCount(recorder), 1, "显示保持临时开启，未改变");
  assert.equal(store.saved, undefined, "损坏记录没有被改写成新值");
});

test("加载边界：按共享记录决定是否安装面板", () => {
  const cases: Array<["missing" | boolean, boolean]> = [
    ["missing", true],
    [true, true],
    [false, false],
  ];
  for (const [initial, expectInstalled] of cases) {
    const { events } = createHarness(initial);
    const recorder = createContext("tui", contextUsage(50));
    events.get("session_start")?.({ reason: "startup" }, recorder.ctx);
    assert.equal(installedCount(recorder), expectInstalled ? 1 : 0, `初始 ${String(initial)} 时的安装结果`);
    assert.deepEqual(recorder.notifications, [], "正常记录不产生提示");
  }
});

test("加载边界：另一个窗口改过偏好后，新会话读到最新值", () => {
  const { events, store } = createHarness(true);
  const first = createContext("tui", contextUsage(50));
  events.get("session_start")?.({ reason: "startup" }, first.ctx);
  assert.equal(installedCount(first), 1);

  events.get("session_shutdown")?.({ reason: "new" }, first.ctx);
  assert.equal(first.footers.at(-1), undefined, "切换会话时释放旧底栏");
  assert.deepEqual(store.commits, [], "退出/切换不回写偏好");

  store.externalWrite(false);
  const second = createContext("tui", contextUsage(80));
  events.get("session_start")?.({ reason: "new" }, second.ctx);
  assert.equal(installedCount(second), 0, "读到的最新值是关闭，就不装面板");
});

test("session_shutdown：只移除底栏，不回写偏好", async () => {
  const { handler, events, store } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));
  await handler("on", recorder.ctx);
  const commitsBefore = store.commits.length;

  events.get("session_shutdown")?.({ reason: "quit" }, recorder.ctx);

  assert.equal(recorder.footers.at(-1), undefined);
  assert.equal(store.commits.length, commitsBefore, "退出不产生任何提交");

  // 命令入口仍在，重新执行 on 依然可用。
  await handler("on", recorder.ctx);
  assert.equal(installedCount(recorder), 2, "退出后重新 on 仍能安装面板");
});

test("冲突恢复：底栏被其他扩展占用后，on 重新夺回", async () => {
  const { handler } = createHarness(true);
  const recorder = createContext("tui", contextUsage(50));

  await handler("on", recorder.ctx);
  // 模拟另一个扩展抢走底栏：它只改宿主状态，本扩展无从感知自己的组件已被替代。
  recorder.footers.push(() => ({ render: () => ["别人的底栏"], invalidate: () => {}, dispose: () => {} }));
  assert.equal(renderLine(recorder, 80), "别人的底栏");

  await handler("on", recorder.ctx);
  assert.equal(renderLine(recorder, 80), "上下文 █████░░░░░ 50.0%", "on 应重新夺回底栏");
});

test("非 TUI：不安装底栏、不提示、不查询、不碰偏好文件", async () => {
  const { handler, events, store } = createHarness(true);

  for (const mode of ["rpc", "json", "print"]) {
    const recorder = createContext(mode, contextUsage(50));
    await handler("on", recorder.ctx);
    await handler("", recorder.ctx);
    await handler("wrong", recorder.ctx);
    await handler("off", recorder.ctx);
    assert.deepEqual(recorder.footers, [], `${mode} 不应安装底栏`);
    assert.deepEqual(recorder.notifications, [], `${mode} 不应产生输出`);
    assert.equal(recorder.usageReads, 0, `${mode} 不应查询上下文`);
    events.get("session_start")?.({}, recorder.ctx);
    events.get("session_shutdown")?.({}, recorder.ctx);
    assert.deepEqual(recorder.footers, [], `${mode} 生命周期事件不应安装底栏`);
  }

  assert.deepEqual(store.commits, [], "非 TUI 一次都不提交偏好");
  assert.equal(store.reads, 0, "非 TUI 连读都不做");
});

test("组件行为：每次渲染读取一次当前上下文，只输出一行且不越界", () => {
  const { events } = createHarness(true);
  const recorder = createContext("tui", contextUsage(62.5));
  events.get("session_start")?.({ reason: "startup" }, recorder.ctx);

  const component = latestComponent(recorder);
  for (const width of [120, 80, 60, 14, 5]) {
    const lines = component.render(width);
    assert.equal(lines.length, 1);
    assert.ok(!(lines[0] ?? "").includes("\n"), "行内不得含换行");
    assertWithin(lines[0] ?? "", width);
  }
  assert.equal(recorder.usageReads, 5, "每次渲染读取一次，渲染不产生额外副作用");

  component.invalidate();
  component.dispose();
  component.dispose();
  assert.equal(recorder.usageReads, 5, "清理动作不触发数据读取");
});

test("颜色分层：渲染使用的颜色都在语义色集合内", () => {
  const allowed = new Set<PanelColor>(["dim", "success", "warning", "error"]);
  const used: PanelColor[] = [];
  const spyTheme: PanelTheme = {
    fg(color, text) {
      used.push(color);
      return text;
    },
  };
  for (const usage of [undefined, contextUsage(137.2), contextUsage(0), contextUsage(62.5), contextUsage(95)]) {
    composePanelLine(resolvePanelState(usage), 80, spyTheme, measure);
  }
  assert.ok(used.length > 0);
  for (const color of used) {
    assert.ok(allowed.has(color), `未预期的颜色：${color}`);
  }
});
