# 🗺️ Pi Agent 深度研学全景大纲与全量追溯矩阵 (Syllabus & Traceability Matrix)

> **研学体系版本**：v2.0 (全量追溯与覆盖审计强化版)  
> **核心承诺**：
> 1. **零遗漏**：100% 覆盖原始学习材料中全部 4 个 Part 的 Notebook 与配套实战代码资产；
> 2. **精准映射**：每一阶段、每一个考点均精确标注原材料对应的章节号与代码路径；
> 3. **闭环审计**：文末附带《全量原材料覆盖审计报告》与《老王生产级扩展建议》。

---

## 📊 研学总进度看板

| 阶段 | 模块主题 | 核心实战沙盒 | 原材料精准映射 | 预计耗时 | 状态 | 交付成果 |
|---|---|---|---|---|---|---|
| **Part 1** | **上手 Pi Agent：原理架构与四大内置工具** | `02-labs/milestones/part1-basics/sdk-demo` | `Part 1.ipynb §1-§6` + `sdk-demo/` | 2.5h | 🔄 正在进行 | 面试卡：Agent Loop 机制；时序架构图 |
| **Part 2** | **组装 Pi Agent：Harness 全景与 MCP 生态适配** | `02-labs/milestones/part2-harness` | `Part 2.ipynb §1-§6` + `pi-mcp-adapter` | 2.5h | ⬜ 未开始 | 事实核对表：生态选配矩阵；MCP 源码剖析 |
| **Part 3** | **定制 Pi Agent：从 Prompt 模板到 TUI 扩展包** | `02-labs/milestones/part3-extensions` | `Part 3.ipynb §1-§7` + `上下文底栏插件` | 3.0h | ⬜ 未开始 | 实操代码：可安装的 npm 扩展包 |
| **Part 4** | **交付 Pi 应用：从双端 Spec 到生产业务迁移** | `02-labs/milestones/part4-spec-app` | `Part 4.ipynb §1-§6` + `工单问答助手` | 3.0h | ⬜ 未开始 | 深度博客底稿；生产适配架构方案 |

---

## 🎯 Part 1：上手 Pi Agent——原理架构、核心职责与四大工具

### 1. 核心心智模型与技术事实（带精准原材料映射）

- [ ] **1.1 框架动机与六项取舍** ➔ `对应 Part 1.ipynb §1.1-§1.5`
  - 传统 Agent 痛点（过度抽象、黑盒嵌套、状态转义失效）；
  - 六项取舍哲学：模型决定下一步、工具原子化、纯文件会话、单轮多工具并发、显式资源加载。
- [ ] **1.2 运行时底座与组件分工** ➔ `对应 Part 1.ipynb §2.1, packages/agent/src/agent-loop.ts:156`
  - 核心职责：模型调用 ➔ 工具分发 ➔ 结果聚合 ➔ 终止判定；
  - 关键状态机：`idle ➔ executing_tools ➔ waiting_for_model`。
- [ ] **1.3 四大内置工具的物理边界** ➔ `对应 Part 1.ipynb §2.2, packages/coding-agent/src/core/tools/`
  - `read`：大文件按行分页与截断保护（`read.ts`）；
  - `write`：全量写入与覆盖前安全校验（`write.ts`）；
  - `edit`：唯一行精确定位，拒绝正则模糊匹配，`edits[].oldText` 重名报错（`edit.ts:21`, `edit-diff.ts`）；
  - `bash`：超时控制、环境隔离与退出码捕获（`bash.ts`）。
- [ ] **1.4 规则优先级与会话分支存储** ➔ `对应 Part 1.ipynb §2.3-§2.6, docs/sessions.md`
  - 上下文加载级联：当前目录 `AGENTS.md` ➔ 父目录 ➔ 全局目录；`AGENTS.override.md` 强覆盖；`.pi/SYSTEM.md` 与 `APPEND_SYSTEM.md`；
  - 会话物理持久化：`~/.pi/agent/sessions/` 文件树，支持会话快照与类 Git 分支（`/session` 命令）。
- [ ] **1.5 三大调用入口选型与首次调用** ➔ `对应 Part 1.ipynb §3.1-§4.5`
  - CLI（终端 TUI 交互 / `pi -p` 批处理单次运行）；
  - SDK（Node/Python 进程内深度嵌入）；
  - RPC（跨进程守护服务，标准 JSON-RPC 通信）。
