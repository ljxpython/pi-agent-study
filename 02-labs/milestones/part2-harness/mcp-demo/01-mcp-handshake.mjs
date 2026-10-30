/**
 * ==============================================================================
 * Part 2 阶段 1：MCP 协议原始报文对齐与握手解密 (01-mcp-handshake.mjs)
 * ==============================================================================
 * 🎯【老王保姆级认知锚点】：
 * 1. 彻底撕掉 MCP 的神秘面纱：很多机构把 MCP 吹成神，其实底层就是纯粹的 JSON-RPC 2.0 规范！
 * 2. 模拟客户端（Client）：用 Node.js 启动官方 Python 服务，亲历基于 Stdio（标准输入输出）的通信；
 * 3. 搞懂 MCP 核心三步走生命周期：
 *    - 步骤 1: initialize (版本协商与握手)
 *    - 步骤 2: tools/list (外部能力探测，拿到工具名称和 JSON Schema)
 *    - 步骤 3: tools/call (执行工具并获取结构化回包)
 * 4. 彻底攻克 Node.js 底层异步语法：
 *    - 子进程管道 (child_process.spawn)
 *    - 流式数据粘包/半包行切分 (Line-delimited JSON)
 *    - Promise 异步延迟解耦 (Deferred 模式，按消息 ID 唤醒 await)
 * ==============================================================================
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 💡 语法扫盲：ESM 模块中没有 CommonJS 的 __dirname，需要通过 import.meta.url 计算当前脚本所在目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// 💡 相对路径定位官方 Python MCP Server 脚本（严禁硬编码 /Users/... 绝对路径，保证跨机器可运行）
const mcpServerScript = resolve(
  __dirname,
  "../学员扩展资源包-20260918/samples/mcp/mcp-server.py"
);

console.log("==================================================");
console.log("🔌 [阶段 1] 正在拉起 Python 本地 MCP Server 进程...");
console.log(`   脚本路径: ${mcpServerScript}`);
console.log("==================================================\n");

// ------------------------------------------------------------------------------
// 🎯 1. 通过 Stdio 管道启动 Python 子进程
// ------------------------------------------------------------------------------
/**
 * 💡 语法深潜：child_process.spawn(command, args, options)
 * - "python3": 要执行的系统命令
 * - [mcpServerScript]: 传给 python3 的参数列表，即目标 Python 脚本
 * - stdio: ["pipe", "pipe", "inherit"] 这是管道通信的核心配置：
 *   - stdio[0] (stdin 标准输入): "pipe" ➔ 允许我们在 Node.js 中调用 mcpProcess.stdin.write() 往子进程塞数据
 *   - stdio[1] (stdout 标准输出): "pipe" ➔ 允许我们在 Node.js 中监听 mcpProcess.stdout.on("data") 读取子进程返回的数据
 *   - stdio[2] (stderr 标准错误): "inherit" ➔ 如果 Python 脚本报错，直接透传打印在当前终端屏幕上，方便排错
 */
const mcpProcess = spawn("python3", [mcpServerScript], {
  stdio: ["pipe", "pipe", "inherit"],
});

// 💡 维护一个自增的消息 ID，用于在异步请求和回包之间进行一一对应
let messageId = 1;

/**
 * 💡 语法深潜：Deferred Promise 查找表 (pendingRequests)
 * - 痛点：通过管道通信是异步事件流，我们发出了 id=1 的请求，Python 服务端可能在几毫秒后才回包。
 * - 解法：在发请求前创建一个 Promise，把它的 resolve 控制权存进 Map：Map<id, resolveFunction>。
 *   当 stdout 收到对应 id 的回包时，从 Map 拿出这个 resolve 函数一执行，原本 await 的地方瞬间唤醒！
 */
const pendingRequests = new Map();

// ------------------------------------------------------------------------------
// 🎯 2. 监听 MCP Server 的标准输出（处理流式半包/粘包问题）
// ------------------------------------------------------------------------------
let buffer = "";

mcpProcess.stdout.on("data", (chunk) => {
  // 💡 语法深潜：流数据行缓冲（Line Buffer）处理
  // Stdio 是流式传输（Stream），系统一次 push 过来的 chunk 不保证恰好是一整行完整的 JSON！
  // 它可能是半截，也可能连着好几行（粘包）。
  buffer += chunk.toString("utf-8");

  // 按换行符 '\n' 切开成一行一行
  const lines = buffer.split("\n");

  // 关键动作：pop() 拿出数组最后一个元素。
  // 如果最后一行后面没有 '\n'，它就是未接收完的半截数据，留回 buffer 下次继续拼；
  // 如果恰好有 '\n'，pop() 出来的是个空字符串 ""，buffer 刚好被清空。
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue; // 跳过空行
    try {
      // 每行必须是一个标准的 JSON-RPC 响应对象：{"jsonrpc":"2.0", "id": 1, "result": {...}}
      const response = JSON.parse(line);

      // 根据回包的 response.id，在 Map 里寻找是谁在苦苦等待它
      const resolveFn = pendingRequests.get(response.id);
      if (resolveFn) {
        pendingRequests.delete(response.id); // 用完就删，防止内存泄露
        resolveFn(response);                 // 唤醒对应的 sendMcpRequest 的 Promise！
      } else {
        // 如果没有 id，说明这是服务器主动发给客户端的通知（Notification）或广播
        console.log("📩 [收到服务器通知/广播]:", response);
      }
    } catch (err) {
      console.error("❌ 解析 JSON-RPC 响应失败，脏数据行:", line, err);
    }
  }
});

