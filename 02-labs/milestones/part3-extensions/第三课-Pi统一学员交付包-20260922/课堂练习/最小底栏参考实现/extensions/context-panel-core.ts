/**
 * /context-panel 纯逻辑核心（Pi 0.85.1）。
 *
 * 只做三件事：把宿主数据解析成面板状态 → 按语义色规划单行内容 → 按可用宽度选择形态。
 * 不导入任何运行时依赖（宽度计算与截断由调用方注入），因此可以脱离 Pi 独立驱动测试。
 * 副作用：无。不调用模型、不读写文件、不注册模型工具、无持久化。
 */
import type { ContextUsage, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const CONTEXT_PANEL_COMMAND = "context-panel";
export const CONTEXT_PANEL_USAGE = "用法：/context-panel [on|off]（无参数或 toggle 反转开/关；仅在 TUI 生效）";

/** 结果缺失、`percent` 为 null 或非有限数时的整行文案（需求指定原文）。 */
export const PENDING_LINE = "上下文：待更新";
/** 有限但落在 [0, 100] 之外的占用值：不画条形、不用正常形态冒充，直接标出真实数字。 */
export const OUT_OF_RANGE_PREFIX = "上下文：超出范围";
export const PANEL_LABEL = "上下文";

/** 进度条固定十格；每格代表 10%，四舍五入后限幅到 0—10。 */
export const BAR_CELLS = 10;
export const BAR_FILLED = "█";
export const BAR_EMPTY = "░";

/** 语义色阈值：占用 > 90% 用 error，> 70% 用 warning，其余 success（与 Pi 原生底栏口径一致）。 */
export const ERROR_ABOVE = 90;
export const WARNING_ABOVE = 70;

export type PanelColor = "dim" | "success" | "warning" | "error";
export type PanelLevel = "success" | "warning" | "error";

/** 一个面板状态对应一整行内容；三种状态互斥，未知与超范围不与正常值共用形态。 */
export type PanelState =
  | { kind: "pending" }
  | { kind: "out-of-range"; percent: number }
  | { kind: "value"; percent: number; cells: number; level: PanelLevel };

/** 供测试注入的最小宽度工具；真实运行时传入 `@earendil-works/pi-tui` 的实现。 */
export interface PanelMeasure {
  visibleWidth(text: string): number;
  truncateToWidth(text: string, width: number): string;
}

export interface PanelTheme {
  fg(color: PanelColor, text: string): string;
}

/** 一行的分段计划；`color` 为空表示不着色（分隔空格）。 */
export interface PanelSegment {
  text: string;
  color: PanelColor | undefined;
}

export interface PanelComponent {
  render(width: number): string[];
  invalidate(): void;
  dispose(): void;
}

export type PanelFooterFactory = (tui: unknown, theme: PanelTheme, footerData: unknown) => PanelComponent;

/** 本扩展实际使用的最小命令上下文合同。 */
export interface PanelContext {
  mode: string;
  ui: {
    setFooter(factory: PanelFooterFactory | undefined): void;
    notify(message: string, type?: "info" | "warning" | "error"): void;
  };
  getContextUsage(): ContextUsage | undefined;
}

/** 本扩展实际使用的最小宿主合同。 */
export interface PanelHostApi {
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: PanelContext) => Promise<void>;
    },
  ): void;
  on(event: "session_start" | "session_shutdown", handler: (event: unknown, ctx: PanelContext) => void): void;
}

/** 编译期断言泛型：`Actual` 必须满足 `Expected`。 */
type HostApiIsCompatible<Actual extends Expected, Expected> = Actual;

/**
 * 编译期断言：真实 `ExtensionAPI` 满足上面的最小宿主合同。
 * Pi 公开类型若不再兼容，类型检查会在此处失败，而不是等到运行时。
 */
export type ContextPanelHostApiCheck = HostApiIsCompatible<ExtensionAPI, PanelHostApi>;

/** 固定取整规则：一位小数（`toFixed(1)`）。 */
export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/** 固定格数规则：`round(percent / 10)`，限幅到 0—10（超范围值的降级由 `resolvePanelState` 负责）。 */
export function toBarCells(percent: number): number {
  const cells = Math.round(percent / 10);
  return Math.min(BAR_CELLS, Math.max(0, cells));
}

/** 语义色等级：> 90 error，> 70 warning，其余 success。 */
export function toLevel(percent: number): PanelLevel {
  if (percent > ERROR_ABOVE) return "error";
  if (percent > WARNING_ABOVE) return "warning";
  return "success";
}

/**
 * 把宿主数据解析成面板状态。
 * 缺失 / `percent` 为 null / 非有限数 → pending；有限但出 [0, 100] → out-of-range；其余为正常值。
 */
