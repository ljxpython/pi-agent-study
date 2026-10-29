# Pi 工单助手 · 里程碑与执行计划 v1.4

更新2026-09-22。全项目唯一执行计划。前端合同见[frontend-spec](../03-方案与设计/frontend-spec.md)，后端见[backend-spec](../03-方案与设计/backend-spec.md)。用户已授权持续实现M2—M6。当前M2—M6实现与本机验收已完成：75项后端、33项前端测试及check/build，17组浏览器替身、5组恢复、9步骤同机干净复现通过；真实资源、补规则正负样本、无资料及/report对话、浏览器确认保存/下载/重启通过。两路接受当前生产修订；独立Agent隔离接手补验通过。真人学员、跨平台及断电耐久未验证。后文历史阶段说明保留其原时间范围。

2026-09-23接续：前端工作台边界与对话布局 v1.8 已按[frontend-spec §十六](../03-方案与设计/frontend-spec.md)实现候选并完成隔离本地验证，状态与逐 AC 开放项见[验收记录](../06-验收与交付/验收摘要-学员版.md)顶部和[本轮清单](../06-验收与交付/验收摘要-学员版.md)。本计划仍是唯一跨阶段执行计划；正式 `5179` 尚为旧构建，真机软键盘与用户复看未完成，历史 M1/M2—M6 PASS 不继承为本增量通过。

## 当前里程碑与依赖

沿用原 M1—M6 编号，不把本次聊天中的五步概括当作新的编号体系。M1a/M1b 是已有演示，M1c 是新增前端。产品范围已确认不等于各阶段已实现。

| 节点 | 开始前准备与依赖 | 要交付的内容 | verify：阶段验收 | 当前状态 |
|---|---|---|---|---|
| M1a/M1b 既有前端 | 原四图、演示数据、原 AC | 三栏、资料、问答、报告与设置演示 | 原 AC01—08；历史证据见验收记录，历史审核只覆盖各自快照；v1.7增量审核见当前回执 | 已有代码，非后端 |
| M1c 能力库前端 | 用户已确认范围；读取前端 §十二；原代码回归基线 | 顶部能力库、模板列表/查看/编辑/恢复默认、Skill 详情、正斜杠补全 | AC09—12；键盘/IME/窄屏/未保存退出；演示标识保持 | 本地实现通过；v1.7增量已获两路审核及用户接受 |
| M2 SDK 与资源底座 | 锁定 SDK、两个模板和一个 Skill；冻结模型配置及预算；后端规划转执行规格 | 真实资源目录、模板持久化与生效、最小 SDK 会话和模型测试 | B01—05/B12；真实模板更改影响下一请求；错误与停止探针 | 已完成；真实资源、模板/Skill及两种连接测试通过 |
| M3 前后端联通 | M2 最小真实探针；冻结接口 DTO、事件及本地访问边界 | 用 HTTP/SSE 替换演示适配器、上传与请求状态接通 | B05/B06/B08/B11；断连/busy/未知命令，不回退假数据 | 17组浏览器替身及真实模型主流程通过，未知受理、断连与重启已覆盖 |
| M4 真实工单任务 | M3；冻结时效与异常口径、报告样例 | 查询→分诊→有来源回答→报告草稿 | B04/B06—08；独立工单金标，模板与 Skill 的真实使用证据 | 已完成；三工具、模板/Skill、U01补规则正负样本及/report追问通过 |
| M5 确认与文件交付 | M4 草稿及内容哈希；保存中断实验 | 确认后保存 Markdown、预览/下载 | B09/B11；取消、超时、重复确认、响应丢失不重复写 | 真实页面确认/磁盘一致下载/重启通过；五处进程中断和关联损坏拒绝通过，不主张断电耐久 |
| M6 恢复与学员交接 | M5；冻结持久化/恢复关联与数据格式 | 重启恢复、README、脱敏资源和干净环境复现 | B10；旧批准失效、数据/报告来源一致、独立接手 | 已完成本机交接；9步骤干净安装、5组恢复、独立Agent隔离17组接线通过；非真人学员实测 |

M1c及v1.5/v1.6前端本地实现已完成，用户于2026-09-21明确前端先告一段落；后续仍需补足独立审核；不因界面可点击而提前标记 M2 完成。后端只读技术核验可独立进行，运行实验和代码实现仍按阶段授权与冻结合同推进。

## 分工与写入边界

- 主控维护需求、Spec、PLAN 和入口，裁决范围与证据；实现阶段只指定一名代码写入者，不多人同时改共享文件。
- 前端范围：`05-工作产物/frontend/src/` 及必要测试、README；沿用原生 TypeScript，不因新增弹窗重写框架。
- 后端目标：`05-工作产物/backend/`（已创建并锁定依赖）；当前主控唯一写入，精确改动与测试见本页末尾。资源建议放在该应用受控项目目录，不改全局 Pi 文件。
- 审查者只读，沿用 DeepSeek＋GLM；本轮对v0.4同一哈希发起只读审查，当前结果与归属以PROJECT_STATE及阶段审核回执为准。阶段审核失败不得伪造通过，仍可继续不依赖该结论的文档工作。
- 验收责任归主控：实现者跑相关测试；主控核实文件与结果，再做浏览器/真实 SDK 联调；用户审核阶段可见效果。测试设计采用输入与独立预期，不照抄实现。

M1c 建议检查：在 frontend 运行 `npm run check`、`npm test`、`npm run build`；用现有浏览器脚本补足能力库和命令菜单断言。后端测试命令在 package.json 与执行 Spec 建立后冻结，现在不写成已存在命令。

## 历史 M1 执行记录

以下是各次快照的真实历史，不能作为新 M1c 或后端阶段的 PASS。

1. 准备：保存四张原图、哈希和范围，独立设计审及Fresh Executor。verify：引用真实且AC自足。
2. M1a：唯一执行writer实现05-工作产物/frontend/{package.json,package-lock.json,tsconfig.json,index.html,.gitignore,src/domain.ts,src/demo.ts,src/main.ts,src/style.css,src/icons.ts,tests/domain.test.ts,README.md}，先校验器测试红→绿，再页面选择/上传/设置。verify：check/test/build，主控浏览器点测与DeepSeek/GLM阶段审核。修复仍归同writer。
3. M1b：同writer完成演示对话/报告/取消停止；主控编写06-验收与交付/browser_test.py，运行全流程，保留关键截图。双模型独立审计本阶段，quality与异源审按用户批准的DeepSeek＋GLM组合执行。
4. 收口：检查实际文件、版本、AC、剩余mock与README；登记INDEX与项目状态，回填验收记录/复用回执。review不是自动业务验收；不提交Git、不部署。

执行环境：Node26.0.0/npm11.12.1，本机Python Playwright；端口先检测再占用，不结束其他项目进程。依赖锁定；无模型业务调用预算、无外部业务写入。
停止条件：越界写、关键契约矛盾、真实凭据风险、不可用的必需审核依赖。其余独立工作继续。恢复从项目入口、候选哈希和真实运行结果核对，不继承自报PASS。

