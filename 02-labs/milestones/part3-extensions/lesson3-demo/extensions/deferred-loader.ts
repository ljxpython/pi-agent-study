/**
 * ==============================================================================
 * 🎯 破局武器一实战：按需工具延迟发现扩展 (deferred-loader.ts)
 * ==============================================================================
 * 💡 老王架构解密：
 * 1. 离线注册：先用 pi.registerTool 注册重型工具 generate_sla_report；
 * 2. 初始剔除：在 session_start 事件中将其从 activeTools 剔除，不进模型初始 Schema；
 * 3. 元工具常驻：暴露 search_tools，模型想用 SLA 分析时先搜工具；
 * 4. 动态热插拔：命中后调用 pi.setActiveTools 纯增量追加，下一轮立即可用；
 * 5. 调试命令：提供 /active-tools 和 /reset-tools 供学习者直观验证效果！
 * ==============================================================================
 */

import { Type } from "typebox";

// 声明所有需要被延迟加载的“重型扩展工具”白名单
const DEFERRED_TOOL_NAMES = new Set(["generate_sla_report"]);

export default function (pi: any) {
  // ----------------------------------------------------------------------------
  // 1. 注册重型工具：generate_sla_report（初始被雪藏，不占大模型首轮 Token）
  // ----------------------------------------------------------------------------
  pi.registerTool({
    name: "generate_sla_report",
    label: "Generate SLA Report",
    description: "针对核心业务系统生成 SLA 可用性达标分析报告与违约赔偿风险评估",
    // ⚠️ 避坑铁律：绝不能加 promptSnippet 或 promptGuidelines！
    // 否则一旦激活会触发重新编译 System Prompt，把前缀缓存全部毁掉！
    parameters: Type.Object({
      serviceName: Type.String({ description: "系统或服务名称，例如 'OrderCenter' 或 'PaymentGateway'" }),
      downtimeMinutes: Type.Number({ description: "本月累计故障停机时间（分钟）" }),
      targetAvailability: Type.Optional(Type.Number({ description: "目标可用性，例如 99.99" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const target = params.targetAvailability ?? 99.9;
      const totalMinutesInMonth = 30 * 24 * 60; // 43200 分钟
      const actualAvailability = ((totalMinutesInMonth - params.downtimeMinutes) / totalMinutesInMonth) * 100;
      const isBreached = actualAvailability < target;

      const report = [
        `【SLA 可用性诊断报告】`,
        `服务名称：${params.serviceName}`,
        `月度累计停机：${params.downtimeMinutes} 分钟`,
        `目标可用性：${target}%`,
        `实际可用性：${actualAvailability.toFixed(3)}%`,
        `SLA 判定：${isBreached ? "❌ 已发生违约 (Breached)" : "✅ 达标 (Met)"}`,
        isBreached ? `风险提示：请立即启动赔偿预案并提交故障复盘报告！` : `运行状态良好。`,
      ].join("\n");

      return {
        content: [{ type: "text", text: report }],
        details: { isBreached, actualAvailability },
      };
    },
  });

  // ----------------------------------------------------------------------------
  // 2. 注册元工具：search_tools（常驻，专供大模型按需搜索工具库）
  // ----------------------------------------------------------------------------
  pi.registerTool({
    name: "search_tools",
    label: "Search Tools",
    description: "当当前活跃的工具无法满足任务需求时，用于检索并动态激活系统内置的高级扩展工具库",
    promptSnippet: "Search for and activate additional tools on demand",
    promptGuidelines: [
      "当用户的任务涉及专业领域（如 SLA 分析、高级架构诊断）且当前没有对应工具时，第一步必须调用 search_tools 检索并激活对应工具。",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "需要的能力或任务关键词，例如 'sla', 'report', 'availability'" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const query = params.query.toLowerCase();
      // 在所有已注册工具中，针对延迟加载白名单进行检索匹配
      const allRegistered = pi.getAllTools();
      const matched = allRegistered.filter((tool: any) => {
        if (!DEFERRED_TOOL_NAMES.has(tool.name)) return false;
        const text = `${tool.name} ${tool.description}`.toLowerCase();
        return text.includes(query);
      });

      if (matched.length === 0) {
        return {
          content: [{ type: "text", text: `未找到匹配 "${params.query}" 的扩展工具。当前已注册工具：${allRegistered.map((t: any) => t.name).join(", ")}` }],
          details: { matched: [] },
        };
      }

      // 💡 核心魔法：读取当前活跃工具，纯增量追加（Additive Only）
      const currentActive = pi.getActiveTools();
      const newToolsToAdd = matched
        .map((t: any) => t.name)
        .filter((name: string) => !currentActive.includes(name));

      if (newToolsToAdd.length > 0) {
        // 🔥 纯增量激活：保持当前所有工具不变，追加新工具
        pi.setActiveTools([...new Set([...currentActive, ...newToolsToAdd])]);
      }

      const replyText = newToolsToAdd.length > 0
        ? `✅ 成功动态激活扩展工具：[${newToolsToAdd.join(", ")}]！你现在可以直接在下一轮调用该工具完成任务。`
        : `ℹ️ 匹配的工具 [${matched.map((t: any) => t.name).join(", ")}] 当前已经处于活跃状态，可直接调用。`;

      return {
        content: [{ type: "text", text: replyText }],
        details: { matched: matched.map((t: any) => t.name), newlyAdded: newToolsToAdd },
      };
    },
  });

  // ----------------------------------------------------------------------------
  // 3. 生命周期挂载：session_start 开局瘦身
  // ----------------------------------------------------------------------------
  const applyColdStartTrim = () => {
    // 过滤掉所有在 DEFERRED_TOOL_NAMES 白名单里的重型工具，保留基础工具与 search_tools
    const initialTools = pi.getActiveTools().filter(
      (name: string) => !DEFERRED_TOOL_NAMES.has(name)
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  };

  pi.on("session_start", () => {
    applyColdStartTrim();
  });

  // ----------------------------------------------------------------------------
  // 4. 辅助学习调试命令：/active-tools 与 /reset-tools
  // ----------------------------------------------------------------------------
  pi.registerCommand("active-tools", {
    description: "查看当前会话大模型真正能看到的活跃工具清单",
    handler: async (_args: string, ctx: any) => {
      const active = pi.getActiveTools();
      const hasSla = active.includes("generate_sla_report");
      const msg = `当前活跃工具 (${active.length}个)：\n${active.join(", ")}\n[SLA报告工具状态: ${hasSla ? "🟢 已激活 (Active)" : "⚪ 延迟冷冻中 (Inactive)"}]`;
      if (ctx.ui?.notify) {
        ctx.ui.notify(msg, "info");
      }
    },
  });

  pi.registerCommand("reset-tools", {
    description: "重置工具池回到开局冷启动极简状态",
    handler: async (_args: string, ctx: any) => {
      applyColdStartTrim();
      if (ctx.ui?.notify) {
        ctx.ui.notify("已重置工具池：generate_sla_report 已被重新冷冻！", "warning");
      }
    },
  });
}
