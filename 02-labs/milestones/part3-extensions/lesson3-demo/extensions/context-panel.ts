/**
 * ==============================================================================
 * 🎯 进阶 Extension 实践 (E2~E3 阶段): context-panel.ts
 * ==============================================================================
 * 💡 老王架构解密：
 * 1. 从瞬时弹窗跃迁到常驻底栏：通过 ctx.ui.setStatus 挂载终端底栏状态；
 * 2. 10 格高颜值进度条算法：使用 █ 和 ░ 绘制，四舍五入限幅，带阈值预警；
 * 3. 动态开关与控制：/context-panel [on|off]，支持无参 toggle 反转与显式设置；
 * 4. 事件联动自动刷新：监听 pi.on("turn_end")，大模型每轮回答完毕自动刷新底栏；
 * 5. 本地偏好持久化：在沙盒工作区私有 .pi/ 目录下保存状态，跨会话记忆开/关偏好！
 * ==============================================================================
 */

import * as fs from "fs";
import * as path from "path";

// 进度条与阈值规范
const TOTAL_BAR_CELLS = 10;
const BAR_FILLED = "█";
const BAR_EMPTY = "░";
const STATUS_KEY = "context-panel";

export default function (pi: any) {
  // ----------------------------------------------------------------------------
  // 1. 偏好存储层：本地沙盒 .pi/context-panel.json（100% 隔离，绝不污染全局）
  // ----------------------------------------------------------------------------
  const getConfigFile = (ctx: any): string => {
    const cwd = ctx.cwd || process.cwd();
    const piDir = path.join(cwd, ".pi");
    if (!fs.existsSync(piDir)) {
      try { fs.mkdirSync(piDir, { recursive: true }); } catch (_) {}
    }
    return path.join(piDir, "context-panel.json");
  };

  const loadSavedPreference = (ctx: any): boolean => {
    try {
      const file = getConfigFile(ctx);
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (typeof raw.enabled === "boolean") return raw.enabled;
      }
    } catch (_) {}
    return true; // 默认开启底栏
  };

  const savePreference = (ctx: any, enabled: boolean) => {
    try {
      const file = getConfigFile(ctx);
      fs.writeFileSync(file, JSON.stringify({ enabled, updatedAt: new Date().toISOString() }, null, 2));
    } catch (_) {}
  };

  // 内存状态缓存
  let isPanelEnabled = true;

  // ----------------------------------------------------------------------------
  // 2. 底栏渲染引擎：计算 10 格进度条并挂载到 ctx.ui.setStatus
  // ----------------------------------------------------------------------------
  const updateStatusBar = (ctx: any) => {
    if (ctx.mode !== "tui" || !ctx.ui?.setStatus) return;

    // 若被关闭，彻底清除底栏占位，释放终端屏幕空间
    if (!isPanelEnabled) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }

    const percent = ctx.getContextUsage?.()?.percent;

    // 数据未就绪或非有限数防御
    if (typeof percent !== "number" || !Number.isFinite(percent)) {
      ctx.ui.setStatus(STATUS_KEY, "[上下文: 待更新]");
      return;
    }

    // 严苛四舍五入限幅算法：0~100% 映射到 0~10 格
    const filledCount = Math.min(
      TOTAL_BAR_CELLS,
      Math.max(0, Math.round(percent / (100 / TOTAL_BAR_CELLS)))
    );
    const emptyCount = TOTAL_BAR_CELLS - filledCount;
    const bar = BAR_FILLED.repeat(filledCount) + BAR_EMPTY.repeat(emptyCount);

    // 格式化输出：例如 [上下文: [██░░░░░░░░] 23.0%]
    const text = `[上下文: [${bar}] ${percent.toFixed(1)}%]`;
    ctx.ui.setStatus(STATUS_KEY, text);
  };

  // ----------------------------------------------------------------------------
  // 3. 会话启动与大模型轮次结束自动刷新联动
  // ----------------------------------------------------------------------------
  pi.on("session_start", async (_event: any, ctx: any) => {
    if (ctx) {
      isPanelEnabled = loadSavedPreference(ctx);
      updateStatusBar(ctx);
    }
  });

  // 🔥 核心自动化：大模型每完成一轮回答，自动重新计算并刷新底栏！
  pi.on("turn_end", async (_event: any, ctx: any) => {
    if (ctx) {
      updateStatusBar(ctx);
    }
  });

  // ----------------------------------------------------------------------------
  // 4. 注册控制开关命令：/context-panel [on|off]
  // ----------------------------------------------------------------------------
  pi.registerCommand("context-panel", {
    description: "切换底栏上下文占用进度条面板（/context-panel on/off，无参则自动反转）",
    handler: async (args: string, ctx: any) => {
      if (ctx.mode !== "tui") return;

      const raw = (args || "").trim().toLowerCase();

      // 参数校验与意图解析
      if (raw === "on") {
        isPanelEnabled = true;
      } else if (raw === "off") {
        isPanelEnabled = false;
      } else if (!raw) {
        // 无参数时自动 toggle 反转
        isPanelEnabled = !isPanelEnabled;
      } else {
        ctx.ui.notify("用法：/context-panel [on|off]（无参数为切换开/关）", "warning");
        return;
      }

      // 持久化保存
      savePreference(ctx, isPanelEnabled);

      // 立即刷新底栏
      updateStatusBar(ctx);

      const statusDesc = isPanelEnabled ? "🟢 开启 (Active)" : "⚪ 关闭 (Disabled)";
      ctx.ui.notify(`上下文底栏面板已切换为：${statusDesc}`, "info");
    },
  });

  // ----------------------------------------------------------------------------
  // 5. 保留向下兼容的单次查询浮层命令：/context-usage
  // ----------------------------------------------------------------------------
  pi.registerCommand("context-usage", {
    description: "查询当前会话的上下文占用估算（单次浮层）",
    handler: async (args: string, ctx: any) => {
      if (ctx.mode !== "tui") return;
      if (args && args.trim()) {
        ctx.ui.notify("用法：/context-usage（不带参数）", "warning");
        return;
      }
      const percent = ctx.getContextUsage?.()?.percent;
      const text = typeof percent === "number" && Number.isFinite(percent)
        ? `上下文占用估算：${percent.toFixed(1)}%`
        : "上下文：待更新";
      ctx.ui.notify(text, "info");
    },
  });
}