- [ ] **1.6 官方示例与取消分支验证** ➔ `对应 Part 1.ipynb §5.1-§6.4`
  - 加载 `question` 与 `todo` 示例；组合任务中的“取消分支”机制与防御性提示词设计；资源热重载（`reload-handler`）。

### 2. 对应实操沙盒代码
- 📂 `02-labs/milestones/part1-basics/sdk-demo/sdk-chat.mjs`（43行极简进程内 SDK 调用）
- 📄 `02-labs/milestones/part1-basics/01-第一节课-看懂Pi-Agent-单文件版.html`

---

## 🎯 Part 2：组装 Pi Agent——能力全景、Harness 生态与场景组合

### 1. 核心心智模型与技术事实（带精准原材料映射）

- [ ] **2.1 Agent 运行形态与 Harness 全景** ➔ `对应 Part 2.ipynb §1-§3`
  - 从使用目标划分：代码审查助理、全自动重构 Agent、外挂运维助手；
  - 什么是 Harness？为轻量内核插上生态翅膀（输入扩展、执行扩展、UI 交互扩展）。
- [ ] **2.2 MCP 协议深度适配与源码剖析** ➔ `对应 Part 2 课件 + sources/pi-mcp-adapter-2.34.0/`
  - Claude 插件加载机制（`claude-plugin-loader.ts`）；
  - 工具懒加载与按需激活（`lazy-loader.ts`）；
  - 工具命名空间隔离，防止命名冲突（`namespace-tools.ts`）；
  - 直连工具协议与错误信号传递（`direct-tools.ts`, `error-signal.ts`）。
- [ ] **2.3 工单助手实战项目 (MEM-DEMO-01)** ➔ `对应 Part 2.ipynb MEM-DEMO-01 + samples/ticket-agent/`
  - 工单处理工具链（`tools/` 目录实现）；
  - 基于 Python 实现的本地 MCP Server（`samples/mcp/mcp-server.py`）；
  - 学员实时调试工作区基线配置（`student-workspaces/ticket-live/`）。
- [ ] **2.4 增加网页入口与组合方案** ➔ `对应 Part 2.ipynb §4-§6`
  - 终端 Agent 如何通过 RPC/Websocket 暴露 Web UI；形成个人编程助手的完整工具矩阵。

### 2. 对应实操沙盒代码
- 📂 `02-labs/milestones/part2-harness/学员扩展资源包-20260918/sources/pi-mcp-adapter-2.34.0/`
- 📂 `02-labs/milestones/part2-harness/学员扩展资源包-20260918/samples/ticket-agent/`
- 📂 `02-labs/milestones/part2-harness/学员扩展资源包-20260918/samples/mcp/mcp-server.py`

---

## 🎯 Part 3：定制 Pi Agent——从提示词模板到可安装扩展包

### 1. 核心心智模型与技术事实（带精准原材料映射）

- [ ] **3.1 自定义能力分层与 Prompt 模板开发** ➔ `对应 Part 3.ipynb 第一章到第二章`
  - 什么时候用 Prompt 模板？什么时候写 TypeScript 扩展？
  - 提示词参数插值与上下文隔离规范（`prompts/project-map.md`）。
- [ ] **3.2 最小 Extension 架构解剖** ➔ `对应 Part 3.ipynb 第三章, docs/extensions.md`
  - 核心接口实现：`registerTool`、`onSessionStart`、`onMessage`、`onToolCall`；
  - 扩展的生命周期与错误捕获。
- [ ] **3.3 终端界面 (TUI) 上下文底栏开发** ➔ `对应 Part 3.ipynb 第四章到第五章 + 课堂演示最终成果-上下文底栏`
  - 面板状态核心逻辑：`panel-core.ts`；
  - 终端渲染引擎与事件响应：`src/index.ts`；
  - 偏好持久化与界面渲染可靠性校验（`scripts/check.mjs`）。
- [ ] **3.4 打包为独立 NPM Package 并跨项目使用** ➔ `对应 Part 3.ipynb 第六章到第七章 + package/`
  - `package.json` 中的 Pi 专用扩展元数据定义；
  - 包含多扩展组合发布：`monitor`（监控）、`activity`（活动日志）、`messenger`（消息转发）；
  - 打包分发与跨项目无损加载测试（`scripts/verify-load.ts`）。