执行回填：准备、M1a、M1b实现与主控测试已完成，DeepSeek与GLM最终回执均为APPROVE。18单测、12组主流程浏览器、4组边界浏览器通过；临时干净目录安装与构建通过。用户最终视觉验收PENDING，真实后端另里程碑。不执行Git提交或发布。

2026-09-21小范围修整（用户已授权，主控唯一writer）：
- step：修复有限查询边界、统一notice/status来源、输入局部更新并保留资源按钮、删除无用字段和图标；不改CSS、依赖、后端边界。
- verify：查询反例先红后绿；19项单测及check/build；浏览器检查键盘焦点、输入节点身份、切资料提示、原全链与安全边界；DeepSeek/GLM只读复核。当前结果以验收记录本轮追加段为准，旧审核仅对应旧快照。

本轮收口：实现与19单测/check/build、12full+7edge浏览器已通过；DeepSeek/GLM因402及备用401均未完成有效审核，保留MODEL_REVIEW_INCOMPLETE。详见验收记录和既有阶段审核回执，不继承旧PASS。

2026-09-21 v1.2资料优先改版：主控单写移除能力目录/选择状态/拖拽协议/权限开关；业务查询与报告内置；新增明确标识的/query与/report演示快捷方式。需求与设计同步SDK价值路线，后端仅调研和候选设计。verify：20单测、check/build、12full+8edge浏览器；检查没有工具卡片，仅选资料可完成查询与报告；命令未知/参数拒绝，确认和busy保护保持。Luna补充审核不替代先前不可用的DeepSeek/GLM门。

## M1c本轮执行（2026-09-21）

顺序：需求/设计/Spec同步及两张图入项目 → resources目录与匹配单测 → 能力库/补全/主界面接入 → check/test/build → 原full/edge及M1c浏览器 → DeepSeek/GLM只读审核 → 状态/README/验收回填。主控负责即时实现与验收；两模型是独立复核，不授予写入。

精确源码write set：frontend下src/resources.ts、src/resource-ui.ts、src/main.ts、src/demo.ts、src/style.css、tests/domain.test.ts、README.md；不改依赖和后端。证据write set：06下browser_m1c_test.py、m1c-browser-results.json、screenshots/m1c-*.png、final-source-manifest.json、验收记录.md；原浏览器脚本生成的既有结果/截图可按当前快照刷新。项目文档/状态/审核回执由主控同步。

运行命令沿用本页M1c清单。保存先校验、关闭保护及选中不发送作为必测；DeepSeek/GLM不可用时保留不完整，不把历史APPROVE迁移成本版通过。

本轮结果：文档先同步后实现，23单测/check/build通过；M1c 12组＋full 12组＋edge 8组浏览器通过。DeepSeek/GLM各一次402失败，审核INCOMPLETE；不推进后端。验收与哈希以06目录当前版本为准。

本轮v1.5：先同步§十三→主控单写src/layout.ts、main.ts、style.css及README→更新原折叠验收预期并新增browser_layout_test.py→运行相关与原回归→回填证据。第四项只做产品建议，不接后端。侧栏约束和资料语义测试优先，无依赖新增。

v1.5收口：23单测、check/build、36组浏览器检查通过，源码清单与机器状态校验；独立审核本轮未运行，既有402限制保留。等待用户体验反馈，后端未启动。

v1.6：需求/前后端Spec同步→主控修改demo.ts常见问题分支及main.ts首页提示，复用resource-ui.ts填入草稿保护→单测及无资料浏览器验证→原相关回归与证据回填。无真实模型或后端写入。

v1.6收口：24单测/check/build、37组浏览器通过。截图复查修正手机首页新增按钮过高造成的顶部裁切：快捷问题横排、居中溢出时安全起始对齐，再跑无资料与边界测试通过。需求、前后端Spec及README同步；真实模型、系统提示词加载和独立双模型审核未完成。

前端阶段复盘收口：已整理学员决策案例及既有复盘§十，两条新增经验后经用户批准已发布至工程规范v0.3；源码未改，不重跑应用测试，不启动后端。用户阶段收口不豁免未完成审核。

## 当前后端Spec收敛顺序（2026-09-21）

1. step：确定空闲模板保存、Markdown交付、内存密钥；verify：需求与前后端Spec无相反合同。本轮已同步。
2. step：明确状态所有者、确认/取消、恢复及接口候选；verify：逐条对应B01—B19，标记待探针事项。已形成v0.4五项候选，未冻结执行。
3. step：DeepSeek＋GLM只读独立审查；verify：取得针对同一正文与SHA的可执行意见。前轮两路402仅属历史；本轮核对实时名册及工具面后审查，不预判结果。
4. step：按依赖冻结SDK版本、模型协议与预算、HTTP/事件/恢复等技术项，明确探针和执行写集合；verify：证据与剩余风险可核对后，再进入M2实施授权。当前未运行SDK探针，未实现后端。

2026-09-21后续收敛：Spec v0.3确定SDK精确0.85.1与当前CLI对齐；真实应用测试选Pi预设tongba/glm-5.3（openai-completions），先普通问答、再只读工具闭环；初始预算及其实现验证见Spec§九。接口和恢复暂不冻结。Tongba两路子代理连通性本轮各一次401，非Spec审核通过；Pi调用链未测试。

### v0.4本轮step × verify（文档范围）

| step | verify与状态 |
|---|---|
| 核对基线、源码及SDK静态接口 | 15文件哈希匹配；后端目录不存在；0.85.1签名已读。未重跑浏览器、未运行SDK |
| 收敛SDK隔离→请求同步→业务规则→保存恢复→前端替换五项合同 | Spec§十逐项有理由、失败与反例；用户已确认对话补规则，阈值/closed口径等仍为建议 |
| 指定DeepSeek＋GLM对同一哈希只读审查，主控裁决 | 当前回执记录实际成功/失败及最终文档哈希；不将文字审查当真实探针 |
| M2前继续冻结最小资源与模型适配合同 | 必须明确离线检查与真实预算探针；本轮不安装、不实现、不运行计费探针；M3—M6未知按依赖关闭 |

资源保存需与发送共用串行闸门；请求受理持久化与恢复合同在M2适配设计时预留，M3联通前验证，不能拖到M6才首次考虑。SDK/文件系统探针均等待实施授权，文档候选不授予执行权限。

v0.4本轮回填：送审SHA 93373350…fda86已获DeepSeek/GLM意见；主控按实际源码拒绝GLM的noTools=all建议，经一次定向复核更正，接受状态歧义与字段补充。v0.4最终文档哈希见阶段审核回执backend_spec_v0_4；当时最终增量仅主控核对，非双路重新通过。两路身份仍requested_only；前端独立审、应用GLM与后端探针均未由此补足。

### 能力库范围补充的下一步（不新增里程碑编号）

