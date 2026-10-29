/**
 * ==============================================================================
 * 阶段 3：Pi 会话持久化与底层 JSONL 状态树深潜 (03-session-persistence.mjs)
 * ==============================================================================
 * 🎯【认知锚点】：
 * 1. 告别 SessionManager.inMemory()，切换为 SessionManager.create(cwd) 真实磁盘存盘；
 * 2. 探查物理会话文件存储位置（默认按当前目录哈希隔离存放在 ~/.pi/agent/sessions/）；
 * 3. 跑两轮对话，验证上下文跨请求保持；
 * 4. 物理拆解生成的 .jsonl 会话文件：亲眼看 Header 描述符、消息节点、以及类似 Git Commit 的 parentId 链表结构！
 * ==============================================================================
 */

import { existsSync, readFileSync } from "node:fs";
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

console.log("⚙️  [阶段 3] 正在初始化 Pi Agent ModelRuntime...");
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

// ------------------------------------------------------------------------------
// 🎯 核心演进：创建真实磁盘持久化管理器 (SessionManager.create)
// ------------------------------------------------------------------------------
// 传入 process.cwd()，Pi 会自动计算当前项目目录哈希，在 ~/.pi/agent/sessions/ 下建仓！
const sessionManager = SessionManager.create(process.cwd());
const sessionFile = sessionManager.getSessionFile();

console.log("\n==================================================");
console.log(`💾 物理持久化会话已就绪！`);
console.log(`   👉 会话 ID: \x1b[33m${sessionManager.getSessionId()}\x1b[0m`);
console.log(`   👉 磁盘文件: \x1b[36m${sessionFile}\x1b[0m`);
console.log("==================================================\n");

const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  tools: [], // 本实验聚焦会话存储，不挂载工具
  sessionManager, // 👈 挂载真实的磁盘管理器！
});

// 打字机流式输出
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  // 第 1 轮对话：注入记忆
  console.log("--- 【第 1 轮对话：告知个人信息】 ---");
  console.log("你：你好，我叫老李，是个专门做高性能架构的极客。\nAgent：");
  await session.prompt("你好，我叫老李，是个专门做高性能架构的极客。");
  console.log("\n");

  // 第 2 轮对话：验证上下文持久化与记忆召回
  console.log("--- 【第 2 轮对话：测试上下文记忆】 ---");
  console.log("你：你还记得我叫什么名字、是干什么的吗？\nAgent：");
  await session.prompt("你还记得我叫什么名字、是干什么的吗？");
  console.log("\n");

} finally {
  unsubscribe();
  session.dispose();
  console.log("✅ 会话在内存中释放，但磁盘持久化已锁定！");
}

// ------------------------------------------------------------------------------
// 🔬 现场解剖：读取刚才写入磁盘的 .jsonl 文件，带你手撕它的真实结构！
// ------------------------------------------------------------------------------
if (sessionFile && existsSync(sessionFile)) {
  console.log("\n==================================================");
  console.log("🔬 【底层会话文件现场解剖】读取 .jsonl 真实存盘内容：");
  console.log("==================================================");

  const fileRaw = readFileSync(sessionFile, "utf8");
  const lines = fileRaw.trim().split("\n");

  lines.forEach((line, index) => {
    try {
      const entry = JSON.parse(line);
      console.log(`\n📌 [第 ${index + 1} 行 Entry] 类型: \x1b[32m${entry.type}\x1b[0m`);
      if (entry.type === "session") {
        console.log(`   ├─ 协议版本: ${entry.version}`);
        console.log(`   ├─ 工作区 cwd: ${entry.cwd}`);
        console.log(`   └─ 创建时间: ${entry.timestamp}`);
      } else if (entry.type === "message") {
        console.log(`   ├─ 节点 ID: ${entry.id}`);
        // 关键亮点：像 Git Commit 指向 parent 一样，指向父节点 ID！
        console.log(`   ├─ 父节点 parentId: \x1b[33m${entry.parentId || "(根节点 null)"}\x1b[0m 👈 Git 式状态链！`);
        console.log(`   ├─ 角色: ${entry.message.role}`);
        const textPreview = typeof entry.message.content === "string" 
          ? entry.message.content 
          : JSON.stringify(entry.message.content);
        console.log(`   └─ 消息摘要: ${textPreview.slice(0, 80).replace(/\n/g, " ")}...`);
      } else {
        console.log(`   └─ 内容: ${line.slice(0, 100)}...`);
      }
    } catch {
      console.log(`   └─ [原始内容]: ${line}`);
    }
  });

  console.log("\n==================================================");
  console.log("💡 结论：Pi Agent 的会话存储本质就是：");
  console.log("   1. 纯文本追加写入（Append-only JSONL，性能极高，无写锁阻塞）；");
  console.log("   2. 每一行带有 id 和 parentId，天然就是一棵有向无环图（DAG 状态树）；");
  console.log("   3. 分支（Branching）与回滚（Rollback）只要把指针挪到某个 parentId，即可原地分叉！");
  console.log("==================================================\n");
}
