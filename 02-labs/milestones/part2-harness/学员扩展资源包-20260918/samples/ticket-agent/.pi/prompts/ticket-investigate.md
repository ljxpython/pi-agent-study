---
description: 第四章：调查规则、MCP、联网、LSP与子任务
---

现在准备实现支持工单检索与SLA汇总工具。先调查，不修改任何文件。
1. 用todo创建“查明规则、实现三个模块、独立验证”三项任务。
2. 调用memory_read读取long_term；实际调用support_get_policy和support_list_tickets，参数均为空对象，汇报固定当前时间、SLA阈值和记录数。缺工具或调用失败时停止，不编造替代数据。
3. 用web_search（provider为exa）查找TypeScript官方narrowing资料；再用fetch_content读取官方仓库原文：
https://raw.githubusercontent.com/microsoft/TypeScript-Website/v2/packages/documentation/copy/en/handbook-v2/Narrowing.md
说明静态类型收窄为何不能代替运行时日期有效性校验。必须看到可读正文；乱码、空内容或错误页都算失败，不能根据搜索摘要声称读过全文。
4. 先调用subagent的action=list，agentScope=project，确认course-scout存在。再调用course-scout，只读查看AGENTS.md、src/types.ts、src/sla.ts、src/search.ts、src/report.ts，返回待实现函数与关键边界。agentScope=project、async=false、timeoutMs=90000，不创建后台任务。
5. 调用lsp_diagnostics，server=typescript，paths为src/sla.ts、src/search.ts、src/report.ts。
最后用“信息来源｜实际取得的信息｜影响哪一步实现”汇总。任何失败单列，不把角色可发现当作子任务完成。停在调查阶段，等待我继续。