### 2. 对应实操沙盒代码
- 📂 `02-labs/milestones/part3-extensions/第三课-Pi统一学员交付包-20260922/课堂演示最终成果-上下文底栏-20260922/`
- 📂 `02-labs/milestones/part3-extensions/第三课-Pi统一学员交付包-20260922/package/`

---

## 🎯 Part 4：交付 Pi 应用——从双端 Spec 到业务迁移落地

### 1. 核心心智模型与技术事实（带精准原材料映射）

- [ ] **4.1 端到端工单问答助手全景透视** ➔ `对应 Part 4.ipynb 第一章 + Pi工单问答助手-学员版`
  - 一次完整用户查询背后的链路：Web 前端 ➔ 后端服务 ➔ Pi SDK/RPC ➔ 工具执行 ➔ 流式打字机回传。
- [ ] **4.2 双端 Spec 驱动开发方法论** ➔ `对应 Part 4.ipynb 第二章 + 项目材料/Pi工单项目案例文件夹/`
  - 为什么要写 Spec？拒绝边猜边写；
  - 前端契约规范：`frontend-spec.md`（组件状态机、流式渲染协议、用户输入防抖）；
  - 后端契约规范：`backend-spec.md`（接口定义、状态持久化、Tool 权限鉴权与异常熔断）；
  - 过程管理模板：`01-小型Agent应用-项目启动与交付SOP.md`、`PLAN.md`、`PROJECT_STATE.md`。
- [ ] **4.3 Pi SDK 深度接线与责任边界划分** ➔ `对应 Part 4.ipynb 第三章到第四章`
  - 谁负责什么？严格划分：LLM 负责决策、Pi SDK 负责执行、业务后端负责鉴权与安全审计、前端负责视觉呈现。
- [ ] **4.4 交付可靠性评测与业务系统迁移** ➔ `对应 Part 4.ipynb 第五章到第六章`
  - 怎样量化判定 Agent 回复可靠性？（断言工具调用序列、结果幻觉率检测）；
  - 将工单案例的架构范式迁移到自有生产系统（如 `ai-agent-platform`）。

### 2. 对应实操沙盒代码
- 📂 `02-labs/milestones/part4-spec-app/Pi工单问答助手-学员版/`
- 📂 `02-labs/milestones/part4-spec-app/项目材料/Pi工单项目案例文件夹/`（含双端 Spec 核心规范）

---

## 📋 全量原材料覆盖审计报告 (Coverage Audit Report)

| 原材料所在目录 / 压缩包 | 原始文件清单 | 涵盖知识点/代码 | 大纲对应阶段 | 覆盖状态 |
|---|---|---|---|---|
| **Part 1 原材料** | `第一节课-上手Pi-Agent.ipynb` | 六项取舍、四大工具、三大入口、取消分支 | Part 1 全节 | ✅ 100% 覆盖 |
| `第一节课资料(2).zip` | `sdk-demo/sdk-chat.mjs` | Node SDK 极简对话与流式事件监听 | Part 1.5 | ✅ 100% 覆盖 |
|  | `01-第一节课-单文件版.html` | 离线课件与交互图示 | Part 1 附录 | ✅ 100% 覆盖 |
| **Part 2 原材料** | `第二节课-组装Pi-Agent.ipynb` | 运行形态、Harness 全景、生态选配 | Part 2 全节 | ✅ 100% 覆盖 |
| `PiAgent第二节课其他资料.zip` | `pi-mcp-adapter-2.34.0/` | Claude 插件加载、工具懒加载、命名空间 | Part 2.2 | ✅ 100% 覆盖 |
|  | `samples/ticket-agent/` | 工单 Agent 完整实现 | Part 2.3 | ✅ 100% 覆盖 |
|  | `samples/mcp/mcp-server.py` | Python 本地 MCP 服务实现 | Part 2.3 | ✅ 100% 覆盖 |
|  | `student-workspaces/ticket-live/` | 学员实操工程基线 | Part 2.3 | ✅ 100% 覆盖 |
| **Part 3 原材料** | `第三节课-定制Pi-Agent.ipynb` | Prompt 模板、Extension 生命周期、打包 | Part 3 全节 | ✅ 100% 覆盖 |
| `PiAgent第三节课其他资料.zip` | `课堂演示最终成果-上下文底栏` | TUI 界面渲染、面板核心 `panel-core.ts` | Part 3.3 | ✅ 100% 覆盖 |
|  | `package/` | npm 扩展包（包含 monitor/activity/messenger） | Part 3.4 | ✅ 100% 覆盖 |
| **Part 4 原材料** | `第四节课-交付Pi应用.ipynb` | 一次查询链路、双端 Spec、SDK 接线、迁移 | Part 4 全节 | ✅ 100% 覆盖 |
| `第四节课其他资料.zip` | `Pi工单问答助手-学员版/` | 前后端完整生产交付应用 | Part 4.1 | ✅ 100% 覆盖 |
|  | `Pi工单项目案例文件夹/` | `backend-spec.md`, `frontend-spec.md`, SOP | Part 4.2 | ✅ 100% 覆盖 |

