# 01-resources 学习原料库

## 目录职能说明

这里是所有未经加工的原始资料与课件存放区，也是研学项目的单一事实源 (SSOT) 基座。

- `raw/`：放置原始学习材料（支持 Jupyter Notebook `.ipynb`、Markdown 文档、PDF 课件、压缩包 `.zip`、视频笔记等）。
- `syllabus.md`：Agent 扫描 `raw/` 后的结构化全景学习大纲与进度看板。
- `knowledge-ledger.md`：**全量知识点验台账（防漏学断层定海神针）**。基于 `knowledge-ledger-template.md` 生成，按课件原始小节 100% 逐行登记，涵盖知识点、前置依赖、运行形态与覆盖状态，杜绝偷懒跳讲。
- `knowledge-ledger-template.md`：全量知识台账的标准格式模板。
- `intent-manifest.md`：**技术意图与拓扑角色对账单（防走形定海神针）**。明确记录每一章的技术内核、主控引擎、中间件与被测靶场，防止后续长对话中 Agent 出现局部过拟合或主客颠倒。
- `intent-manifest-template.md`：意图对账单的标准格式模板。

## 导入与初始化指引

将外部课件与源码放入 `raw/` 后，对 Agent 说：
> 💬 **「老王，扫描 01-resources/raw/ 目录，帮我拆解学习大纲 syllabus.md，建立全量知识点验台账 knowledge-ledger.md 与技术意图对账单 intent-manifest.md，100% 捕获所有考点！」**