// ------------------------------------------------------------------------------
// 🎯 3. 通用 JSON-RPC 2.0 请求发送封装函数
// ------------------------------------------------------------------------------
/**
 * 💡 协议深潜：MCP 消息结构完全遵照 JSON-RPC 2.0 规范：
 * {
 *   "jsonrpc": "2.0",   // 固定版本协议头
 *   "id": 1,             // 请求唯一追踪编号（用于请求与回包对齐）
 *   "method": "...",     // 调用的远程方法名称
 *   "params": { ... }    // 传入该方法的具体业务参数
 * }
 */
function sendMcpRequest(method, params = {}) {
  const id = messageId++; // 每次发送自增 ID
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  return new Promise((resolve) => {
    // 1. 把当前 Promise 的 resolve 存起来，等待 stdout 事件触发时唤醒
    pendingRequests.set(id, resolve);

    // 2. 将 JSON 对象序列化为字符串，末尾必须加 '\n'（因为 Stdio 按行分割报文）
    const rawLine = JSON.stringify(payload) + "\n";

    console.log(`\n📤 [Client 发送请求 -> Server] 方法: \x1b[36m${method}\x1b[0m (ID: ${id})`);
    console.log(`   报文数据:`, JSON.stringify(payload, null, 2));

    // 3. 写入标准输入流，打给 Python 子进程
    mcpProcess.stdin.write(rawLine);
  });
}

// ------------------------------------------------------------------------------
// 🎯 4. 核心实战：MCP 协议标准生命周期三步走执行流程
// ------------------------------------------------------------------------------

try {
  // ============================================================================
  // Step 1: 协议初始化协商 (initialize)
  // 目的：告诉服务端我是谁、我用什么版本、支持哪些能力，同时获取服务端的基本信息
  // ============================================================================
  console.log("\n--------------------------------------------------");
  console.log("🚀 Step 1: 发起 MCP 协议版本协商与能力探测 (initialize)...");
  console.log("--------------------------------------------------");
  const initRes = await sendMcpRequest("initialize", {
    protocolVersion: "2024-11-05", // 目前 Anthropic 推荐的 MCP 协议基线版本
    capabilities: {
      roots: { listChanged: true }, // 告诉服务端我支持监控根目录变化
      sampling: {},                 // 告诉服务端我支持反向采样（允许服务端向客户端请求模型补全）
    },
    clientInfo: {
      name: "pi-mcp-handshake-client",
      version: "1.0.0",
    },
  });
  console.log("📥 [Server 握手响应]:", JSON.stringify(initRes.result, null, 2));

  // ============================================================================
  // Step 2: 查询外部工具能力清单 (tools/list)
  // 目的：让客户端知道当前这个 MCP 服务端挂载了哪些工具，以及每个工具需要的参数定义
  // ============================================================================
  console.log("\n--------------------------------------------------");
  console.log("🔍 Step 2: 查询 MCP Server 挂载的工具列表 (tools/list)...");
  console.log("--------------------------------------------------");
  const listRes = await sendMcpRequest("tools/list", {});
  console.log(`📥 [Server 返回可用工具数]: ${listRes.result.tools.length} 个`);

  listRes.result.tools.forEach((tool, i) => {
    console.log(`   📌 工具 [${i + 1}]: \x1b[32m${tool.name}\x1b[0m`);
    console.log(`      功能描述: ${tool.description}`);
    console.log(`      参数 Schema (JSON Schema 规范):`, JSON.stringify(tool.inputSchema));
  });

  // ============================================================================
  // Step 3: 执行具体工具调用 (tools/call)
  // 目的：让服务端真正执行指定的业务函数，并返回文本或结构化数据
  // ============================================================================

  // 调用 3.1：读取 SLA 策略与当前基准时间
  console.log("\n--------------------------------------------------");
  console.log("⚡ Step 3.1: 发起真实工具执行调用 (tools/call: get_policy)...");
  console.log("--------------------------------------------------");
  const callRes = await sendMcpRequest("tools/call", {
    name: "get_policy",
    arguments: {}, // 没有额外参数，传空对象
  });
  console.log("📥 [Server 执行结果返回]:");
  console.log(`   是否报错 isError: ${callRes.result.isError}`);
  console.log(`   返回内容 Text:`, callRes.result.content[0].text);

  // 调用 3.2：读取 6 条合成客服工单数据
  console.log("\n--------------------------------------------------");
  console.log("⚡ Step 3.2: 发起真实工具执行调用 (tools/call: list_tickets)...");
  console.log("--------------------------------------------------");
  const ticketsRes = await sendMcpRequest("tools/call", {
    name: "list_tickets",
    arguments: {},
  });
  // 解析回包中 content[0].text 的 JSON 字符串
  const parsedData = JSON.parse(ticketsRes.result.content[0].text);
  console.log(`📥 [Server 成功返回工单数据]: 共 ${parsedData.tickets?.length || 0} 条工单`);
  console.log(`   示例第一条工单数据:`, parsedData.tickets?.[0]);

  console.log("\n==================================================");
  console.log("🎉 [阶段 1 通关] MCP 核心协议三步握手全链路验证成功！");
  console.log("==================================================");
} catch (error) {
  console.error("❌ 握手过程发生异常:", error);
} finally {
  // 💡 优雅关闭：必须杀掉拉起的 Python 子进程，否则它会变成孤儿进程滞留在操作系统后台！
  mcpProcess.kill();
  process.exit(0);
}
