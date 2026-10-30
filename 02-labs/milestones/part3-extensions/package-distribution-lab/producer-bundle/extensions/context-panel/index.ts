/**
 * 老王暴躁技术流实战扩展：context-panel/index.ts
 * 挂载原生命令 /context-panel [on|off] 与 10 格高颜值进度条状态栏
 */

const TOTAL_BAR_CELLS = 10;
const BAR_FILLED = "█";
const BAR_EMPTY = "░";
const STATUS_KEY = "laowang-context-panel";

export default function (pi: any) {
  let isEnabled = true;

  const renderBar = (percent: number): string => {
    const filledCount = Math.min(
      TOTAL_BAR_CELLS,
      Math.max(0, Math.round(percent / (100 / TOTAL_BAR_CELLS)))
    );
    const emptyCount = TOTAL_BAR_CELLS - filledCount;
    const bar = BAR_FILLED.repeat(filledCount) + BAR_EMPTY.repeat(emptyCount);
    return `[${bar}] ${percent.toFixed(1)}%`;
  };

  const updateUI = (ctx: any) => {
    if (ctx.mode !== "tui" || !ctx.ui?.setStatus) return;

    if (!isEnabled) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }

    const percent = ctx.getContextUsage?.()?.percent;
    if (typeof percent !== "number" || !Number.isFinite(percent)) {
      ctx.ui.setStatus(STATUS_KEY, "[上下文: 待更新]");
      return;
    }

    ctx.ui.setStatus(STATUS_KEY, `上下文 ${renderBar(percent)}`);
  };

  // 1. 注册斜杠命令 /context-panel
  pi.registerCommand("context-panel", {
    description: "切换或显式设置上下文常驻底栏显示（用法：/context-panel [on|off]）",
    handler: async (args: string, ctx: any) => {
      const mode = (args || "").trim().toLowerCase();
      if (!mode) {
        isEnabled = !isEnabled;
      } else if (mode === "on") {
        isEnabled = true;
      } else if (mode === "off") {
        isEnabled = false;
      } else {
        ctx.ui?.notify?.("用法：/context-panel [on|off]", "warning");
        return;
      }

      updateUI(ctx);
      ctx.ui?.notify?.(
        `底栏状态已更新为：${isEnabled ? "🟢 开启" : "🔴 关闭"}`,
        "info"
      );
    },
  });

  // 2. 轮次结束自动刷新联动
  if (typeof pi.on === "function") {
    pi.on("turn_end", (_event: any, ctx: any) => {
      updateUI(ctx);
    });
  }
}
