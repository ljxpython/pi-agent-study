/**
 * ==============================================================================
 * 阶段 1：Pi Agent 最小文本闭环 (01-minimal-chat.mjs)
 * ==============================================================================
 * 🎯【认知锚点】：
 * - 理解 ModelRuntime / DefaultResourceLoader / createAgentSession 最小参数契约；
 * - tools: [] 传入空数组，证明没有工具时 Agent 只能做纯文本推理；
 * - sessionManager: SessionManager.inMemory() 纯内存会话，不污染磁盘；
 * - session.subscribe 监听 text_delta 实现打字机流式输出。
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

console.log("⚙️  [阶段 1] 正在初始化 Pi Agent ModelRuntime...");
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

// 🎯 核心：tools 为空数组，纯内存会话
const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  tools: [],
  sessionManager: SessionManager.inMemory(),
});

// 监听流式输出
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  console.log(`\n🎯 接入模型: ${session.model.provider} / ${session.model.id}`);
  console.log(`🛠️  激活工具: [无工具]`);
  console.log(`\n你：你好\nAgent：`);
  await session.prompt("你好");
  console.log("\n");
} finally {
  unsubscribe();
  session.dispose();
  console.log("✅ 会话已安全销毁，退出程序。");
}
