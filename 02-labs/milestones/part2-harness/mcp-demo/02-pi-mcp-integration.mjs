/**
 * ==============================================================================
 * Part 2 阶段 2：Pi 扩展与 MCP 协议无缝融合实战 (02-pi-mcp-integration.mjs)
 * ==============================================================================
 * 🎯【老王保姆级认知锚点】：
 * 1. 跨越鸿沟：阶段 1 只是用裸代码发 JSON-RPC，本阶段把外部服务变成 Pi 智能体的原生工具！
 * 2. 解答核心困惑：
 *    - `(pi) => { pi.registerTool(...) }` 到底是个啥？（它是扩展工厂 ExtensionFactory）
 *    - 为什么有 `DefaultResourceLoader`？（它是 Pi 的总资源管家，负责发现与加载工具）
 *    - 为什么最终组装只要传字符串数组 `activeTools = ["read", "get_policy", ...]`？
 *      （因为工具已经在 ResourceLoader 里登记了，这里只是设置本会话的“工具白名单”）
 * 3. 亲历大模型自主思考与工具调度：
 *    - 用户只提自然语言：“排查紧急工单是否违反 SLA”；
 *    - 大语言模型自主分析，并发决定调用 `get_policy` 获取时钟和阈值，再调 `list_tickets` 获取列表；
 *    - 避开 5 大工业级真实陷阱（时区、关闭工单缺失时间戳、未来脏数据等）。
 * ==============================================================================
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 💡 计算当前脚本所在目录的绝对路径，确保后续相对定位永不失效
const __dirname = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------------------
// 🎯 1. 环境变量自动发现与加载（方便支持用户的自定义模型 API-Key）
// ------------------------------------------------------------------------------
/**
 * 💡 为什么要有这几行？
 * 因为大家通常把大模型的 API_KEY、BASE_URL 放在 `.env` 文件里。
 * Node.js >= 20 提供了原生的 process.loadEnvFile()，我们自动扫描项目根目录或全局目录下的 .env，
 * 避免学习者因为“没配环境变量”导致运行失败。
 */
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

// 从 Pi SDK 核心包中导入必须的 5 个关键构件
import {
  createAgentSession,     // 创建智能体单次交互会话的工厂函数
  DefaultResourceLoader,  // 资源总管家（负责挂载 Skill、扩展 Extension、Prompt 模板）
  ModelRuntime,           // 模型运行时（负责向大模型供应商发起 HTTP 请求与流式解析）
  SessionManager,         // 会话持久化管理器（负责把对话历史保存到磁盘的 .jsonl 文件中）
  getAgentDir,            // 获取 Pi 全局配置目录 (~/.pi/agent) 的辅助函数
} from "@earendil-works/pi-coding-agent";

// ------------------------------------------------------------------------------
// 🎯 2. 面向对象封装：SimpleMcpClient（基于 Stdio 的轻量长连接客户端）
// ------------------------------------------------------------------------------
/**
 * 💡 为什么要把阶段 1 的裸函数封装成一个 Class？
 * - 单一职责（KISS 原则）：把底层的进程拉起、JSON-RPC 编码解码、管道数据拼接全部收拢在类内部；
 * - 向上暴露简单优雅的高阶异步 API：`start()`、`listTools()`、`callTool(name, args)`、`stop()`。
 */
class SimpleMcpClient {
  constructor(serverScriptPath) {
    this.serverScriptPath = serverScriptPath; // Python 脚本的物理路径
    this.process = null;                      // 子进程实例引用
    this.messageId = 1;                       // JSON-RPC 消息追踪自增 ID
    this.pending = new Map();                 // 异步等待队列：Map<id, resolveFunction>
    this.buffer = "";                         // 接收管道数据的行缓冲区
  }