1. step：同步五类目录、仅模板可编辑、只读关联导航；verify：需求、前后端Spec一致且不新增全局发现/权限开关。本轮文档已同步，源码未改。
2. step：依据frontend-spec§十五制作一张能力库弹窗视觉候选，保留现有风格，展示五类导航与关联详情；verify：能看懂只读边界、来源与关联；合成资源显式标设计示例。当前图片未生成，待视觉讨论，不代表新增前端实现授权。
3. step：视觉方向确认后再按明确授权安排局部前端增量；M2/M3承接目录和实际加载状态；verify：AC19—21及相关原行为回归，真实后端证据单独获取。M1 v1.6既有阶段收口保持，不继承旧审核作为新增功能通过。

本次采用既有Y模型检查来源、状态与可操作性，ROI裁剪为目录与关联浏览；不增安装管理、代码编辑、Skill编辑、测试控制台或新的后端平台。当前实现与计费探针授权仍未开放。


## M1 前端v1.7能力库完善（当前授权，2026-09-21）

后端讨论延期；用户已批准两张能力库图和本轮前端实施。采用dev-team resume、tier3，沿用用户指定DeepSeek＋GLM设计/Fresh Executor及实现审，覆盖Skill默认固定审核路由；MMO实时名册选择唯一代码writer，主控维护文档与验收。已有能力回归：三栏/资料/演示查询/报告确认/设置/两模板+Skill命令；真正待建：五类目录、只读元信息、关系跳转/返回、多包与成员筛选。

| step | verify |
|---|---|
| 保存两图、冻结frontend-spec §十五AC19—24 | 图集阶段07原字节一致；Spec与用户决定一致，设计/Fresh Executor明确结论 |
| 单writer先补目录/关联/补全隔离测试，再实现五类弹窗 | 红→绿记录；仅模板可编辑、关系不会执行、数量来自真实示例目录 |
| 完整相关回归与独立审核 | npm test/check/build；full、edge、M1c、help、layout及新增library浏览器断言；桌面/390px截图人工核对 |
| 主控收口现有文档和证据 | 当前源码manifest、验收、README与状态一致；未完成审核与后端mock如实标记 |

代码writer精确write set（均相对项目根）：
- 05-工作产物/frontend/src/resources.ts
- 05-工作产物/frontend/src/resource-ui.ts
- 05-工作产物/frontend/src/main.ts
- 05-工作产物/frontend/src/demo.ts
- 05-工作产物/frontend/src/style.css
- 05-工作产物/frontend/tests/domain.test.ts
- 05-工作产物/frontend/README.md
- 06-验收与交付/browser_m1c_test.py
- 06-验收与交付/browser_library_test.py

不得改依赖、全局配置、业务domain/layout或后端。主控拥有Spec/PLAN/状态/图集/验收及脚本产生的证据；测试脚本由代码writer编写。非Git源码以canonical SHA256清单冻结，不复制历史代码，不提交Git。失效关联/空筛选/dirty离开/忙状态/非法模板为本阶段失败矩阵；缓存、网络重试与跨标签同步未引入，不伪造相应验收。

M1 v1.7收口：实际修改7文件（精确列表见验收回执），main.ts和browser_m1c_test.py保持不变。主控在writer停写后重跑27单测/check/build、full12+edge8+M1c12+help5+layout4+library9，共50组浏览器PASS。两路最终源码审APPROVE，完整21文件源码/测试清单已更新；不把该结果提升为M2或真实SDK通过。下一步由用户查看前端，再另行讨论后端；当前不自动启动后端。

本轮后端讨论接续：step＝对齐v1.7实际目录→裁决真实包/扩展与报告工具→冻结DTO及分析依据→确认保存恢复合同→同版独立审查；verify＝Spec无相反合同、待定项不伪装决定、审核绑定版本。当前仅文档核验和修改；用户计划晚间实现不等于已授权开始M2。前端既有测试本轮未重跑。

报告工具已裁决：M2目录及注册纳入prepare_report，M4验证结构化草稿无写盘，M3接入时显示第三个只读工具，M5验证用户确认才保存；本轮不修改前端或后端业务代码。

Spec标准接续：已读取dev-team十二件套、工程语义清单与审核协议；按既有项目requirement讨论推进，不重新立项。step＝补精确DTO/错误映射、状态失效及并发矩阵、M2—M6进入/停止条件；verify＝B01—19对应直接证据与受影响文件，未决项逐项关闭或明确探针门，不以文档决定替代运行通过。用户已确认禁止自动发现，仅显式加载项目受控扩展；SDK入口和最终工具白名单待M2验证。

M4时效判定规则已获用户确认：step＝实现严格大于阈值及状态/缺规则分支；verify＝等于阈值未超时、超过1ms超时、未来异常、closed不适用、缺规则not_evaluated且普通查询可用。此为验收预期，尚未运行。确认有效期随后已由用户确定为10分钟；重新申请保存随后也已获用户确认。

M5期限合同已定：step＝采用服务端10分钟有效期及刷新不续期；verify＝截止前1ms/恰好截止/截止后、旧标签迟到、到期前已进入saving、到期保留预览与释放忙锁。期限单测用可控时钟，浏览器验证投影；本轮只记录预期，不冒充测试通过。

M5重新申请保存已确认：step＝分离draftId与actionId、增加reapply合同及同草稿跨动作查重；verify＝不调用模型、再次人工确认、双标签/丢响应不重复建动作或成果、过期资料/损坏/忙碌拒绝；M6补重启后核验再显式申请。实现与测试均未开始。

M4分析延续边界已确认：step＝将结果、analysisId、规则revision和来源绑定；verify＝同结果追问/补充/报告连续、新查询与切资料不继承对话规则、资料内规则可用、更正规则使旧草稿失效、新查询失败不误报旧结果为成功。M5确认/reapply复核同一分析依据；只记录验收预期，尚未实现。

M3/M4“按现在分析”已确认：step＝受理记录固定receivedAt/messageId，分析工具按明确用户表达引用该时刻；verify＝丢响应重试不取新时刻、延迟执行/刷新/生成报告均保持同一now、缺授权及时间歧义澄清、来源可追溯。Spec§7.1补核心身份与分析DTO，精确policy schema及其余接口上界仍待收敛；无代码实现或运行通过。

## 后端开工缺口（v0.9历史状态；当前以末节v0.12复核为准）

| 最迟节点 | step | verify / 停止条件 |
|---|---|---|
| M2实现前 | 冻结三工具Schema、资源ID/命令/加载白名单、精确文件和测试入口 | 正常/非法/越界/超限样本可判定；只有职责描述不满足 |
| M2真实调用前 | 冻结SDK预算拦截/停止路径，离线验证认证隔离和资源加载 | 预算无法落实则停止调用并先说明最小调整，不静默重试或放宽 |
| M3实现前 | 完整HTTP/SSE DTO、事件枚举、Host/Origin/令牌启动合同、幂等容量和会话结束策略 | 双标签/乱序/跨站/旧epoch/重启重复请求可验证，缺口未闭合阻断M3 |
| M4—M6各阶段前 | 单请求超时/无进展判定、模型截断可观察、持久格式/锁/发布方案、恢复验证入口 | 真实失败注入与停止条件明确；未测不称通过 |

两路审查已完成，原文见阶段审核回执#backend_spec_v0_7_review；v0.8修订未复审，不授权实现。工程约束继承表见后端Spec§四；R02/R06随文件持久化启用，前端豁免不跨阶段继承。

