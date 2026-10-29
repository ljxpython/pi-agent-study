# 支持工单检索与SLA汇总工具
只修改 src/sla.ts、src/search.ts、src/report.ts；禁止修改测试、配置、数据及其余文件。无需安装依赖。
需求：关键词trim后忽略大小写匹配标题，team精确匹配，status默认all，所有条件取交集；overdueOnly只返回超时工单。关闭工单永不超时；未来时间ageHours为0；无效日期抛RangeError。SLA阈值来自MCP的policy，恰好等于阈值不算超时。排序规则从项目长期记忆读取。不得修改原数组或对象。
Report统计过滤后的total、overdue、byTeam，并返回排序后的rows。通过 npm test、npm run test:edge、npm run typecheck、npm run demo、npm run check:protected 检查。
必须观察工具结果，不将工具安装或Todo完成当作验收。使用只读scout调查、reviewer复核；主Agent唯一写入。只访问教学工作区和已指定官方技术资料，不进行Git提交、推送。

先确认 memory_status 指向本项目 .course-memory。MCP为本地合成教学数据，不是真实企业数据库。只读角色位于 .pi/agents，调用时 agentScope="project"。禁止把未调用工具写成已完成。
