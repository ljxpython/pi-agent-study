---
description: 第四章：实现三个模块并验证
---

继续实现本项目。你是唯一代码写入者，只能修改src/sla.ts、src/search.ts、src/report.ts；不要修改测试、数据、配置、类型定义或入口，不安装依赖，不提交或推送。
先读AGENTS.md和现有测试，执行npm test、npm run test:edge、npm run typecheck记录初始失败。再次调用memory_read读取排序约定，support_get_policy读取政策，support_list_tickets读取样本；失败时停止。
实现：关键词trim后忽略大小写，团队精确匹配，状态默认all，各条件取交集；关闭工单不超时，未来时间年龄为0，非法日期抛RangeError，恰好阈值不算超时，阈值从policy参数取值，不硬编码，不修改输入数组或对象。
按过滤后的记录产生total、overdue、byTeam、rows。排序按记忆中的约定。团队名为任意字符串，正确处理__proto__、constructor、toString。
逐条执行npm test、npm run test:edge、npm run typecheck、npm run demo、npm run check:protected；再次运行lsp_diagnostics检查三个实现文件，用git diff -- src和git status --short核对修改范围。
调用course-reviewer作只读复核，agentScope=project、async=false、timeoutMs=90000。提供三个实现文件、test/report.test.ts、test/adversarial.test.ts的位置，以及规则与实际验证结果；不让它写代码。逐项核验它的意见，必要时由你修正，再重复受影响检查。
最后列出真实检查结果、演示输出、修改文件、各扩展实际贡献与未验证项。只有实际完成的事项才更新todo；子任务失败就保留失败，不用主Agent换个称谓冒充。先不写长期记忆。
