/**
 * ==============================================================================
 * 阶段 4：Pi 扩展系统深潜——自定义 Tool 与 Event Sourcing 状态回溯 (04-custom-extension.mjs)
 * ==============================================================================
 * 🎯【认知锚点】：
 * 1. 掌握 Pi 的扩展机制：自定义 Tool 严禁裸写在 tools 数组，必须通过 Extension 注入；
 * 2. 探查 DefaultResourceLoader 的 extensionFactories 工厂函数与 pi.registerTool 核心 API；
 * 3. 亲测“内置工具 (read)”与“自定义业务工具 (calculate_server_capacity)”混合调度；
 * 4. 揭秘 Pi 架构神来之笔：toolResult.details 与 Event Sourcing（事件溯源）状态设计，
 *    为后续类 Git 分支切换与历史穿梭打下底层基石！
 * ==============================================================================
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// 自动寻找并加载 .env 环境变量
const possibleEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../../../.env"),
  resolve(process.env.HOME || "", ".my_best/.env"),
];
for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {}
  }
}

import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const provider = process.env.PI_DEMO_PROVIDER || "xiaok";
const modelId = process.env.PI_DEMO_MODEL || "deepseek-v4.1-flash";

console.log("⚙️  [阶段 4] 正在初始化 Pi Agent ModelRuntime...");
const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(provider, modelId);
if (!model) throw new Error(`未找到模型 [${provider}/${modelId}]，请核对配置！`);

// ------------------------------------------------------------------------------
// 🎯 核心演进：通过 Extension 工厂注册自定义业务工具
// ------------------------------------------------------------------------------
/**
 * 💡 老王架构笔记：
 * 在 Pi Agent 体系中，扩展性是一等公民。
 * 每一个扩展都会收到一个 pi: ExtensionAPI 实例。
 * 扩展可以注册自定义工具 (registerTool)、命令 (registerCommand)、UI 渲染器 (registerMessageRenderer)。
 *
 * 【特别注意 parameters Schema 规范】：
 * parameters 遵循标准的 JSON Schema 规范（无需引入复杂的外部验证器，原生 Object 声明即可）。
 */
const customServerCapacityExtension = (pi) => {
  pi.registerTool({
    name: "calculate_server_capacity",
    label: "微服务容量规划计算器",
    description:
      "根据预期峰值 QPS、单机实测压测极限容量和主备冗余系数，精确计算需要部署的服务器实例数。",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "微服务名称（如 order-service, pay-gateway）",
        },
        targetQps: {
          type: "number",
          description: "预估业务峰值 QPS 总量",
        },
        singleInstanceQps: {
          type: "number",
          description: "单台实例压测得出的安全承载 QPS 上限",
        },
        redundancyRatio: {
          type: "number",
          description: "容灾冗余系数，默认为 1.2（即上浮 20% 防突发流量）",
        },
      },
      required: ["serviceName", "targetQps", "singleInstanceQps"],
    },
    /**
     * 工具真实执行逻辑
     * @param {string} toolCallId - 本次工具调用的唯一 UUID
     * @param {object} params - 模型依据 Schema 提取并校验后的实参
     * @param {AbortSignal} signal - 取消信号（支持任务中途优雅中断）
     * @param {function} onUpdate - 增量输出流（用于长耗时工具向 UI 汇报进度）
     * @param {object} ctx - 扩展上下文（包含当前工作目录 cwd、会话管理器等）
     */
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      console.log(`\n🛠️  [Extension 现场] 捕获到模型调度工具 calculate_server_capacity！`);
      console.log(`   入参详情:`, JSON.stringify(params, null, 2));

      const ratio = params.redundancyRatio || 1.2;
      const baseInstances = Math.ceil(params.targetQps / params.singleInstanceQps);
      const safeInstances = Math.ceil(baseInstances * ratio);

      // 💡 架构硬核细节：details 对象！
      // details 是 Pi 的 Event Sourcing 核心！
      // 它不仅能在 TUI 中被自定义 Renderer 漂亮地渲染出来，更会被无损持久化到 .jsonl 的 toolResult 节点中。
      // 当发生会话分支（Branching）或时光回溯时，Pi 只要按顺序重放 details，就能原地重构出完全正确的内存状态！
      const details = {
        serviceName: params.serviceName,
        targetQps: params.targetQps,
        singleInstanceQps: params.singleInstanceQps,
        redundancyRatio: ratio,
        baseInstances,
        safeInstances,
        calculatedAt: new Date().toISOString(),
      };

      const resultText = `
【容量规划结论】服务名: ${params.serviceName}
- 目标峰值 QPS: ${params.targetQps}
- 单机安全 QPS: ${params.singleInstanceQps}
- 理论最少实例: ${baseInstances} 台
- 容灾冗余实例 (冗余系数 ${ratio}): ${safeInstances} 台
建议：生产部署至少配置 ${safeInstances} 台 Pod，配合 HPA 策略在 CPU > 70% 时动态扩容。
`.trim();

      return {
        content: [{ type: "text", text: resultText }],
        details,
      };
    },
  });
};

