/**
 * ==============================================================================
 * 🎓 老王技术流保姆级教学代码：Pi Agent 最小 SDK 调用闭环 (sdk-chat.mjs)
 * ==============================================================================
 *
 * 💡【写给对 .mjs 不太懂的同学：什么是 .mjs？】
 * ------------------------------------------------------------------------------
 * 1. 扩展名 .mjs 代表 "ECMAScript Module"（ES 原生模块），是现代 JavaScript 的行业标准。
 * 2. 传统 Node.js（.js / CommonJS）用 require() 和 module.exports，而 .mjs 原生支持：
 *    - import { xxx } from "xxx"（编译期静态分析导入，性能更好）
 *    - 顶层 await（Top-level await）：在文件最外层直接用 await，不用再包一层 async function！
 * 3. 严格模式：.mjs 文件默认运行在 JavaScript "严格模式"（strict mode）下，变量必须声明才能用。
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 🛠️ 步骤 0：自动加载环境变量（Node.js 22 原生内置能力）
// ------------------------------------------------------------------------------
import { existsSync } from "node:fs"; // 导入 Node.js 原生文件系统模块中的 existsSync 函数
import { resolve } from "node:path";  // 导入路径解析工具，用于跨平台安全拼接绝对路径

// 依次寻找当前目录、上级目录直到根目录下的 .env 文件
const possibleEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../../../.env"), // 指向 pi-agent-study 根目录
  resolve(process.env.HOME || "", ".my_best/.env"),
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    try {
      // process.loadEnvFile 是 Node 21.7+ 原生内置的加载器，不需要装第三方 dotenv 库！
      process.loadEnvFile(envPath);
      break;
    } catch {
      // 忽略无法读取的路径，继续往下找
    }
  }
}

// ------------------------------------------------------------------------------
// 📦 步骤 1：从 Pi 核心包导入 SDK 核心类与函数
// ------------------------------------------------------------------------------
// 【.mjs 语法点：解构导入 (Named Imports)】
// 从 npm 包 "@earendil-works/pi-coding-agent" 中，按需挑选出我们需要用到的 5 个组件：
import {
  createAgentSession,    // 核心工厂函数：创建并初始化一个 Agent 对话会话
  DefaultResourceLoader, // 资源加载器：负责加载扩展包(Extensions)、自定义技能(Skills)、提示词模板等
  ModelRuntime,          // 模型运行时引擎：负责读取 ~/.pi/agent/ 下的配置与环境变量中的 API Key
  SessionManager,        // 会话管理器：决定会话是存盘到硬盘(~/.pi/agent/sessions)还是纯内存保留
  getAgentDir,           // 工具函数：获取 Pi 的全局配置主目录（默认是用户主目录下的 ~/.pi/agent）
} from "@earendil-works/pi-coding-agent";

// ------------------------------------------------------------------------------
// 🔍 步骤 2：校验运行所需的环境变量
// ------------------------------------------------------------------------------
// process.env 是 Node.js 提供的全局对象，里面存着操作系统和 .env 文件注入的所有环境变量
const provider = process.env.PI_DEMO_PROVIDER || "deepseek";
const modelId = process.env.PI_DEMO_MODEL || "deepseek-v4-flash";

if (!provider || !modelId) {
  // 如果环境变量未设置，主动抛出异常（throw new Error）阻断执行，防止后续报空指针
  throw new Error("❌ 错误：请先设置 PI_DEMO_PROVIDER 和 PI_DEMO_MODEL！");
}

// ------------------------------------------------------------------------------
// 🚀 步骤 3：初始化模型运行时并获取模型实例
// ------------------------------------------------------------------------------
// 【.mjs 语法点：顶层 await (Top-level await)】
// 注意：在 .mjs 顶层可以直接写 await，无需把整段代码包在 (async () => { ... })() 里！
console.log("⚙️  正在初始化 Pi Agent ModelRuntime...");
const modelRuntime = await ModelRuntime.create();

// 从运行时注册表查找指定的提供商与模型（比如 "deepseek" / "deepseek-v4-flash"）
const model = modelRuntime.getModel(provider, modelId);
if (!model) {
  throw new Error(`❌ 未找到模型 [${provider}/${modelId}]，请核对环境变量！`);
}

// ------------------------------------------------------------------------------
// 🧰 步骤 4：配置资源加载器 (ResourceLoader)
// ------------------------------------------------------------------------------
// Pi Agent 默认会自动扫描你机器上的插件、扩展和提示词模板。
// 在这个最小 Demo 中，为了排除干扰，我们显式开启极简模式（noExtensions / noSkills 为 true）。
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),        // 当前工作目录（Current Working Directory）
  agentDir: getAgentDir(),   // Pi 的配置根目录（~/.pi/agent）
  noExtensions: true,        // 不加载任何第三方扩展
  noSkills: true,            // 不加载本地 Skills 技能文件
  noPromptTemplates: true,   // 不加载任何自定义 Prompt 模板
  noThemes: true,            // 不加载终端自定义主题
});

// 异步重载/刷新资源加载器状态
await resourceLoader.reload();

// ------------------------------------------------------------------------------
// 🤖 步骤 5：组装并创建 Agent 会话实例 (createAgentSession)
// ------------------------------------------------------------------------------
// 【.mjs 语法点：对象解构赋值与属性简写 (Shorthand Property)】
// 1. { modelRuntime, model } 是简写，等同于 { modelRuntime: modelRuntime, model: model }
// 2. const { session } = await ... 是解构赋值，表示只从函数返回的结果对象中取出 session 属性
const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  tools: [], // 🎯 关键考点：传空数组说明此时 Agent 没有眼睛和手，纯靠模型大脑文本回复！
  sessionManager: SessionManager.inMemory(), // 会话纯放内存，退出脚本自动销毁，不写磁盘
});

// ------------------------------------------------------------------------------
// 📡 步骤 6：监听流式输出事件（观察者模式 Observer）
// ------------------------------------------------------------------------------
// 【.mjs 语法点：箭头函数 (Arrow Function)】
// `(event) => { ... }` 是现代 JS 的简洁函数写法。
// session.subscribe 会在 Agent 生命周期的每一个瞬间（开始思考、调用工具、生成文本）推送 event。
// 返回的 unsubscribe 是一个取消订阅函数，类似拔掉耳机插头。
const unsubscribe = session.subscribe((event) => {
  // 如果是消息更新事件，且是 Assistant 正在逐字吐出文本片段（text_delta）
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // process.stdout.write 不会自动换行，像打字机一样一个字一个字打在终端屏幕上！
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// ------------------------------------------------------------------------------
// 💬 步骤 7：发送 Prompt 开启 Agent 认知循环
// ------------------------------------------------------------------------------
try {
  console.log(`\n========================================`);
  console.log(`🎯 当前接入模型：${session.model.provider} / ${session.model.id}`);
  console.log(`========================================`);
  console.log(`\n你：你好\nAgent：`);

  // 发送用户提问，触发 Agent 执行 Loop（进入模型推理 ➔ 流式回调 ➔ 收集结果）
  await session.prompt("你好");

  // 【.mjs 语法点：现代数组链式操作与 .at(-1)】
  // filter 筛选出所有角色是 assistant 的回复；
  // .at(-1) 是 ES2022 新语法，直接取数组最后一个元素（比 messages[messages.length - 1] 优雅十倍）！
  const last = session.messages.filter((m) => m.role === "assistant").at(-1);

  // 校验模型结束原因（stopReason），如果是 error 或者 aborted 说明发生异常
  if (!last || ["error", "aborted"].includes(last.stopReason)) {
    throw new Error("❌ 本次请求没有正常完成，请检查模型连接或中断状态！");
  }

  console.log("\n"); // 打印一个空行保持控制台整洁
} finally {
  // ----------------------------------------------------------------------------
  // 🧹 步骤 8：资源释放与清理 (Finally 无论成功失败必定执行)
  // ----------------------------------------------------------------------------
  // 1. 取消事件流监听，防止内存泄露
  unsubscribe();
  // 2. 销毁 session 实例，释放相关句柄与连接
  session.dispose();
  console.log("✅ 会话已安全销毁，退出程序。");
}