正常运行控制变更已确认（Spec§9.4）：不实现固定任务总时长/模型或工具次数限制；旧180秒/6次等候选撤销。M2前收敛单请求超时、SDK默认重试关闭与无进展检测；离线验证正常长链不中断、重复失败/无进展停止、取消无迟到成果。SDK首轮探针预算不变，不能据此扩大计费调用授权。三工具Schema定义及离线契约测试授权继续有效，尚未完成；不与后端业务实现混淆。

## v0.10合同与离线验证接续（未授权实现）

三个工具Schema已定义在backend-spec§7.2唯一JSON块；可运行测试从该块读取，避免测试维护第二份规格。HTTP/SSE及本机访问合同见§7.3—7.4，正常运行取消/单请求空闲超时/无进展判据见§9.4，不设置正常任务总轮数或总调用次数。下列是后续实施写集合，不代表文件已经创建。

| 节点 | 计划写集合（相对项目根） | step × verify / 停止条件 |
|---|---|---|
| M2 | 05-工作产物/backend/{package.json,package-lock.json,tsconfig.json,README.md}；backend/src/{contracts.ts,resources.ts,model.ts,session.ts}；backend/resources/{package.json,prompts/query.md,prompts/report.md,skills/ticket-triage/SKILL.md,extensions/ticket-tools.ts}；backend/tests/{contracts.test.ts,resources.test.ts,sdk-probe.ts}（backend前缀均为05-工作产物/backend） | 精确锁Pi0.85.1及直接Schema依赖typebox1.3.7；默认Node原生HTTP不引入Web框架。离线Schema/资源/认证隔离先过，再经明确授权运行既定SDK预算探针；SDK签名或预算控制不能落实则停，不安装latest。真实probe工具仅属测试，不能冒充产品三工具已实现 |
| M3 | backend/src/{server.ts,state.ts}；backend/tests/{http.test.ts,events.test.ts}；frontend/src/{main.ts,resource-ui.ts,resources.ts,domain.ts}，必要frontend/vite.config.ts | 同源API、bootstrap与SSE、revision/幂等/输入草稿保护；拒绝越界、双标签、迟到事件。先契约与替身时序测试，再本机HTTP/浏览器；不回退demo |
| M4 | backend/src/tickets.ts；backend/resources/extensions/ticket-tools.ts；backend/tests/tickets.test.ts；frontend/src/demo.ts（仅解除真实模式依赖） | 三工具接真实确定性业务及应用提案；固定金标/缺规则/来源变化，再真实SDK输入到输出。当前06参照测试不得替代这些业务实现测试 |
| M5 | backend/src/reports.ts；backend/tests/reports.test.ts；frontend/src/{main.ts,resource-ui.ts}；06-验收与交付/browser_backend_test.py | 真实草稿/确认/重申请/下载；哈希、状态竞争、丢响应及崩溃注入。完整成果包才算保存 |
| M6 | backend/src/state.ts；backend/tests/recovery.test.ts；backend/README.md；frontend/README.md；06-验收与交付/验收记录.md | 锁/重启/损坏数据恢复与干净环境学员复现；未知格式保留并拒写，不自动清空。附复現命令与真实证据 |

实施时每阶段再解析上表为完整绝对路径和唯一writer，按实际必要文件裁剪；越出写集合先说明原因并更新，不因表中列出即自动授权写代码。测试入口：backend的check/build/test脚本在M2建立后执行，contracts/sdk-probe分别有独立入口；前端沿用npm run check/test/build及现有Playwright脚本。当前backend目录尚不存在，不能记上述命令已跑。

剩余冻结项：持久化容量/会话结束与保存中断布局、单实例锁具体方式，以及完整合同修订后的同版独立审查。M3前必须补容量错误和UI处理，M5前明确保存崩溃注入点；这些不属于已通过离线Schema校验。

当前离线验证已执行：backend-contract-test.mjs退出0，52项通过（30结构、18参照、3局限、1文档约束）；证据见验收记录与backend-contract-results.json。§7.2—7.4合同已定义，先前“缺Schema/接口候选”转为“待独立审查及实际适配验证”，不是后端业务已实现。后续保留持久化容量/恢复布局及同版审核门。

当前v0.11持久化位置与容量行为已定，见Spec§6.2.1；旧“容量/会话结束策略待定”由该节替代。当前只读双模型审查同一完整v0.11，结果不继承旧版；具体锁和磁盘中断探针留M2/M5/M6，不要求本轮创建后端。

v0.11复审：DeepSeek完成并提出5项，GLM长等待后无最终回执，主控收敛一次后结束运行。v0.12已修正报告ID恢复、只读故障投影、错误码及到期闸门；对话规则语义留M4真实行为评估。当前同版审核仍未闭合，Fresh Executor未完成，不能签发整体执行Gate；已定合同与离线准备不因单路未完成而回退。

## v0.12独立复核收口（2026-09-21，当前状态）

DeepSeek与GLM对同一v0.12完整正文均返回READY_FOR_STAGED_IMPLEMENTATION；GLM Fresh Executor完成，主控接受分阶段就绪，不代表后端运行验收或实施授权。Spec仅回填审核状态行，合同正文不变；精确哈希、原始回执及裁决见阶段审核回执#backend_spec_v0_12_review。前文未复审/NOT_READY为对应版本历史。

| step | verify / 进入条件 |
|---|---|
| 用户明确启动后进入M2 SDK与资源底座 | 保持既有代码规范、精确依赖和单writer；先离线检查，再在另行授权与预算落实后真实调用；未通过SDK探针不推进依赖它的M3链路 |
| M3实现前补齐非阻塞DTO细节 | 明列Envelope.sessionId恢复态可空、ReportSummary字段、received_at仅用于now来源；类型和非法样本可判定，不另建Spec |
| M3前澄清运行期state提交失败的故障投影及可读范围 | 不能可信落盘时拒绝变更；模板保存失败保持旧版本，不扩大为全部故障；快照明确提示降级，不静默丢失/伪造状态；替身验证写失败和刷新 |
| 按M2—M6逐步验证真实边界 | SDK资源/认证/停止、HTTP/SSE、自然语言补规则语义、文件崩溃、重启与干净环境复现分别取得真实证据；52项离线检查不替代它们 |

不增加新的产品选择、固定任务上限或架构层；此次只补独立复核，不启动后端实现。

## M2—M6执行授权（2026-09-21）

用户明确授权按Spec持续实现至M6并进行必要验证。沿用已评审v0.12合同；主控管理文档和验收，单一代码writer。无Git目录沿用canonical文件哈希，不创建worktree/提交。独立审使用用户指定DeepSeek＋GLM，覆盖Skill固定审核模型约束；不改全局规范。阶段接口和SDK探针仍按依赖验证，不把阶段检查替代最终真实链路。

M2精确writer写集合见PROJECT_STATE.write_set；较原表增加.gitignore、Skill附属规则及model/session测试以覆盖密钥隔离、资源和取消故障，不扩大产品。依赖安装精确锁定；生成的node_modules/dist只作为运行构建产物，默认忽略。主控执行首轮真实探针前核对预算实现，writer不自行调用付费模型。