// ------------------------------------------------------------------------------
// 🎯 装配 ResourceLoader 并注入自定义扩展工厂
// ------------------------------------------------------------------------------
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  extensionFactories: [customServerCapacityExtension],
});
await resourceLoader.reload();

// ------------------------------------------------------------------------------
// 🎯 会话持久化：依旧保存到本地 .sessions/ 目录，方便事后解密 JSONL
// ------------------------------------------------------------------------------
const projectSessionDir = resolve(process.cwd(), ".sessions");
if (!existsSync(projectSessionDir)) {
  mkdirSync(projectSessionDir, { recursive: true });
}
const sessionManager = SessionManager.create(process.cwd(), projectSessionDir);

// ------------------------------------------------------------------------------
// 🎯 挂载工具集合：混合使用内置工具 "read" 与自定义扩展工具 "calculate_server_capacity"
// ------------------------------------------------------------------------------
const activeTools = ["read", "calculate_server_capacity"];

const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  sessionManager,
  tools: activeTools,
});

console.log(`\n🚀 Pi Agent 4 阶段会话构建完毕！`);
console.log(`   模型: [${provider}/${modelId}]`);
console.log(`   激活工具: [${activeTools.join(", ")}]`);
console.log(`   持久化目录: ${projectSessionDir}\n`);

// ------------------------------------------------------------------------------
// 🎯 订阅生命周期事件，捕捉自定义 Tool 的触发与流式响应
// ------------------------------------------------------------------------------
session.subscribe((event) => {
  switch (event.type) {
    case "tool_execution_start":
      console.log(`\n⚡ [Lifecycle: tool_execution_start]`);
      console.log(`   工具名: ${event.toolName} (CallId: ${event.toolCallId})`);
      break;

    case "tool_execution_end":
      console.log(`✅ [Lifecycle: tool_execution_end]`);
      console.log(`   工具名: ${event.toolName}`);
      break;

    case "message_update":
      if (event.assistantMessageEvent?.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
  }
});

// ------------------------------------------------------------------------------
// 🎯 发送具备业务复杂度的真实提示词，逼出模型调用自定义工具
// ------------------------------------------------------------------------------
const userQuery =
  "老王，我们双十一支付网关 (pay-gateway) 预估全天峰值 QPS 为 36000，" +
  "根据压测报告，单机在 75% 负载下的安全 QPS 为 4000。" +
  "考虑到大促流量脉冲，容灾冗余系数按 1.3 算，请帮我算一下需要几台实例？给出架构部署建议。";

console.log(`👤 用户提问: "${userQuery}"\n`);
console.log(`🤖 Agent 思考与调度中...`);

await session.prompt(userQuery);

console.log(`\n\n🎉 [阶段 4 实战完成] 成功跑通 Pi Extension 自定义工具挂载与全链路调度！`);
