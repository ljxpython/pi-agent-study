# 🛠️ Part 2 渐进式实战沙盒：MCP 协议握手与 Harness 生态

本沙盒严格遵循 **「渐进式里程碑演进原则」**，每一个脚本代表一次认知飞跃与架构升级。你可以按序号依次执行，亲历从零构建生产级 Agent 的完整心智模型演化！

---

## 🗺️ 阶段路线图 (Evolution Roadmap)

| 阶段 | 脚本文件 | 核心演进点 | 状态机制 | 运行命令 |
|---|---|---|---|---|
| **阶段 1** | `01-mcp-handshake.mjs` | **MCP 协议原始报文对齐与握手解密**：拉起 Python 本地 MCP Server，直调 `initialize` ➔ `tools/list` ➔ `tools/call` | 纯 JSON-RPC 2.0 Stdio 管道通信，直观打印每一帧报文 | `npm run demo:01` |
| **阶段 2** | `02-pi-mcp-integration.mjs` | **Pi 扩展与 MCP 协议无缝融合实战**：通过 Extension 工厂动态探测 MCP 工具，注入 Pi 会话驱动模型自主多步推理 | 动态 Tool 注册、自然语言多步决策、Event Sourcing 回溯持久化 | `npm run demo:02` |

---

## 🚀 快速开始

```bash
# 进入沙盒目录
cd 02-labs/milestones/part2-harness/mcp-demo

# 执行阶段 1：MCP 原始协议握手
npm run demo:01

# 执行阶段 2：Pi 扩展与 MCP 协议无缝融合与大模型自主决策
npm run demo:02
```