M3前主控源码核对发现的接入检查：左栏上传列表刷新后需要后端列表读取（现§7.3仅明确单资料GET）；真实工具短步骤需要有快照/事件投影（现仅业务结果事件）。在M3冻结时于唯一backend-spec补最小读取/步骤DTO，保持已确认页面能力，不新增任务或平台。前端main.ts的DemoRuntime、MAX_DATASETS、设置内存应用、报告60秒文案，resource-ui.ts的saved Map与静态RESOURCES均须按真实后端权威替换，不能只替换问答方法。

M3接口小补齐已落到唯一backend-spec v0.13 §十二：资料列表、RequestView.steps、ReportSummary、nullable sessionId、规则来源mode以及故障只读投影。三工具Schema未改，离线52项回归通过；这些既有离线用例不证明新增HTTP行为。M2原派发合同保持，M3代码和审核使用新Spec。M2当前按同一writer分为先包/合同/资源静态文件、后加载/模型/会话两个可验证片段，均完成并经主控验收后才可收口M2。

执行方式调整：用户明确允许当前窗口开发，并称子智能体“也可以”协作；主控收回可选委派，直接单写代码，DeepSeek/GLM阶段只读审核保持。两个旧writer均经close＋not_found/shutdown确认无残留，backend无源码产物。此为用户授权范围内的组织调整，覆盖dev-team“实现全委派”指南，不伪造其冻结选模校验为主控代码授权。无新增产品范围；现行源码/测试/验收门不降低。


### M2实现及M3独立准备（2026-09-21）

- 主控单写M2新增 `backend/src/model.ts`、`src/session.ts`、`tests/model.test.ts`、`tests/session.test.ts`、`tests/sdk-probe.ts`、`README.md`，既有contracts/resources与锁定依赖保留。verify：M2共20单测及check/build通过；真实SDK探针PASS（3次请求、1次工具），模板与Skill实际输入已用SDK/替身验证。
- M2冻结20文件源码SHA256 `cc98dbdd9a1bc658c3db54af7b1ed4b078b56b9da0307377b214641f8ddfd017`，指定DeepSeek/GLM只读审核进行中，未标阶段完成。
- 同时允许主控独立准备M3 `src/access.ts`、`src/events.ts`及对应 `tests/access.test.ts`、`tests/events.test.ts`；不改M2送审文件。verify：真实HTTP边界、SSE首帧/重连/慢客户端测试；随后才接协调器与页面，不把模块测试当M3联通通过。


### 统一协调器前的依赖模块（2026-09-21，主控单写）

- `backend/src/storage.ts`及`tests/storage.test.ts`：本地状态文件、真实路径单实例锁、明确死亡本机进程的受控锁恢复、损坏/提交失败只读。verify：重复实例与symlink别名拒绝、SIGKILL子进程后重启恢复、未知锁保留、未知目录不覆盖。
- `src/datasets.ts`及对应测试：上传后不可变文件、登记后才可读、版本/内容核对，保留前端内置六条工单真实输入。verify：U01不同答案、未自动选中、篡改恢复拒绝。
- `src/business.ts`及对应测试：三个工具依赖的确定性业务函数。verify：全量查询、严格阈值、未来/closed、缺规则、规则原文追溯及幂等、报告事实/转义/长度/hash。自然语言语义仍待M4真实模型独立用例。
- `src/reports.ts`及对应测试：批准后的完整文件包发布/校验/扫描。verify：无批准拒写、重复确认同包、发布前后故障注入、篡改/不完整包拒绝。进程崩溃全过程及断电耐久不能由注入异常冒充。
- 当前全后端37单测及check通过；上述为M3—M6共用依赖的实现准备，不提前标记里程碑验收。下一步接统一协调器与HTTP、再替换前端演示适配。M2送审原20文件未修改，新模块不在该审核范围。

### M2审查修订与M3协调器接线（2026-09-21）

- 已修正Skill自足/append为空、加强内容断言、会话路径错误映射、独立密钥协议归属；补停止/迟到工具/续问、SDK错误不重试、真实本机HTTP 429单次请求、reset失败回滚、诱饵全局资源隔离测试。RunGuard落实15秒连接、120秒无进展和重复工具小循环停止，不限制正常任务总轮数/总时长。
- 新增`backend/src/app.ts`、`src/server.ts`、`src/progress.ts`及对应测试与`tests/provider-retry.test.ts`。统一协调器接通受理持久化→SDK→三个工具→回复→草稿→过期重申请→批准→文件包；HTTP/SSE与模型测试接口可运行。连接测试使用独立内存SDK上下文，不污染正式会话历史。
- verify：当前49项后端测试、check、build通过。真实SDK替身全工具链、真实HTTP/SSE、截止边界与重申请不新增模型调用均有执行证据；不是真实业务模型/浏览器验收。
- DeepSeek原版READY带修订，GLM原版CHANGES_REQUIRED；上述修订已实现但独立复核尚未运行，不覆盖旧回执。GLM F5关于agentDir的意见与既有sdk-config子目录源码不符，未采纳。
- 下一步直接替换前端演示适配（main/resources/resource-ui必要变动、新增API适配），保持视觉与原生TypeScript；再做真实模型、完整浏览器、恢复与干净环境复现。

### M3页面真实适配与浏览器接线（2026-09-22）

- step：主控唯一writer，新增frontend/src/{api.ts,runtime.ts,markdown.ts}、tests/api.test.ts，修改main.ts/resource-ui.ts/resources.ts/style.css及package.json测试入口；demo资源仅供历史测试。verify：30项前端测试（其中27项历史回归）及check/build通过；浏览器已确认无DemoRuntime回退。
- step：backend/tests/browser-fixture.ts以真实SDK＋模型替身提供隔离服务，06-验收与交付/browser_backend_test.py执行真实页面。verify：13组检查通过，含无资料问答、上传不自动选择、刷新恢复、已建SDK会话后的模板保存、双标签冲突保留正文、恢复默认、三工具、Markdown惰性HTML、确认落盘与认证下载。结果与源码集合哈希见backend-browser-results.json，截图已人工视觉核对。
- 遇到的问题→选择与理由→验证：浏览器原生fetch绑定到ApiClient对象会抛Illegal invocation，改为包装调用；SSE常驻不能用networkidle判就绪，改等服务快照与具体页面状态；真实浏览器重跑通过。测试选择器错误已修正，未降低业务断言。
- M2修订独立复核：DeepSeek/GLM均READY，覆盖原39文件hash 79aba093…f110d7中的原发现关闭；原20文件hash cc98dbdd…a9a7属于修订前历史，不能继续表示当前源码。当前M2原四测试文件共24项，后端总49项；不把此计数当M3—M6验收。
- 未验证：真实模型完整业务语义、停止/断连浏览器矩阵、保存阶段进程中断与完整恢复、M6干净环境学员复现。模板双重回滚失败、资源失效等实现边界还需继续核对；M2 READY只关闭指定原发现，不等于这些风险已通过。

