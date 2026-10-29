# 🛠️ Part 1 渐进式实战沙盒：Pi Agent SDK 极简上手与底层深潜

本沙盒严格遵循 **「渐进式里程碑演进原则」**，每一个脚本代表一次认知飞跃与架构升级，绝不互相覆盖。你可以按序号依次执行，亲历从零构建生产级 Agent 的完整心智模型演化！

---

## 🗺️ 阶段路线图 (Evolution Roadmap)

| 阶段 | 脚本文件 | 核心演进点 | 状态机制 | 运行命令 |
|---|---|---|---|---|
| **阶段 1** | `01-minimal-chat.mjs` | **最简纯文本对话**：验证模型连接与 Token 流式透传 | `SessionManager.inMemory()`，无工具调用 | `npm run demo:01` |
| **阶段 2** | `02-tool-dispatch.mjs` | **原子工具装配与生命周期监听**：挂载 `read` 与 `bash`，捕获 `tool_execution_start/end` | 监听 Agent Loop 工具分发事件与自主调用现场 | `npm run demo:02` |
| **阶段 3** | `03-session-persistence.mjs` | **磁盘持久化与底层 JSONL 状态树解密**：会话落盘到 `.sessions/`，探查 Git-like DAG 链表 | `SessionManager.create(cwd, sessionDir)`，物理拆解 Header 与 Entry | `npm run demo:03` |
| **阶段 4** | `04-custom-extension.mjs` | **Extension 扩展系统与 Event Sourcing 状态溯源**：通过 `pi.registerTool` 注册业务工具并解析 `details` | 基于 JSON Schema 校验参数，利用 `details` 实现状态无损存盘与分支溯源 | `npm run demo:04` |

---

## ⚡ 核心概念与架构深度剖析

### 1. 为什么 Pi 的自定义 Tool 必须通过 Extension 注入？
在传统的低代码/拼装式框架中，自定义 Tool 往往只是一个裸字典或函数数组直接塞入 `tools: [myTool]`。
而 Pi 将 **Extension（扩展）** 视为一等公民：
- **能力收敛**：一个 Extension 可以同时注册工具 (`registerTool`)、斜杠命令 (`registerCommand`)、UI 自定义渲染器 (`registerMessageRenderer`)；
- **生命周期解耦**：Extension 具备热重载与独立加载沙箱，通过 `DefaultResourceLoader({ extensionFactories: [...] })` 实现显式装配。

### 2. 神来之笔：Event Sourcing 与 `toolResult.details`
- **传统痛点**：Agent 自定义工具如果把状态写在外部 SQLite 或局部变量中，一旦用户触发历史回溯（Rollback）或开启新的会话分支（Branching），外部数据库的状态便与对话上下文脱节断层！
- **Pi 的优雅解法**：状态即事件（Event Sourcing）。
  在 `04-custom-extension.mjs` 与官方 `todo.ts` 示例中，工具执行产出的结构化数据无损存入 `toolResult.details`，直接持久化在 `.sessions/*.jsonl` 状态树中。
  每次加载会话或分支切换时，只要按顺序重放分支链上的 `details`，当前分支的状态即可瞬时原地复原，零外部数据库依赖！

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 阶段 1：纯文本对话
npm run demo:01

# 阶段 2：内置工具调度与事件捕获
npm run demo:02

# 阶段 3：磁盘持久化与 JSONL 状态树深潜
npm run demo:03

# 阶段 4：自定义扩展与容量估算工具
npm run demo:04
```
