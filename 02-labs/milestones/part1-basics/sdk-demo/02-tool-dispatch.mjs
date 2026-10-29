/**
 * ==============================================================================
 * 阶段 2：挂载内置原子工具与生命周期现场抓包 (02-tool-dispatch.mjs)
 * ==============================================================================
 * 🎯【认知锚点】：
 * - tools: ["read", "bash"] 赋予 Agent 真实的“物理眼睛”和“执行触手”；
 * - 拦截 tool_execution_start：亲眼看到模型如何下发工具名与入参；
 * - 拦截 tool_execution_end：亲眼看到 Pi 宿主如何读取本地文件并将 toolResult 喂回模型；
 * - 见证 Agent 状态机循环：用户提问 ➔ 模型决定调工具 ➔ 宿主执行 ➔ 结果喂回 ➔ 综合产出。
 * ==============================================================================
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

// 自动加载 .env 环境变量
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

console.log("⚙️  [阶段 2] 正在初始化 Pi Agent ModelRuntime...");
const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(provider, modelId);
if (!model) throw new Error(`未找到模型 [${provider}/${modelId}]，请核对配置！`);

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

// 🎯 核心演进：挂载 read 和 bash 工具
console.log("🔌 正在创建 Agent 会话并挂载内置原子工具: ['read', 'bash']...");
const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});

// 全生命周期事件拦截
const unsubscribe = session.subscribe((event) => {
  // 1. 模型决定调工具
  if (event.type === "tool_execution_start") {
    console.log(`\n--------------------------------------------------`);
    console.log(`⚡ [事件: tool_execution_start] 模型触发工具调用！`);
    console.log(`   👉 工具名称: \x1b[33m${event.toolName}\x1b[0m`);
    console.log(`   👉 调用参数: \x1b[36m${JSON.stringify(event.args, null, 2)}\x1b[0m`);
    console.log(`--------------------------------------------------\n`);
  }
  // 2. 本地宿主执行工具并产生返回值
  else if (event.type === "tool_execution_end") {
    console.log(`\n--------------------------------------------------`);
    console.log(`✅ [事件: tool_execution_end] 工具执行完毕并回传结果给模型！`);
    console.log(`   👉 工具名称: ${event.toolName}`);
    console.log(`   👉 错误状态: ${event.isError ? "❌ 发生错误" : "🟢 正常完成"}`);
    const preview = JSON.stringify(event.result).slice(0, 150);
    console.log(`   👉 返回内容摘要: ${preview}...`);
    console.log(`--------------------------------------------------\n`);
    console.log(`🤖 Agent 收到工具数据，正在生成最终答复：\n`);
  }
  // 3. 打字机流式生成文本
  else if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  console.log(`\n🎯 接入提供商: ${session.model.provider} | 模型: ${session.model.id}`);
  console.log(`🛠️  已激活工具: ${session.getActiveToolNames().join(", ")}`);
  console.log(`==================================================\n`);

  const userQuestion = "请使用 read 工具查看当前目录下的 package.json 文件，提炼出项目的 name 和核心依赖 dependencies 告诉我。";
  console.log(`你：${userQuestion}\n`);

  await session.prompt(userQuestion);
  console.log("\n");
} finally {
  unsubscribe();
  session.dispose();
  console.log("✅ 会话已安全销毁，退出程序。");
}