### 模板/Skill异常修订与停止检查（2026-09-22，当前）

- 问题→选择：原模板回滚只重载loader，未恢复活动SDK会话；改为同一会话reload回调恢复旧正文。二次失败标资源不可用，禁止所有新请求并丢弃不可信会话；成功修复后从SDK磁盘历史重建。重载必须保持工具白名单、模型绑定和会话历史。目标src/resources.ts、src/app.ts及对应测试，未新增架构层。
- 问题→选择：锁定SDK可能在Skill读取/展开失败时原样透传命令。应用先读项目受控正文，再在provider调用前检查SDK确已展开；不自行替代SDK展开，不调用模型猜测。失败投影为RESOURCE_UNAVAILABLE并刷新能力库状态。
- verify：先新增回滚反例，复现3项失败后修复；真实SDK＋替身验证旧模板重新进入下一请求、双重失败不发模型请求、白名单/模型/历史篡改拒绝及修复重建、Skill正常/原样回退/登记丢失。全后端55项、check/build通过。
- 页面目标frontend/src/{runtime.ts,main.ts}，测试扩展backend/tests/browser-fixture.ts和browser_backend_test.py：停止状态明确、迟到输出丢弃、随后可续问；手动重新订阅快照不重发任务、不丢输入。浏览器15组通过；模型仍为替身。浏览器结果现在由脚本自动记录对应源码hash，不人工续用旧版本证据。
- HTTP目标backend/src/server.ts与tests/server.test.ts：真实磁盘状态发布故障下，GET已知request返回旧状态，未知ID为404，新变更拒绝。先复现原500拒读，再修只读白名单并验证通过。
- 本次4文件hash e963c1a3…9fbff2已送指定DeepSeek/GLM，当前两路均READY，主控接受指定修订关闭。送审集合保持不变；后续server/前端修改不在这轮审查覆盖内。旧M2双路READY仅适用旧冻结版本。
- 后续仍需：自动断连与重启、未知受理按clientRequestId核对、状态嵌套损坏校验、保存中断进程实验、真实模型规则语义、干净环境学员复现；不扩大产品范围，不把15组浏览器替身当真实模型通过。

本次独立复核收口：DeepSeek复跑55项全量及定向24项、GLM定向16项均通过；两路均复算4文件与Spec哈希，身份requested_only。保留DeepSeek的真实SKILL文件缺失/损坏及真实provider重载后认证行为未验项，后续验证，不用无缺陷意见替代真实运行。原39文件hash为历史审查集，不再表示当前源码。

### v0.14未知受理与只读同步（2026-09-22，当前）

- 问题→选择：Spec要求按clientRequestId核对未知受理，但原HTTP只支持服务器requestId。沿唯一backend-spec §12.3补齐GET /api/requests?clientRequestId&sessionId，不引入列表/队列。backend/src/app.ts按当前会话查原记录；server.ts验证精确参数/重复参数，并允许恢复只读查询。
- 前端runtime.ts在响应丢失或不可信2xx时保留原ID、有效负载和输入，先查服务器；存在则同步，不重发。查不到只允许用户明确重试，查询失败不能换ID绕过。API客户端作为构造参数注入，新增tests/runtime.test.ts测试真实提交状态决策，不新建通用请求框架。
- step × verify：3项前端故障测试（已受理丢响应、404后原ID重试、核对断网阻止新意图）通过；真实HTTP验证旧会话/重复参数/只读查询；浏览器故意丢弃202响应后仍只有一份任务。前端总33测试/check/build通过，浏览器16组通过，证据自动绑定当前源码。
- 状态磁盘写失败后关闭旧SSE连接，使客户端按现有重连规则收到recovery_readonly首帧；HTTP实测原连接结束与新快照模式。受理未落盘时模型不启动，内存投影必须failed而非accepted；先复现错误状态，再修复并用真实磁盘替换故障验证。backend/tests/app.test.ts及server.test.ts覆盖；后端56测试/check/build通过。
- 当前Spec v0.14增量未独立审；旧v0.12/v0.13与e963c1a3四文件审核均只保留原范围，不签发当前M3—M6整体通过。后续优先嵌套状态损坏、报告保存进程中断与浏览器重启，再真实模型语义和干净环境复现。


### 报告保存进程中断与元数据校验（2026-09-22）

- step：使用临时数据根及真实App/SDK模型替身，在待确认、仅Markdown同步、完整临时包同步、目录发布、父目录同步五处对子进程SIGKILL，再用App.open恢复。verify：五项均通过；旧待确认过期，发布前saving转interrupted且不续写，发布后完整包恢复saved，重复确认不产生第二份；再次重启结果稳定，独立密钥未落盘且重启失效。
- 问题→选择：报告读取原先只验证部分来源及正文hash，缺少analysisId/queryRequestId/contextRevision仍可被接受。复用三工具的AnalysisRef/SourceRef Schema并拒绝空白引用，不增加第二套合同。verify：反例先失败再修复；七种元数据变异拒绝下载、不列入成果、不覆盖原字节，完整兄弟包仍可读取。
- 目标：backend/src/reports.ts及tests/{reports.test.ts,recovery.test.ts,report-crash-fixture.ts}。四文件按排序后的项目相对路径UTF-8与原字节串接SHA256为3578427fe7e526b633a2b8c384c8ff9da7e5889e804cf6621216499d79b0f247。
- verify：后端62项测试、check/build通过；现有16组浏览器真实SDK＋模型替身检查重跑通过，当前源码依据由backend-browser-results.json记录。没有外部模型调用，临时子进程与目录由测试清理，未操作其他服务。
- 未验证：这证明进程终止恢复，不证明断电/任意文件系统持久性。本次增量独立审核待做；状态嵌套损坏、完整浏览器重启矩阵、真实模型语义与学员干净环境复现仍按原PLAN推进。旧审核不扩展到本次修订。


### M6嵌套状态校验与浏览器重启（2026-09-22）

- 问题→选择：原state只校验顶层数组和少数请求字段，恢复可能信任不完整关联。校验集中于backend/src/state.ts，复用工具Schema与模型配置规则，检查来源/请求/消息/分析/草稿hash/批准及重申请关系；App启动再核对分析记录与不可变资料，恢复只读sessionId统一为null。没有新存储平台或会话配额。
- step × verify：tests/state.test.ts覆盖20种嵌套损坏，拒绝变更且保持state原字节，完整报告仍可读取；另覆盖消息裁剪和重启提前过期后重申请的合法状态。后端64项测试/check/build通过。测试种子的固定时间曾晚于真实系统时间，已改为相对时刻，不绕过批准时间校验。
- 浏览器：原16组接线回归通过；新增browser_recovery_test.py五组真实进程/SSE恢复通过，覆盖自动重连保留输入、重启token/epoch变化但会话保持、独立密钥失效不回退、旧确认过期、无模型重申请并保存/下载、运行中SIGKILL后interrupted且不重发。首次脚本误在pending忙时fill只读输入框失败，按已有合同改测，未修改产品权限。模型均为SDK替身，没有新增应用计费调用。
- 独立审核：冻结8文件SHA256 d91cc7c51ce5be0e0e19722824bcbd647266384782476cdcb42f1245f6c6114c；GLM定向11项通过并给READY，DeepSeek本次429未完成。GLM回执的20/21反例数量、markdown_synced/files_synced描述等已由主控按实物裁正；不采纳open(wx)目录发布建议。原文与裁决见阶段审核回执backend_recovery_hardening_review，不能写成双路通过。新增浏览器脚本不在该8文件审核范围。
- 后续：完整当前版本独立审核、真实Skill文件缺失/损坏、真实provider重载后认证和业务语义、学员干净环境复现，以及剩余合同/恢复关联检查仍需完成。本轮通过不代表M2—M6最终验收；断电耐久未验证。


