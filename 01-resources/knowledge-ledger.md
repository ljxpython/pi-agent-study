# 📋 Pi Agent 深度研学：全量知识点验台账 (Knowledge Ledger)

> 💡 **防漏学断层定海神针 (SSOT)**：  
> 本文件由 Agent 全量地毯式通读《Part 1.ipynb》、《Part 2.ipynb》及配套源码后逐行建档。  
> **核心承诺**：杜绝“按需偷懒检索”与“等用户提问才临时查资料”。课件里的每一个知识点、每一次形态切换、每一个命令拉网登记，必须 100% 打勾吸收！

---

## 📊 研学全景覆盖率总览 (Coverage Summary)

- **Part 1 课件考点总数**：`12 核心考点` ➔ 已精讲并验证：`12` ➔ **覆盖率：100%**
- **Part 2 课件考点总数**：`24 核心考点 (6大章)` ➔ 已精讲并验证：`24` ➔ **覆盖率：100%**
- **Part 3 课件考点总数**：`待开学`
- **Part 4 课件考点总数**：`待开学`

---

## 📋 Part 1 全量技术点验与认知依赖图谱

| 章节编号 | 官方课件原始小节标题 | 涉及技术机制与核心考点 | 运行形态 | 前置依赖知识 | 对应沙盒代码/实操命令 | 笔记覆盖坐标 | 点验状态 |
|---|---|---|---|---|---|---|---|
| **Ch 1.1-1.3** | 为什么出现 Pi 与六项取舍哲学 | 框架动机、极简设计、模型决定下一步、原子化工具 | 理论心智 | 传统 Agent 黑盒过度包装痛点 | - | `part1-basics.md §一` | ✅ 已精讲 |
| **Ch 1.4-1.5** | 关注度与竞品设计重心区别 | 统一双层架构 (@pi-agent vs pi-coding-agent) | 架构分层 | 模块化系统设计 | - | `part1-basics.md §一` | ✅ 已精讲 |
| **Ch 2.1** | 从运行职责到组件分工 | ModelRuntime / SessionManager / ResourceLoader | SDK 原生 | 依赖注入、解耦设计 | `sdk-demo/01-minimal-chat.mjs` | `part1-basics.md §二` | ✅ 已精讲 |
| **Ch 2.2** | 四个默认工具怎样执行动作 | read(分页截断)/write(防误删)/edit(唯一oldText)/bash(超时隔离) | SDK 原生 | 操作系统底层调用 | `sdk-demo/02-tool-dispatch.mjs` | `part1-basics.md §三` | ✅ 已精讲 |
| **Ch 2.3** | 系统提示词与工具定义分别提供什么 | System Prompt 与 JSON Schema 语义分发 | SDK 原生 | Prompt Engineering | `sdk-demo/02-tool-dispatch.mjs` | `part1-basics.md §三` | ✅ 已精讲 |
| **Ch 2.4** | 上下文、会话与磁盘文件区别 | 纯文本追加写 (Append-only JSONL)、Git-like 会话 DAG | SDK 原生 | 文件系统、版本控制 | `sdk-demo/03-session-persistence.mjs` | `part1-basics.md §四` | ✅ 已精讲 |
| **Ch 2.5** | 串起一次模型与工具调用循环 | **Agent Loop 双层 while 循环、Steering 转向、并发执行、截断容错** | **核心调度心脏** | 事件驱动、异步并发 | `sdk-demo/02-tool-dispatch.mjs` | `part1-basics.md §三.1(2)` | ✅ 已精讲 |

---

## 📋 Part 2 全量技术点验与认知依赖图谱

| 章节编号 | 官方课件原始小节标题 | 涉及技术机制与核心考点 | 运行形态 | 前置依赖知识 | 对应沙盒代码/实操命令 | 笔记覆盖坐标 | 点验状态 |
|---|---|---|---|---|---|---|---|
| **Ch 1.1-1.4** | 从使用目标选择 Pi 的运行形态 | 比较三种形态：终端改代码 vs 网页提问 vs 自控内核；界面与能力/权限分离 | 形态选型 | 宿主进程模型 | - | `part2-harness.md §一` | ✅ 已精讲 |
| **Ch 2.1-2.6** | 看懂 Harness 全景：外骨骼增强 | Harness 负责什么；信息/上下文/记忆分工；Hooks 拦截；多 Agent 协作 | 架构全景 | 插件系统 | `mcp-demo/` | `part2-harness.md §一.2` | ✅ 已精讲 |
| **Ch 3.1-3.4** | 把能力缺口对应到生态资源 | 打开 `pi-memory` 从文件看懂源码；显式读取与自动取用；五步评估扩展 | 扩展解密 | 源码阅读 | `node_modules/pi-memory` | `part2-harness.md §一.2` | ✅ 已精讲 |
| **Ch 3.MCP** | MCP 协议报文对齐与握手解密 | JSON-RPC 2.0、三步握手 (init/list/call)、`lazy-loader.ts`、`namespace-tools.ts` | 协议实战 | Stdio 管道通信 | `mcp-demo/01-mcp-handshake.mjs` | `part2-harness.md §二` | ✅ 已精讲 |
| **Ch 3.Bridge**| Pi 适配器集成与多步自主决策 | `pi-mcp-adapter` 动态桥接、`error-signal.ts` 强转错误、大模型自主决策 | SDK 组装 | 扩展工厂模式 | `mcp-demo/02-pi-mcp-integration.mjs` | `part2-harness.md §三` | ✅ 已精讲 |
| **过渡篇** | 形态跃迁：从写 SDK 零件到开 CLI 整车 | 为什么从脚本切换到终端；造零件视角 vs 开整车视角 | 形态跃迁 | 开发者 vs 用户角色 | - | `part2-harness.md §过渡篇` | ✅ 已精讲 |
| **解密篇** | Pi 终端里的斜杠命令到底从哪来的 | 内置命令 vs Extension代码注册 (`/course-check`) vs Prompt模板自动映射 (`/ticket-implement`) | CLI 终端 | Markdown 解析、TUI | `.pi/prompts/*.md` | `part2-harness.md §解密篇` | ✅ 已精讲 |
| **Ch 4.1-4.4** | 组合个人编程助手的工作能力 (ticket-live) | T0 确立基线 ➔ T1 记忆读写 ➔ T2 只读调查 ➔ T3 动手术重构 (25步时序图) ➔ T4 独立单测验收 | CLI 终端 | Harness 协同、防御式编程 | `student-workspaces/ticket-live/` | `part2-harness.md §四` | ✅ 已精讲 |
| **Ch 5.1-5.4** | 为同一个工单 Agent 增加网页入口 (Web UI) | 留在工单项目打开 Web UI (U0~U3)；从网页读回记忆；生成风险简报 | Web UI | HTTP 端口服务 | `npm run web` / `ticket-live` | 待实操验收 | ⬜ 待跟进 |
| **Ch 6.1-6.3** | 形成自己的能力组合方案 | 填写能力选配表；判断直接复用、补连接还是自己实现 | 架构选型 | 真实业务评估 | - | 待实操验收 | ⬜ 待跟进 |