export function resolvePanelState(usage: ContextUsage | null | undefined): PanelState {
  const percent = usage?.percent;
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return { kind: "pending" };
  }
  if (percent < 0 || percent > 100) {
    return { kind: "out-of-range", percent };
  }
  return { kind: "value", percent, cells: toBarCells(percent), level: toLevel(percent) };
}

function barText(cells: number): { filled: string; empty: string } {
  return { filled: BAR_FILLED.repeat(cells), empty: BAR_EMPTY.repeat(BAR_CELLS - cells) };
}

/** 规划整行分段；`withBar=false` 为省略条形的窄屏形态。 */
export function planSegments(state: PanelState, withBar: boolean): PanelSegment[] {
  if (state.kind === "pending") {
    return [{ text: PENDING_LINE, color: "dim" }];
  }
  if (state.kind === "out-of-range") {
    return [{ text: `${OUT_OF_RANGE_PREFIX}（${formatPercent(state.percent)}）`, color: "warning" }];
  }

  const segments: PanelSegment[] = [{ text: PANEL_LABEL, color: "dim" }];
  if (withBar) {
    const { filled, empty } = barText(state.cells);
    segments.push({ text: " ", color: undefined });
    segments.push({ text: filled, color: state.level });
    segments.push({ text: empty, color: "dim" });
  }
  segments.push({ text: " ", color: undefined });
  segments.push({ text: formatPercent(state.percent), color: state.level });
  return segments;
}

function colorize(segments: PanelSegment[], theme: PanelTheme): string {
  return segments.map((segment) => (segment.color ? theme.fg(segment.color, segment.text) : segment.text)).join("");
}

/**
 * 组合成单行内容，按宽度依次降级：完整形态 → 省略条形 → 截断（永不越界）。
 * 只做视图计算，不读宿主状态、不写文件。
 */
export function composePanelLine(
  state: PanelState,
  width: number,
  theme: PanelTheme,
  measure: PanelMeasure,
): string {
  const plan = state.kind === "value" ? [planSegments(state, true), planSegments(state, false)] : [planSegments(state, false)];

  let fallback = plan[plan.length - 1];
  for (const segments of plan) {
    fallback = segments;
    const plain = segments.map((segment) => segment.text).join("");
    if (measure.visibleWidth(plain) <= width) {
      return colorize(segments, theme);
    }
  }

  return measure.truncateToWidth(colorize(fallback, theme), width);
}

/**
 * 注册命令与生命周期回调。
 * 工厂只注册，不启动常驻资源；所有 UI 动作都发生在回调运行时。
 */
export function createContextPanelExtension(host: PanelHostApi, measure: PanelMeasure): void {
  let enabled = false;

  function enable(ctx: PanelContext): void {
    // 总是重装，而不是"没开才装"：底栏归属由宿主决定，别的扩展可能在两次开启之间抢占它。
    // 宿主 setFooter 会先释放并清空旧底栏，再装入新组件，所以重复调用只会替换、不会叠加。
    ctx.ui.setFooter((_tui, theme) => ({
      render: (width) => [composePanelLine(resolvePanelState(ctx.getContextUsage()), width, theme, measure)],
      invalidate: () => {},
      dispose: () => {},
    }));
    enabled = true;
  }

  function disable(ctx: PanelContext): void {
    ctx.ui.setFooter(undefined);
    enabled = false;
  }

  host.registerCommand(CONTEXT_PANEL_COMMAND, {
    description: "切换底栏上下文占用面板（on/off，无参数或 toggle 反转）",
    handler: async (args, ctx) => {
      // 底栏是 TUI 专属能力；其他宿主安全跳过，不写 stdout。
      if (ctx.mode !== "tui") {
        return;
      }

      const action = args.trim();
      if (action === "") {
        if (enabled) disable(ctx);
        else enable(ctx);
        return;
      }
      if (action === "on") {
        // 无条件重装：即使本扩展认为自己已开启，底栏也可能已被别的扩展占用，重装才能夺回。
        enable(ctx);
        return;
      }
      if (action === "off") {
        disable(ctx);
        return;
      }
      if (action === "toggle") {
        if (enabled) disable(ctx);
        else enable(ctx);
        return;
      }

      ctx.ui.notify(CONTEXT_PANEL_USAGE, "warning");
    },
  });

  host.on("session_start", (_event, ctx) => {
    // 每次启动、新建、切换、重载都默认开启，并用新会话的上下文重建面板。
    if (ctx.mode !== "tui") {
      return;
    }
    enable(ctx);
  });

  host.on("session_shutdown", (_event, ctx) => {
    // 释放本次会话的面板并复位开关；命令入口在工厂期注册，不受影响。
    if (ctx.mode !== "tui") {
      return;
    }
    disable(ctx);
  });
}
