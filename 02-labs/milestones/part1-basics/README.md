# Part 1 核心实战代码演进指南 (SDK 渐进式三阶演练)

为了避免在同一个文件上反复修改导致知识增量模糊，本实验目录将 Pi Agent 的核心运行机制拆解为 **3 个从简单到复杂的独立演进里程碑**：

---

## 📂 演进代码文件清单

```text
sdk-demo/
├── 01-minimal-chat.mjs         # 🟢 阶段 1：最小纯文本交互 (tools: [], inMemory)
├── 02-tool-dispatch.mjs        # 🟡 阶段 2：挂载原子工具与拦截 (tools: ["read", "bash"])
└── 03-session-persistence.mjs  # 🔴 阶段 3：真实磁盘持久化与 Git 式状态树解剖
```

---

## 🚀 极速运行与阶段对照

在 `02-labs/milestones/part1-basics/sdk-demo/` 目录下，直接运行对应的阶段脚本：

### 1. 阶段 1：最小纯文本交互（空工具数组）
```bash
npm run demo:01
```
- **核心考点**：`tools: []` 空工具数组。
- **现象验证**：Agent 处于纯大脑推理状态，手上没有任何物理读写能力。

### 2. 阶段 2：长出手眼与工具拦截
```bash
npm run demo:02
```
- **核心考点**：`tools: ["read", "bash"]`。
- **现象验证**：捕获 `tool_execution_start` 和 `tool_execution_end`，见证模型主动调 `read` 工具读取 `package.json`，宿主安全执行并喂回数据。

### 3. 阶段 3：会话持久化与状态树深潜
```bash
npm run demo:03
# 或直接 npm start
```
- **核心考点**：`SessionManager.create(process.cwd())`。
- **现象验证**：
  1. 跨轮对话上下文自动继承（记住“老李”）；
  2. 探查物理会话存盘路径：`~/.pi/agent/sessions/<hash-dir>/<timestamp>_<id>.jsonl`；
  3. 现场解剖纯文本追加式（Append-only）JSONL 结构，亲眼见证类似 Git Commit 的 `id ➔ parentId` 树形链！