  /**
   * 启动 Python 子进程并完成 initialize 握手
   */
  async start() {
    this.process = spawn("python3", [this.serverScriptPath], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    // 监听 Python 服务端回包
    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString("utf-8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop(); // 留下最后未换行的半截数据防粘包

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const res = JSON.parse(line);
          const resolveFn = this.pending.get(res.id);
          if (resolveFn) {
            this.pending.delete(res.id);
            resolveFn(res); // 唤醒正在 await 当前 id 的 Promise
          }
        } catch (err) {
          console.error("❌ 解析 MCP JSON 响应失败:", line, err);
        }
      }
    });

    // 握手初始化（MCP 协议强制第一步）
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "pi-integration-client", version: "1.0.0" },
    });
  }

  /**
   * 底层通用请求发送器（返回一个等待响应的 Promise）
   */
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      this.pending.set(id, resolve);
      const raw = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      this.process.stdin.write(raw, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /**
   * 探测 MCP 服务对外暴露的所有可用工具
   * @returns {Promise<Array>} 工具对象列表 [{ name, description, inputSchema }]
   */
  async listTools() {
    const res = await this.request("tools/list");
    return res.result?.tools || [];
  }

  /**
   * 实际调用服务端指定的工具
   * @param {string} name - 工具名称（如 "get_policy"）
   * @param {object} args - 传给工具的具体参数
   */
  async callTool(name, args = {}) {
    const res = await this.request("tools/call", { name, arguments: args });
    return res.result;
  }

  /**
   * 优雅终止子进程，释放系统资源
   */
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// ------------------------------------------------------------------------------
// 🎯 3. 拉起 MCP 进程并动态发现外部工具
// ------------------------------------------------------------------------------
// 定位 Python MCP Server 脚本
const mcpServerScript = resolve(
  __dirname,
  "../学员扩展资源包-20260918/samples/mcp/mcp-server.py"
);

const mcpClient = new SimpleMcpClient(mcpServerScript);
await mcpClient.start();

// 动态向服务端发起 tools/list 探测
const discoveredTools = await mcpClient.listTools();
console.log(`🔌 [MCP 服务在线] 发现 ${discoveredTools.length} 个可用外部工具:`);
for (const t of discoveredTools) {
  console.log(`   👉 工具名: \x1b[32m${t.name}\x1b[0m | 描述: ${t.description}`);
}

// ------------------------------------------------------------------------------
// 🎯 4. 核心解密：定义 Pi 扩展工厂 (mcpExtensionFactory)
// ------------------------------------------------------------------------------
/**
 * 💡 语法解密：什么是 `const customExtension = (pi) => { pi.registerTool(...) }`？
 *
 * 1. 为什么叫“工厂函数（Factory Function）”？
 *    因为 Pi 的架构遵循控制反转（IoC，Inversion of Control）。
 *    我们不直接操作 Pi 的内部变量，而是把这个函数交给 Pi 的 ResourceLoader。
 *    当 ResourceLoader 启动或 reload() 时，Pi 会把自己的核心扩展接口 `pi: ExtensionAPI`
 *    作为参数传进这个函数中执行！
 *
 * 2. 可以一次定义多个工具吗？
 *    【必须可以，而且通常就是这么干的！】
 *    看下方的代码：我们在工厂函数内部写了一个 for 循环，一次性遍历所有从 MCP 发现的工具，
 *    连续调用多次 `pi.registerTool(...)`，一次性把 10 个甚至 50 个工具全部注册进 Pi！
 *
 * 3. `pi.registerTool({ ... })` 的 4 个核心字段：
 *    - name: 工具唯一标识符（模型通过它来决定调用谁）；
 *    - description: 工具的功能描述（极其重要！模型就是靠阅读这段文本来理解何时调用该工具）；
 *    - parameters: 参数的 JSON Schema 规范（告诉模型入参需要什么结构，如 string、number、object）；
 *    - execute: 工具被真正触发时的执行逻辑回调函数。
 */
const mcpExtensionFactory = (pi) => {
  for (const mcpTool of discoveredTools) {
    pi.registerTool({
      name: mcpTool.name,
      description: mcpTool.description,
      // 直接把 MCP 返回的 inputSchema 中的 properties 映射为 Pi 的入参规范
      parameters: {
        type: "object",
        properties: mcpTool.inputSchema?.properties || {},
        additionalProperties: false,
      },

      /**
       * 💡 语法深潜：execute 回调的四个入参
       * @param {string} toolCallId - 本次模型工具调用的唯一 UUID（如 "call_00_xyz"）
       * @param {object} params - 模型依据上面的 parameters 提取出的实参对象
       * @param {AbortSignal} signal - 取消信号（如果用户中途按 Ctrl+C，此信号会 abort）
       * @param {function} updateCallback - 增量进度汇报回调（长耗时任务向终端发进度条用）
       */
      async execute(toolCallId, params, signal, updateCallback) {
        console.log(`\n⚡ [Pi Agent Loop] 捕获到模型调度工具: \x1b[35m${mcpTool.name}\x1b[0m (ID: ${toolCallId})`);
        console.log(`   模型传入实参:`, params);

        // 核心动作：通过我们上面写的 mcpClient，把调用打给远端 Python 进程
        const callResult = await mcpClient.callTool(mcpTool.name, params);

        // 从 MCP 返回的 content 数组中提取纯文本结果
        const textContent = callResult?.content
          ?.map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n") || "";

        /**
         * 💡 架构硬核细节：为什么必须返回包含 details 的对象？
         * - content: 送给大模型看的文本结果，模型依据这段文字进行后续推理；
         * - isError: 标记当前工具执行是否失败；
         * - details: 这是 Pi 架构的灵魂 —— 【Event Sourcing（事件溯源）】！
         *   details 里的完整结构化数据会被 100% 无损写入 .sessions/*.jsonl 磁盘中。
         *   当发生会话分支（Branching）或会话时光倒流回放时，Pi 不需要重新请求 Python 服务，
         *   直接读取历史 details 就能瞬间原地重构出完全正确的内存状态！
         */
        return {
          content: [{ type: "text", text: textContent }],
          isError: callResult?.isError || false,
          details: {
            origin: "mcp-server.py",
            protocolVersion: "2024-11-05",
            raw: callResult,
          },
        };
      },
    });
  }
};

// ------------------------------------------------------------------------------
// 🎯 5. 核心解密：为什么要有 DefaultResourceLoader？
// ------------------------------------------------------------------------------
/**
 * 💡 语法解密：ResourceLoader 是个啥？
 * 它是 Pi 的【全局资源总管家】！
 * 一个成熟的 Agent 宿主需要加载：
 * - 规则文件 (AGENTS.md)
 * - 提示词模板 (Prompt Templates)
 * - 技能包 (Skills)
 * - 扩展工具 (Extensions)
 *
 * 为什么这里要写：noSkills: true, noPromptTemplates: true, noThemes: true？
 * 答：为了【纯净沙盒隔离】！在我们的实战教学中，我们故意关闭自动发现，
 * 只显式传入 `extensionFactories: [mcpExtensionFactory]`，
 * 确保环境里只有我们亲手写的这几个 MCP 工具，杜绝其他杂七杂八的插件干扰学习。
 */
const provider = process.env.PI_DEMO_PROVIDER || "xiaok";
const modelId = process.env.PI_DEMO_MODEL || "deepseek-v4.1-flash";

console.log(`\n⚙️  [初始化] 加载大模型 runtime: [${provider}/${modelId}]...`);
const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(provider, modelId);
if (!model) throw new Error(`未找到模型 [${provider}/${modelId}]，请核对环境变量！`);

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),                       // 当前运行目录
  agentDir: getAgentDir(),                  // Pi 的用户目录 (~/.pi/agent)
  noSkills: true,                           // 教学隔离：不自动加载全局技能
  noPromptTemplates: true,                  // 教学隔离：不自动加载提示词模板
  noThemes: true,                           // 教学隔离：不加载主题
  extensionFactories: [mcpExtensionFactory],// 注入我们刚写好的 MCP 扩展工厂！
});
// 必须调用 reload()，它会依次执行所有的 extensionFactories，完成工具的真正装载
await resourceLoader.reload();

