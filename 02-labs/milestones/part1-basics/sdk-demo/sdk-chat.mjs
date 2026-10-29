/**
 * ==============================================================================
 * 🎓 老王技术流实战演练：挂载四大内置工具 (read / bash)，抓取工具调用生命周期现场！
 * ==============================================================================
 *
 * 🎯【本实验目标】：
 * 1. 把 tools: [] 开放为 tools: ["read", "bash"]，赋予 Agent 真实的“物理眼和物理手”；
 * 2. 在 session.subscribe 中拦截工具生命周期三部曲：
 *    - tool_execution_start (模型决定调用工具，携带参数)
 *    - tool_execution_end   (本地工具执行完成，产生返回值)
 *    - message_update       (模型拿到工具返回结果后，继续输出最终分析)
 * ==============================================================================
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ------------------------------------------------------------------------------
// 🛠️ 步骤 0：自动加载环境变量（Node 22 原生内置能力）
// ------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------
// 📦 步骤 1：导入 Pi SDK 核心模块
// ------------------------------------------------------------------------------
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

// ------------------------------------------------------------------------------
// 🔍 步骤 2：读取模型配置（默认使用中转站 xiaok / deepseek-v4.1-flash）
// ------------------------------------------------------------------------------
const provider = process.env.PI_DEMO_PROVIDER || "xiaok";
const modelId = process.env.PI_DEMO_MODEL || "deepseek-v4.1-flash";

console.log("⚙️  正在初始化 Pi Agent ModelRuntime...");
const modelRuntime = await ModelRuntime.create();

const model = modelRuntime.getModel(provider, modelId);
if (!model) {
  throw new Error(`❌ 未找到模型 [${provider}/${modelId}]，请核对 models.json 或 .env 配置！`);
}

// ------------------------------------------------------------------------------
// 🧰 步骤 3：配置资源加载器
// ------------------------------------------------------------------------------
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

// ------------------------------------------------------------------------------
// 🤖 步骤 4：组装 Agent 会话，【核心改变】：挂载 read 和 bash 内置工具！
// ------------------------------------------------------------------------------
console.log("🔌 正在创建 Agent 会话并挂载内置原子工具: ['read', 'bash']...");
const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  // 🎯 核心高亮：开放 read 和 bash。Pi 会自动向 LLM 注入这两个工具的标准 JSON Schema！
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});

// ------------------------------------------------------------------------------
// 📡 步骤 5：全生命周期事件监听（抓取工具调用全过程）
// ------------------------------------------------------------------------------
const unsubscribe = session.subscribe((event) => {
  // 1. 抓现场：工具执行开始（LLM 决策完毕，下发函数调用）
  if (event.type === "tool_execution_start") {
    console.log(`\n\n--------------------------------------------------`);
    console.log(`⚡ [事件: tool_execution_start] 模型触发工具调用！`);
    console.log(`   👉 工具名称: \x1b[33m${event.toolName}\x1b[0m`);
    console.log(`   👉 调用参数: \x1b[36m${JSON.stringify(event.args, null, 2)}\x1b[0m`);
    console.log(`--------------------------------------------------\n`);
  }

  // 2. 抓现场：工具执行结束（本地执行完毕，产出返回值）
  else if (event.type === "tool_execution_end") {
    console.log(`\n--------------------------------------------------`);
    console.log(`✅ [事件: tool_execution_end] 工具执行完毕并回传结果给模型！`);
    console.log(`   👉 工具名称: ${event.toolName}`);
    console.log(`   👉 错误状态: ${event.isError ? "❌ 发生错误" : "🟢 正常完成"}`);
    // 截取前 150 个字符展示，避免大文件撑爆终端日志
    const preview = JSON.stringify(event.result).slice(0, 150);
    console.log(`   👉 返回内容摘要: ${preview}...`);
    console.log(`--------------------------------------------------\n`);
    console.log(`🤖 Agent 收到工具数据，正在生成最终答复：\n`);
  }

  // 3. 抓现场：打字机流式输出文本
  else if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// ------------------------------------------------------------------------------
// 💬 步骤 6：发送具备真实“读文件需求”的 Prompt
// ------------------------------------------------------------------------------
try {
  console.log(`\n==================================================`);
  console.log(`🎯 接入提供商: ${session.model.provider} | 模型: ${session.model.id}`);
  console.log(`🛠️  已激活工具: ${session.getActiveToolNames().join(", ")}`);
  console.log(`==================================================\n`);

  const userQuestion = "请使用 read 工具查看当前目录下的 package.json 文件，提炼出项目的 name 和核心依赖 dependencies 告诉我。";
  console.log(`你：${userQuestion}\n`);

  await session.prompt(userQuestion);

  const last = session.messages.filter((m) => m.role === "assistant").at(-1);
  if (!last || ["error", "aborted"].includes(last.stopReason)) {
    throw new Error("❌ 本次请求没有正常完成！");
  }

  console.log("\n");
} finally {
  unsubscribe();
  session.dispose();
  console.log("✅ 会话已安全销毁，退出程序。");
}