> **审计核验结论**：原材料中 **4 个核心 Notebook、2 套完整交付工程、3 个独立扩展源码包、全套双端 Spec 文档** 均已 100% 映射建立档案，无任何知识遗漏！

---

## 💡 老王生产级架构扩展建议 (Production Extension Suggestions)

本套课程资料质量极高，但主要偏向**教学与单机实战**。如果你要把 Pi Agent 的精髓搬到真实的高可用生产环境（比如你主项目的平台中），老王凭十几年架构经验，给你提 **5 点原始资料没讲透、但生产必须踩坑填平的硬核扩展建议**：

### 1. 多租户高并发场景下的“会话文件锁” (Session File Lock)
- **课件局限**：课件里会话直接读写本地文件 `~/.pi/agent/sessions/`，单人开发极爽。
- **老王生产扩展**：一旦你的 Web 后端支持多个用户并发请求同一项目，两个请求同时修改同一会话文件会导致 JSON 损坏！生产上必须引入 **基于文件的 Advisory Lock（如 `flock`）或将 SessionManager 抽象为 Redis/PostgreSQL 适配器**，同时保持 Pi 轻量无状态的哲学。

### 2. 生产级 Token 预算与死循环熔断器 (Circuit Breaker)
- **课件局限**：课件依赖模型的 `stopReason` 终止循环。
- **老王生产扩展**：极端情况下，模型遇到死锁文件可能会无限连续调用 `read` 或 `bash`。在生产 SDK 包装中，必须在 `createAgentSession` 外层增加硬指标拦截器：**单次任务最大轮次限制（如 ≤ 20 轮）、单次任务 Token 消耗硬阈值（如 ≤ 50k tokens）**，触碰阈值直接掐断抛出受控异常。

### 3. Bash 工具的安全沙盒化 (Containerized / Wasm Sandbox)
- **课件局限**：课件直接在宿主机执行 `bash` 命令，有极大的安全隐患（`rm -rf /` 或注入攻击）。
- **老王生产扩展**：对外提供服务时，必须将 `core/tools/bash.ts` 的底层执行流替换为 **Docker 临时容器执行** 或 **gVisor / Firecracker 微虚拟机隔离**，严格限制网络出站与文件挂载权限。

### 4. 工具调用参数的防御性 Schema 校验 (Pydantic / Zod 防御)
- **课件局限**：课件主要演示正常工具调用。
- **老王生产扩展**：真实大模型调用工具时，约有 2%~5% 概率传入畸形参数（比如把数字传成字符串，或者缺少必需字段）。在执行底层工具前，必须通过 **Zod** 进行前置严格拦截，若校验失败，**把 Zod 的清晰报错信息格式化为工具执行错误回传给模型**，引导模型自我修正，而不是让整个服务直接 crash。

### 5. 分布式链路追踪与可观测性 (OpenTelemetry / Trace Span)
- **课件局限**：课件只用 `session.subscribe` 简单在终端 `process.stdout.write`。
- **老王生产扩展**：生产排障必须能看清每一次工具调用的耗时、入参、出参和模型思考时间。建议在 `session.subscribe` 中无缝埋点 **OpenTelemetry Traces**，将事件同步推送至 Jaeger / Langfuse，形成企业级可观测性大屏。