// ------------------------------------------------------------------------------
// 🎯 6. 会话持久化管理器装配 (SessionManager)
// ------------------------------------------------------------------------------
/**
 * 💡 为什么要有这一段？
 * Pi 与市面上所有框架最大的不同：【零外部数据库依赖，全靠纯文件持久化】！
 * 会话会以增量追加的 JSONL 文件保存在当前目录的 .sessions/ 中。
 */
const sessionDir = resolve(process.cwd(), ".sessions");
if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
const sessionManager = SessionManager.create(process.cwd(), sessionDir);

// ------------------------------------------------------------------------------
// 🎯 7. 核心解密：为什么最后只要传字符串数组 activeTools？
// ------------------------------------------------------------------------------
/**
 * 💡 语法解密：为什么 `activeTools` 只需要写 `["read", "get_policy", ...]`？
 *
 * 用户困惑：“组装的时候，只需要使用这种字符串就可以了吗？”
 * 答：【对！只需要字符串！】
 * 因为所有的工具定义（Schema、执行函数 execute）早在上面的步骤中，
 * 就已经通过 `pi.registerTool` 注册进了 `resourceLoader` 的内部大字典里了！
 *
 * 这里的 `tools: activeToolNames` 实际上是一个【权限白名单】！
 * 意思是：虽然你系统里可能注册了 100 个工具，但在当前这个会话中，
 * 我只允许模型看到并调用白名单里的这几个工具，防止模型注意力分散或乱调越权！
 */