### 确认哈希、干净安装与首次真实业务探针（2026-09-22）

- 问题→选择：confirm的saving及reapply的同草稿pending/saved快捷返回漏验expectedHash。反例先失败，再在原分支补核对；已有成果从磁盘验hash，不因随后切资料而丢失。tests/app.test.ts覆盖三条错误hash拒绝及切资料后返回原成果，不增加模型请求或副本。
- step × verify：真实HTTP提供方故意不结束SSE，取消后两秒内收敛、下一次请求成功；受控Skill在隔离资源副本中实际删除/空正文/改错名称，均拒绝调用，恢复正文后可用。正式项目资源不改动。后端66项测试、check/build通过；原16组浏览器接线重跑通过。
- 干净复现：clean_environment_test.py在本机临时源码目录、不带node_modules/dist/data，分别npm ci/check/test/build，lockfile不变，再跑5组浏览器恢复；9步骤通过且临时副本清理。当前Node26.0.0/npm11.12.1/Python Playwright1.58.0，使用已有npm缓存和Python环境，不代表跨OS/独立学员。前端README已去除Codex专用helper依赖。证据clean-environment-results.json绑定当前源文件。
- 真实应用模型探针：沿已授权M2—M6必要验证，先说明首轮3请求/1工具不足以覆盖三工具，另设一次业务批次最多4请求/3工具、512输出tokens/请求、180秒；正常任务不受此限。实际tongba/glm-5.3发起4请求、3工具成功，T01/T04/T06与时效金标正确，但最终回复未正常结束，App失败、reportAction=null、无保存成果。结果为FAIL，不能用工具通过冒充闭环；未自动重试或切模型，未改全局配置或展示密钥。
- 重要未验：本次timeout触发，但受理/收口墙钟相差约15分钟，没有单调时钟trace，无法归因于提供方、取消收敛或时钟变化，也未证明180秒硬截止落实。已补probe-only单调时钟/响应头状态/abort/结束原因追踪，尚未再次计费运行；下一批计费前须补进程级截止并离线验证，不能直接加长超时。失败原文保留sdk-business-results.json。
- 审核边界：本轮app修订使此前d91cc7c5八文件集合不再是当前版本；GLM原READY仅覆盖旧范围，DeepSeek429仍未完成。完整当前版本复核、真实模板/Skill/provider重载和自然语言规则语义、恢复剩余关联审核与独立学员验收继续待办。


### 当前草稿失效与SDK错误合同修订（2026-09-22）

- 问题→选择：切换资料、新查询或分析引用版本变化后，清除activeActionId并发送report.updated；同一分析普通追问保留预览，历史草稿和已保存报告不删除。沿用Spec §10.4，不新增产品决定。目标backend/src/app.ts及tests/app.test.ts。
- step × verify：先复现切资料/新查询两条旧预览反例，再修复；重启后仍无活动旧草稿，旧未保存草稿重申请拒绝，已有成果保留。浏览器通过真实HTTP/SSE和刷新验证，17组通过；模型为SDK替身。
- 问题→选择：上下文溢出原被统一报PROVIDER_ERROR；复用锁定pi-ai导出的isContextOverflow，映射CONTEXT_TOO_LARGE，保留错误脱敏、不自动压缩/重试。实际本地HTTP400反例先失败，修复后超限与普通错误分流且每次只发一请求；后端68项/check/build通过。
- 探针进展与失败见验收记录：进程监管器已离线验证，后续一批传输/工具完成但自然语言时效表述错误；澄清系统提示词后下一批首请求SDK错误、无工具，仍FAIL，未盲目重试。正常任务仍不设固定总调用配额。
- 下一步：报告包与状态的生成请求/批准来源关联，真实provider错误诊断及语义验证，再完整当前版本独立复核。旧双路或GLM局部READY均不扩展到这些修订；同机干净安装旧证据不冒充当前源码重跑。


### 报告包关联修订（2026-09-22）

- 问题→选择：补metadata生成requestId；readApproved核对草稿、会话、生成请求、分析引用、hash及批准时间。恢复在改写状态前核验，重复保存同样核验；缺失、损坏或孤立包只读保留，不自动补写。旧开发包缺requestId不静默迁移。
- step × verify：3项反例先失败再修；9种元数据变异、5种关联变异、缺包/损坏/孤立3种情形及五处进程中断通过。同机干净复现9步骤通过（70后端、33前端测试、check/build、5组浏览器恢复），见clean-environment-results.json。不是跨OS或独立学员验收。
- 7文件集合a64b4d0fdf6758c3b747761384d889238c015954126ba1b336a70fbd375fec2e已提交DeepSeek/GLM只读审，尚待返回；不继承旧READY。
- 后续：核验实际provider输出/推理参数、真实语义和完整项目验收。探针512输出截断后明确改为1024，其余原提示词/4请求/3工具/180秒不变，下一批首HTTP200仍length、无工具。当前不继续盲目计费，失败保留原证据。

本轮报告关联独立复核已收口：DeepSeek与GLM均READY，主控复算7文件hash仍为a64b4d0f…5fec2e；两路各跑13项定向，DeepSeek另跑10项App测试。GLM回执20/21变异数及4+4+5项分组误写已裁正；原文和裁决保留阶段审核回执backend_report_association_review。只关闭本次关联修订，低优先级诊断文案及.DS_Store处理建议待办，真实模型与整体验收仍未完成。模型底层身份仍requested_only。


### GLM协议兼容与真实基线链路（2026-09-22）

