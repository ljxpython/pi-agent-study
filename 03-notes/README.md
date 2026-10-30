# 03-notes 深度研学笔记

## 目录职能说明

这里存放经过人话提纯、直觉重构与技术事实对齐后的真正个人知识沉淀。

- `concepts/`：核心概念专篇。严格按照 `concept-template.md` 黄金标准骨架编写，涵盖动机穿透、时序拓扑、沙盒源码坐标、终端现场证据、Naive vs Production 对比、全量技术事实核对表以及就地嵌入的 Style 2 手账小结卡。
  - [`part1-basics.md`](./concepts/part1-basics.md)：Part 1 原理架构、四大内置工具与会话分支树透析。
  - [`part2-harness.md`](./concepts/part2-harness.md)：Part 2 Harness 生态全景、MCP 协议握手与工单系统实战。
  - [`pi-tools-ecosystem.md`](./concepts/pi-tools-ecosystem.md)：Part 2 专属指南：Pi 工具生态全景、四大寻宝途径、五步选配法与包管理手册。
  - [`part3-custom-extensions.md`](./concepts/part3-custom-extensions.md)：Part 3 定制 Pi Agent：从 Prompt 模板到可安装扩展包。
- `concept-template.md`：概念精讲标准的 Markdown 骨架模板。
- `debug-log.md`：环境搭建、依赖冲突、运行时异常踩坑排障全记录。

## 编写铁律
1. **脱水去噪音**：严禁把靶场的业务逻辑当成核心概念来写，所有笔记必须牢牢锁死在框架的底层运行时与中间件机制上；
2. **严禁宿主机绝对路径**：文件与沙盒代码超链接一律使用相对路径（如 `../../02-labs/...`）；
3. **图文互锁 SSOT**：每个小节讲解末尾，就地嵌入一张对应知识点的手账小结卡，通读单篇即可一站式掌握全部干货。