const activeToolNames = ["read", ...discoveredTools.map((t) => t.name)];
console.log(`🛠️  [工具装配] 激活工具白名单: [${activeToolNames.join(", ")}]\n`);

// 创建真正的智能体交互会话
const { session } = await createAgentSession({
  modelRuntime,
  model,
  resourceLoader,
  sessionManager,
  tools: activeToolNames, // 传入激活的白名单工具名称数组
});

// ------------------------------------------------------------------------------
// 🎯 8. 响应式事件流监听 (session.subscribe)
// ------------------------------------------------------------------------------
/**
 * 💡 语法解密：Agent 的生命周期事件是如何流转的？
 * 当调用 session.prompt() 时，内部的响应式状态机会依次发射以下事件：
 * 1. "message_start" (role: assistant): 模型开始准备推理了；
 * 2. "message_delta": 模型流式输出的文字 Token；
 * 3. "tool_execution_start": 模型决定调用某个工具，开始执行；
 * 4. "tool_execution_end": 工具执行结束，把数据回填给模型；
 * 5. 模型拿到工具结果，开启第二轮推理；
 * 6. "agent_end": 本轮多步推理完成，闭环退出。
 */
session.subscribe((event) => {
  switch (event.type) {
    case "message_start":
      if (event.message?.role === "assistant") {
        console.log("🤖 [Agent 思考引擎启动] 开始多步推理与决策...");
      }
      break;

    case "tool_execution_start":
      console.log(`\n🔍 [模型调度工具] 目标: \x1b[33m${event.toolName}\x1b[0m (ID: ${event.toolCallId})`);
      console.log(`   模型提取参数:`, JSON.stringify(event.params, null, 2));
      break;

    case "tool_execution_end":
      console.log(`✅ [工具执行完毕] \x1b[32m${event.toolName}\x1b[0m 结果已回填入 Agent Loop`);
      break;

    case "message_delta":
      if (event.delta?.text) {
        // 流式实时打印文字增量
        process.stdout.write(event.delta.text);
      }
      break;

    case "agent_end":
      console.log("\n🏁 [Agent 本轮交互闭环]\n");
      break;
  }
});

// ------------------------------------------------------------------------------
// 🎯 9. 提交自然语言 Prompt，检验 Agent 自主多步编排与业务排查能力
// ------------------------------------------------------------------------------
const prompt =
  "请先通过工具读取公司的 SLA 政策阈值和当前基准时间，然后获取积压工单列表。" +
  "请重点排查：有哪几条属于紧急工单（priority 为 urgent）？" +
  "根据创建时间和当前时间计算等待时长，判断它们是否已经违反了 SLA？" +
  "请输出一个清晰的 Markdown 结果表格并给出建议。";

console.log("==================================================");
console.log(`💬 [User Prompt]: ${prompt}`);
console.log("==================================================\n");

try {
  // 把问题丢给 Agent Session，底层自动启动【模型推理 ➔ 调工具 ➔ 回填 ➔ 终审报告】的多步循环
  await session.prompt(prompt);

  // 从会话状态中取出最后一条助手的回复，确认完整报告
  const messages = session.state.messages;
  const lastMessage = messages[messages.length - 1];
  console.log("==================================================");
  console.log("📋 [Pi Agent 最终回复报告]:");
  console.log("==================================================");
  if (lastMessage?.content) {
    for (const part of lastMessage.content) {
      if (part.type === "text") {
        console.log(part.text);
      }
    }
  }
} finally {
  // 💡 保证稳健性：无论大模型是否报错，finally 块确保必须杀掉 Python 子进程，防进程孤儿泄露
  mcpClient.stop();
  console.log("\n🧹 [资源清理] 已优雅终止 Python MCP Server 子进程。");
}