- 问题→选择：本机reasoning=false不等于GLM-5.3关闭推理；官方明确始终推理、默认max，支持low/high/max（https://docs.z.ai/guides/llm/glm-5.3）。先用probe-only enabled+low完成链路，仍发现报告建议把future混称不适用，保留FAIL。随后仅针对host tongba/glm-5.3/openai-completions使用进程模型副本和SDK low，原API/认证/地址/容量不变，原文件及原模型定义不改。合同进入唯一Spec v0.15，增量待审。
- step × verify：本地真实HTTP验证首次/reload后thinking enabled与low，原models.json字节不变；报告建议限定处置行动，事实仍由应用计算，回复仍须正确解释。72后端测试、check/build通过。另关闭审核低优先级项：只忽略普通.DS_Store文件，未知隐藏条目仍只读；坏包明确提示存在不可用成果，原文件保留。
- 真实正式版本：原业务提示词，4请求/3工具/每次1024输出tokens/180秒上限，探针仅观察SDK实际参数，不覆盖thinking；44.825秒完成。T01总等待5h阈值4h、T04总等待10h阈值24h、T06未来异常、3条及来源正确，建议无分类矛盾，待确认且未保存。主控将REVIEW_REQUIRED裁为本场景PASS，证据sdk-business-results.json；此前6批历史保留（包含兼容候选FAIL）。底层模型身份仍requested_only。
- 后续门：真实模板/Skill、U01换源、对话补规则、完整真实浏览器流程、v0.15及当前代码独立审核、独立学员验收。旧7文件双路READY保留旧范围，因本轮app/reports小改不能冒充当前全量通过；原70测试干净复现同样保留原hash范围。README已移除重复阶段计数，历史仍在现有验收记录。


### 模型工具参数与真实资源/规则复测（2026-09-22）

- 问题→选择：真实补规则连续被SDK拒绝（updates: must be object），但正确对象经SDK→App集成可用。将Canonical Schema的有限本地引用展开为模型输入对象，保留严格校验；Skill改为先evaluate，再依据missingRules询问。没有增加业务解析正则或放宽输入。
- step × verify：74项后端测试/check/build通过；同一原提示词下，rules批次8请求/4工具/105.013秒通过，U01绑定、消息接收时刻、4/24阈值、分析延续及新查询重置均核对。resources批次5请求/2工具/45.073秒通过，两版模板影响下一轮，Skill实际查询/检查并正确解释T01/T04/T06。仅证明这些场景成功，不宣称所有模型行为可靠。
- 探针工具计数原在SDK reload后失效，现重挂包装并核对App步骤，真实resources复测一致；SDK错误仅保留校验路径，不输出原参数或密钥。12批历史统一保留sdk-business-results.json，失败不删除。17组浏览器SDK替身回归通过；首次因主控漏启动5189隔离服务而连接失败，按README启动后重跑通过，服务已停止清理。
- 独立审核：旧25文件7d9a0d09…9d251d两路均PARTIAL，DeepSeek NEEDS_FIX，GLM未出全量结论；原文见阶段审核回执#backend_v0_15_full_review。旧Schema通过$ref/$defs提供定义，不能采信“完全未暴露”的归因；展开后真实场景成功仍不构成单因素因果证明。当前25文件c2512e24…41da078待复核，Spec v0.15正文未变。
- 后续：真实浏览器模型→确认→下载→恢复，补充模糊/否定规则边界；再收口当前版独立审核及独立学员验收。M2—M6尚未最终完成。


2026-09-22继续验证：当前生产源码同机干净安装9步骤通过（后端74/前端33、check/build、5组恢复，临时副本删除）。新增browser_real_test.py显式--run，预算4请求/3工具/1024输出/180秒；先以隔离SDK替身验证页面提交→确认→磁盘一致下载→刷新/重启。首批真实GLM浏览器失败，仅1请求、0工具、未出现草稿，151.619秒退出并清理；原trace不足以区分网络、提供方或输出原因，未盲目重试。之后补终态提前失败与脱敏SDK状态诊断，离线正常链路3.472秒、注入失败1.550秒收口通过；未再次实际计费验证该诊断。失败证据保留backend-browser-real-results.json，不能以离线通过覆盖真实FAIL。当前25文件c2512e24…41da078两路完整复核仍运行中，未授予APPROVE。


2026-09-22真实浏览器主流程通过：修复测试异步等待提前完成的问题，延迟SDK替身成功/失败均验证后，以同一原提示词和4请求/3工具/1024输出/180秒预算复测。第三批实际4请求/3工具、四次HTTP200、33.875秒正常结束；用户页面确认后才发布文件，下载字节与磁盘report.md一致，刷新和后端重启后同一报告可下载，恢复阶段0模型请求。主控核对正文/Markdown及截图后标限定范围PASS，见backend-browser-real-results.json及同名png。前两批保留：首批原因证据不足；第二批因测试异步predicate提前返回，在accepted时终止任务，不用它判断提供方失败。新脚本仅测试入口，不修改生产行为，仍未独立审核。两路当前生产25文件均READY（范围见回执），正常任务仍无固定配额；最终规则负样本、AC收口和学员交接仍待完成。


2026-09-22验收补强：规则否定/转述引用/含糊表达三例在真实GLM下保持缺依据、分析revision0、无报告（7请求/3工具92.383秒）。实际App普通/工具连接测试分别通过，重复请求不增调用，主会话与配置/选择不变（3请求/1工具21.821秒）。首次连接批次最后误断言sdkFile必须null，因本机启动已建主会话而失败；保留原记录，改为前后比较并补已有主会话离线成功工具测试。75项后端测试和check通过；生产25文件未改，原双路审核范围不变。验收记录顶部已逐项核对B01—19，仍缺B04独立/report真实追问与B13原无资料完整对话；新GLM独立接手正在运行，不声明真人学员通过。


2026-09-22 B04/B13补齐：conversation四轮原提示词真实通过（7请求/3工具114.488秒），无资料职责与查询拒绝不编造，选资料后T01/T04/T06正确，/report沿用同一分析只准备待确认草稿。此前两次分别在/report与绑定分析输出1024处length截断，均保留失败；逐项说明后仅这两个任务提高到2048，无资料仍1024，总8请求/4工具/180秒不变。正常任务参数未改。当前业务AC证据已逐项定位，独立接手回执与最终文件清单仍需收口。


M6独立接手发现与修订（2026-09-22）：新GLM执行者首次回执PARTIAL，隔离安装/75+33测试及build完成，但缺Spec时一项ENOENT；运行正式路径恢复/干净脚本覆盖两份正式证据，违反只读边界；手动浏览器因shell后台服务生命周期未完成。README已补完整布局、脚本按自身路径定位并写结果、5189前台与ready说明。主控复算证明其263f9601哈希是省略05-工作产物/前缀的口径差异，生产c2512e24未变。补验只允许在新隔离副本执行手动17组浏览器；仍在运行。现有final-source-manifest已扩为73项全栈源码/配置/README/规格/测试入口并逐项复算，旧M1映射留在阶段审核回执，无历史代码副本；最终交接Gate尚未关闭。


2026-09-22最终开发收口：主控核对B01—B19与源码清单，M2—M6实现及本机验收完成。独立GLM在完整临时布局按修订README执行npm ci/build、前台fixture、同副本browser_backend_test.py，17组通过（执行日志ordinal365、372），正式证据未再次覆盖。首次越界覆盖保留原回执；补验清理命令另含未匹配的通配删除，日志显示no matches，未执行该删除，不认可其为合规清理范例。两次审查的执行偏差不改变已核实功能结果，也不记为协作流程无缺陷。73项全栈交付清单逐项核对；生产25文件仍c2512e24…41da078。独立Agent同机复现不等于真人学员或跨平台验收；无断电耐久、全局CLI/TUI扩展发布证明。本次不发布、不改全局配置，运行与交接入口为backend/README.md。
