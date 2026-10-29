# 第二课扩展资源包：安装与练习指南

## 第四章工单组合练习，从这里进入

如果你要跟着第四章完成TypeScript工单工具，请使用新增的 [ticket-agent练习说明](./samples/ticket-agent/README.md)；原 `samples/mvp` 是另一份JS基础练习。

扩展采用课件里的 `pi install` 用户级安装，完成后在资源包根目录执行 `node scripts/prepare-ticket-demo.mjs`，它会生成全新的练习项目并打印后续命令。脚本中的npm只准备该项目的测试与TypeScript依赖，不替代Pi扩展安装。逐段提示词见[操作稿第1—3节](../05-直播演示操作稿与提示词.md)，项目也带 `/ticket-investigate`、`/ticket-implement` 两份模板。

以下原有 `npm run memory/mcp/lsp/...` 是单项隔离示例入口；第四章整套任务使用上述新项目和普通 `pi`，不要混用。工具直调、项目测试已核对；本轮模型请求返回401，完整TUI演示和彩排仍待你的有效模型环境验证。


这份资源包配合第二课使用，帮助你为Pi添加记忆、联网搜索、MCP、代码诊断、子Agent和浏览器界面。你可以先运行单项示例，观察工具的实际效果，再打开源码理解实现，最后把需要的能力接入自己的项目。

资源版本：2026-09-18，适用Pi 0.85.1。建议先按这里的固定版本完成练习；需要升级时，再创建独立环境测试兼容性。

**安装包、源码、配置示例和练习材料都已放在对应目录中。** `packages/` 保存13个从 npm registry 下载的原版 `.tgz`；`sources/` 是这些发布包的解压内容（不等于完整 Git 仓库）；`official-examples/` 保存 Todo 与两个 Hook 的原版源码。每个包的地址、版本、npm integrity、SHA-256、许可证声明见 [manifest.json](manifest.json)。

开始前，你需要准备Node和npm，以及自己可用的模型账号。MCP练习还需要Python 3，代码差异检查需要Git。资源包已包含直接依赖的安装包；其余依赖和平台专用组件仍需联网安装，因此初次使用请保持网络畅通。

## 1. 从哪里开始

```text
学员扩展资源包-20260918/
├── README.md                 本文：选择、安装、练习、排错
├── packages/                 13个原版npm压缩包
├── sources/                  同版本发布内容，可直接看源码和原README
├── official-examples/        Todo、protected-paths、input-transform与许可证
├── samples/
│   ├── mvp/                  JS筛选案例参考完成版，含模板、Skill和规则
│   ├── mvp-initial/          初始filter.js，用于新副本练习
│   ├── hooks/                仅含合成.env.demo
│   └── mcp/                  只读MCP教学服务与6条合成工单
├── config-examples/          MCP加载适配、LSP配置示例
├── scripts/                  本机相对路径启动、文件校验
├── package.json              从本地tgz安装的直接依赖清单
├── package-lock.json         固定依赖版本，便于复现环境
├── manifest.json             下载来源和教学文件来源
└── SHA256SUMS                检查资源文件是否完整
```

建议按“查看目录 → 安装依赖 → 运行一个示例 → 核对结果 → 阅读源码”的顺序使用。`scripts/`提供课程配套启动脚本，帮你分别加载各项能力；社区扩展和官方示例保留原版内容。单项入口适合学习与测试，接入自己的项目时还需要配置模型、工具权限和运行限制。

## 2. 安装与首次运行

先安装 Node.js >=22.19.0（同时满足本包各依赖的 engines；具体最低要求见manifest）、npm；MCP案例另需 Python 3；需要差异比较的编程练习另需Git。在本README所在目录运行：

```bash
node --version
npm --version
npm run verify
npm ci --ignore-scripts --no-audit --no-fund
npm run pi -- --version
npm run pi -- --help
```

`npm ci`从本地13个tgz读取直接包，其余依赖按锁文件下载。`--ignore-scripts`跳过第三方安装脚本；本包的CLI/资源加载检查使用此方式。需要其他包的安装期能力时，先查看对应源码和说明，再按需处理，不能把跳过脚本后的安装成功理解为所有可选能力都能运行。`npm install --ignore-scripts`可用于重新解析依赖，但会改变锁文件，不是本课默认复现命令。

你需要使用自己的Pi登录或Provider配置连接模型。资源包不包含模型账号、网关凭据或API key。`npm run pi`进入Pi后按自己的Provider使用`/login`或配置；需指定模型时在单项命令末尾加`-- --model provider/model-id`，此处是语法示例，要换成自己实际可用的模型。

单项入口：

```bash
npm run hooks
npm run mvp
npm run memory
npm run mcp
npm run lsp
npm run subagents
npm run web
```

每次先退出前一个入口再切换。除MVP外，入口关闭自动Extension、Skill、Prompt Template及项目规则发现，只显式加载对应扩展；MVP启用项目模板和Skill发现。所有入口都使用你自己的模型配置。请看启动清单确认没有意外加载资源。

`memory`入口把记忆写入本包内`student-state/memory/`，关闭自动退出摘要与qmd更新。其他普通Pi启动方式可能采用社区包默认设置，不会自动继承这些教学选项。`web`限定回环地址，默认端口3001；端口冲突时另设`PI_WEB_UI_PORT`。

## 3. 功能全景：哪些是扩展，哪些不是

| 层次 | 材料 | 解决的问题 |
|---|---|---|
| 基础宿主 | Pi coding-agent、agent-core、ai、tui | CLI、Agent循环、模型接口、终端渲染 |
| 社区扩展 | Memory、Web Access、MCP Adapter、LSP、Subagents、Web UI | 在已有宿主上添加具体能力 |
| 官方Extension示例 | Todo、两个Hook示例 | 任务状态、工具前拦截、输入处理 |
| Prompt Template | implement及Subagents自带模板 | 把重复输入变成命令展开，不新增工具 |
| Skill | coding-verification及社区包自带Skill | 给Agent一套操作方法，不是强制权限 |
| 项目规则 | MVP的AGENTS.md | 定义项目约定和允许修改范围；文本规则不等于沙箱 |
| MCP服务/配置 | 合成只读服务、适配入口 | 给Adapter提供真实可调用的数据服务 |
| 运行辅助 | TypeScript、TS语言服务器、tsx | 类型检查、语言服务进程、执行TS测试 |

一个包可以包含Extension、Skill和模板。Hook通常由Extension通过`pi.on(...)`注册；本课的两个Hook不是两个另外发布的npm包。Subagent与并行多Agent也共用一个`pi-subagents`包。

会话恢复、上下文压缩、默认编程工具和主题机制属于Pi宿主能力，无需为了这些功能再安装一个同名扩展。先完成本包中的练习，再根据项目需要考虑规划模式、状态栏、浏览器操作和远程观测等可选能力。

## 4. 六个社区扩展逐项说明

### 4.1 pi-memory 0.4.2：跨会话文件记忆

- 解决问题：新会话不知道项目偏好、历史决策和待办背景。把这些内容写到可检查的Markdown文件中。
- 主要功能：`memory_write`、`memory_read`、`memory_forget`、`memory_restore`、`scratchpad`、`memory_status`；可选qmd提供记忆搜索。建议先练习读写与状态查看；其余工具按需阅读说明后单独测试。
- 文件结构：长期记忆`MEMORY.md`、每日记录`daily/`及scratchpad；具体格式与配置见原版README。
- 已验证的使用示例：跨进程写入/读取项目排序规则；TUI真实读写；Web UI读出TUI保存的标记并展开内容。
- 动手练习：运行`npm run memory`，输入“调用memory_write，把‘本项目提交前先运行测试，演示编号MEM-01’追加到long_term，然后memory_read读回。”退出后重新启动，再问“读取长期记忆，告诉我MEM-01对应的约定”。同时打开`student-state/memory/MEMORY.md`核对。
- 边界：写入成功不等于记忆正确；需保留纠错、删除、冲突处理机制。qmd语义检索和自动摘要不在本包已验证的练习范围内；使用qmd前需要另装依赖并验证效果。
- 阅读：[README](sources/pi-memory-0.4.2/README.md)、[入口源码](sources/pi-memory-0.4.2/index.ts)。

### 4.2 pi-web-access 0.29.0：联网搜索与内容获取

- 解决问题：模型需要核对当前文档、真实来源，不能只凭训练知识回答。
- 主要功能：`web_search`搜索，`fetch_content`抓取；包还包含多种搜索后端、内容处理与视频相关功能，按原README选择。
- 已验证的使用示例：Exa搜索和抓取TypeScript官方资料。其他Provider、视频和浏览器Cookie相关功能需要你另行配置与测试。
- 使用：在安装后的资源包根目录执行`npm run pi -- --no-extensions -e ./node_modules/pi-web-access/index.ts`，再让Agent“搜索TypeScript官方文档中严格空值检查的说明，抓取一个官方页面，并给出来源与结论”。
- 检查结果：看到真实搜索/抓取工具返回与可打开的官方链接；不能只看模型给出一个URL。
- 前提与边界：需要可访问的网络和可用搜索服务。上游后端政策、限流与收费可能变化；请以所选服务当前的使用要求为准，按需配置自己的凭据。远程网页是不可信输入，引用前仍要核对。
- 阅读：[原版README](sources/pi-web-access-0.29.0/README.md)。

### 4.3 pi-mcp-adapter 2.34.0：把MCP服务接到Pi

- 解决问题：已有查询知识、查数据等MCP服务，需要变成Agent可发现、可调用的工具。
- 主要机制：代理工具`mcp`先发现工具，再调用目标服务；按配置启动stdio服务或连接其他受支持传输，降低一次性暴露大量工具定义的需要。
- 已验证的使用示例：真实stdio握手、工具发现、政策与6条工单查询。使用合成数据，未连接企业数据库。
- 本包配套：`samples/mcp/mcp-server.py`提供只读服务，合成JSON提供练习数据；`config-examples/mcp-extension.ts`负责把这个服务接到Adapter，并关闭其他宿主配置的自动发现。你可以从这两个文件理解“安装Adapter”和“接入具体服务”的区别。
- 动手练习：运行`npm run mcp`，输入“先用mcp搜索support，再读取support_get_policy和support_list_tickets，报告urgent/normal阈值和工单数量，不修改数据。”预期4小时、24小时、6条；检查`samples/mcp/evidence/mcp-calls.jsonl`。
- 边界：本服务没有写入接口，但不代表任意MCP服务只读。企业需要在服务端实施身份、租户、数据权限和审计。服务只实现本课用到的最小协议分支，不作为通用生产MCP Server。
- 阅读：[README](sources/pi-mcp-adapter-2.34.0/README.md)、[教学服务](samples/mcp/mcp-server.py)、[配置入口](config-examples/mcp-extension.ts)。

### 4.4 @narumitw/pi-lsp 0.49.7：语言服务器诊断

- 解决问题：代码可能语法正确但类型不对；让Agent获得文件、行列、严重程度等结构化诊断。
- 本包工具：`lsp_diagnostics`与`lsp_fix`。后者执行语言服务器支持的source action，并非任意错误都能自动修复。
- 依赖：TypeScript 5.9.3及typescript-language-server 5.1.3已下载。启动脚本把本地`.bin`加入子进程PATH；其他项目要确保语言服务器在PATH中。
- 已验证的使用示例：课程TypeScript案例曾通过诊断定位问题，并在修复后消除诊断。你在自己的项目中练习时，也应保留修复前后的结果，再运行typecheck确认。
- 动手练习：运行`npm run lsp`，先用`/lsp`核对服务器，再让模型对自己项目中的TS文件调用`lsp_diagnostics`。明确指定文件并保留修复前后返回，最后仍运行项目测试/typecheck。
- 配置：[pi-lsp.json](config-examples/pi-lsp.json)可复制到受信任项目`.pi/pi-lsp.json`；启动目录默认是`samples/playground`，没有代码时不能凭空得到诊断。
- 边界：`lsp_fix`尚未在本课练习中验证。这里使用的是诊断与source action能力，不要默认它还提供符号跳转、全项目引用查找或语义重命名。LSP通过不等于业务正确。
- 阅读：[README](sources/narumitw-pi-lsp-0.49.7/README.md)、[扩展入口](sources/narumitw-pi-lsp-0.49.7/dist/index.ts)。

### 4.5 pi-subagents 0.68.0：子任务与并行协作

- 解决问题：一个上下文同时调查、实现和审查容易互相干扰，可委派给有独立任务的子Agent，再汇总结果。
- 主要功能：`subagent`委派；scout、researcher、worker、reviewer、oracle等角色；前台/后台、工作流及并行能力。功能以本版本原文为准。
- 已验证的使用示例：scout调查、reviewer审查；两个只读reviewer并行完成。这些结果来自课程SDK案例；换用自己的模型和启动环境后，需要重新检查子任务能否运行。
- 动手练习：运行`npm run subagents`，给出具体文件路径后输入“让scout只读梳理相关实现，再让reviewer检查边界与测试遗漏；每个任务只返回证据和结论，不修改文件”。并行演示可让两个reviewer分别检查逻辑、测试，再由主Agent裁决。
- 前提：子Agent必须有可用模型。父进程内动态注册的自定义Provider不一定被独立子进程继承；如果你使用自定义Provider，需要确认子进程也能访问对应配置。内置researcher还需要子环境加载联网扩展。
- 边界：默认reviewer并不天然是硬只读角色；提示“不修改”不是强制权限。同一工作区不安排多个写入者。并行会增加资源和模型请求；异构多模型、后台长期任务和自动闭环需要单独验证。
- 自带6个模板：`parallel-cleanup`、`parallel-research`、`parallel-review`、`gather-context-and-clarify`、`council`、`review-loop`，原文件均在[sources目录](sources/pi-subagents-0.68.0/prompts)。这些是可选练习材料，尚未在本课中逐一验证；当前单项入口默认不加载它们。
- 阅读：[README](sources/pi-subagents-0.68.0/README.md)、[agents说明](sources/pi-subagents-0.68.0/docs/agents.md)。

### 4.6 @kkkiio/pi-web-ui 0.1.1：把现有Pi会话显示到浏览器

- 解决问题：希望从浏览器观察和操作已有Pi会话，展示消息、工具调用和返回。
- 实现：Extension在同一个Pi进程启动HTTP/WebSocket服务；浏览器通过事件与命令和会话交互。包中包含构建后的前端dist，本包不需要重新开发UI。
- 原版功能：流式消息、工具卡片展开、模型/思考设置、会话信息、命令与导出等。本课主要练习对话和工具结果展示，其他功能可按需探索。
- 已验证的使用示例：原版页面加载、真实模型回答、Memory/Todo/MCP/LSP调用显示、重连及记忆详情展开。这些工具需要与UI一起加载；下面的单项入口用于先体验界面。
- 动手练习：运行`npm run web`，在终端输入`/webui`打开页面。此单项入口只加载UI；想在页面调用Memory等，须同时显式加载对应扩展，装到node_modules不会自动全部启用。
- 边界：UI不创造工具、不自动接通企业知识库。原版无内置认证，默认只监听127.0.0.1；接入企业应用前，需要为HTTP/WS、文件访问和导出等接口补充认证与权限控制。
- 自定义同类扩展需要考虑：事件订阅、工具卡片、消息提交/取消、会话状态、重连、服务关闭、身份权限和文件访问；先把宿主能力与页面呈现分开。
- 阅读：[README](sources/kkkiio-pi-web-ui-0.1.1/README.md)、[服务扩展源码](sources/kkkiio-pi-web-ui-0.1.1/extensions/mirror-server.ts)。

## 5. 三个官方Extension示例

### Todo：让任务进度可见

文件：[todo.ts](official-examples/todo.ts)。`todo`工具支持list/add/toggle/clear，`/todos`打开TUI任务面板。状态存入会话工具结果，而不是独立任务数据库；恢复/分支时按会话还原。

你可以在`npm run mvp`里先要求“创建一条检查筛选逻辑的todo”，再`/todos`查看。只有真实测试通过才完成Todo，状态标记本身不证明工作完成。

源码重点：`registerTool`、`registerCommand`、工具结果details保存状态、会话事件恢复。

### 工具前Hook：protected-paths.ts

文件：[protected-paths.ts](official-examples/protected-paths.ts)。运行`npm run hooks`后输入：

```text
请实际调用write工具，将本目录.env.demo写为DEMO_VALUE=changed。这是无凭据教学文件。如果工具拦截就报告原因并立即停止，不绕过。
```

预期结果：write调用被阻止，工具返回`is protected`，文件仍是`DEMO_VALUE=unchanged`。这个行为已在课程测试中验证。练习时同时查看工具调用和`samples/hooks/.env.demo`，不要只依据模型说“已阻止”来判断。

源码重点：`pi.on("tool_call")` → 只检查write/edit → 路径字符串包含`.env`、`.git/`、`node_modules/` → 返回`{block:true,reason:...}`。它不拦截bash等其他写入路径，不等于OS沙箱。

### 模型前输入Hook：input-transform.ts

文件：[input-transform.ts](official-examples/input-transform.ts)。在同一终端：

```text
ping
```

你会在终端看到本地返回的pong。这条输入不会交给模型处理；课程测试记录的新增Provider调用为0次。再输入：

```text
?quick 用中文解释为什么工具调用前的权限检查不能只靠提示词。
```

输入被转换为`Respond briefly in 1-2 sentences: ...`后交给模型。源码重点：`pi.on("input")`及`handled / transform / continue`三种返回。`time`也是原版提供的本地处理分支，但本课没有单独验收。

`input`位于用户输入阶段，不等于每次请求前的`before_provider_request`。它明确跳过`source=extension`；请在终端完成这项练习，网页转发的输入不一定触发相同分支。

两个文件均来自Pi 0.85.1官方示例。完成操作后，打开源码对照“工具调用前”和“用户输入时”两个位置，理解Hook如何改变执行过程。

## 6. 用提示词模板与Skill组织一次编程任务

这组练习让你把“如何提出任务”和“如何完成任务”分开：`implement.md`把输入展开为固定任务要求，`coding-verification` Skill提供操作步骤，Todo记录进度。三者已在课程MVP案例中配合使用。通过`npm run mvp`可以加载项目模板与Skill；其他单项入口默认关闭这两类资源的自动发现。

- 模板：[implement.md](samples/mvp/.pi/prompts/implement.md)。用`$1`接收任务，展开“创建Todo→读取源码与测试→运行基线→修改filter.js→测试→diff→总结”。模板不新增工具，也不强制执行权限。
- Skill：[SKILL.md](samples/mvp/.pi/skills/coding-verification/SKILL.md)。规定读取、测试、最多两轮修正、不改测试制造通过、未执行项如实报告。练习时留意Agent是否实际读取了Skill文件，而不只是声称遵循了流程。
- 规则：[AGENTS.md](samples/mvp/AGENTS.md)。限定实现、命令和业务语义，是项目文字约定；这些文字约定不会自动变成工具层的强制拦截。
- 调用：`npm run mvp`，在Pi中输入`/implement "给列表增加标题关键词与状态联合筛选"`。引号让整段任务进入`$1`；这里是在Pi输入栏，不是shell里执行。
- 本包`samples/mvp`是参考完成版，预期9/9通过。要从失败开始：先复制整个mvp为新练习目录，将`samples/mvp-initial/filter.js`复制为新目录的`src/filter.js`，在新目录初始化Git并`git add .`建立差异基线，然后运行Pi加载Todo。初始预期3通过、6失败；保留参考完成版，方便练习后对照实现与测试结果。
- 模板和Skill适用于这个JS案例，只修改filter.js。不要直接套到三文件TypeScript复杂案例，否则规则冲突。
- `pi-subagents`自带模板和Skill、`pi-mcp-adapter`自带Skill均完整保存在各自发布包里，你可以继续阅读并选择适合自己任务的内容；这些附带资源尚未逐一验证。单项入口默认不加载它们。

Pi模板发现和参数展开参考[官方模板说明](https://pi.dev/docs/latest/prompt-templates)；固定版本细节另见[sources中的同版文档](sources/earendil-works-pi-coding-agent-0.85.1/docs/prompt-templates.md)。

## 7. 四个Pi基础包与三个运行辅助包

| 包 | 版本 | 本课作用与边界 |
|---|---|---|
| @earendil-works/pi-coding-agent | 0.85.1 | 完整编程Agent宿主、CLI、会话、资源加载、SDK；默认read/bash/edit/write是内置工具，不是四个额外扩展 |
| @earendil-works/pi-agent-core | 0.85.1 | Agent状态与运行循环；单独使用核心不会自动加载本课Extension体系 |
| @earendil-works/pi-ai | 0.85.1 | 模型接口与类型；当前coding-agent组合依赖它。企业可选择其他架构，但不能直接删除现有依赖宣称同等可用 |
| @earendil-works/pi-tui | 0.85.1 | 原生终端组件与交互；企业纯Web不需要展示TUI，但本例Web UI依附coding-agent宿主，并非独立最小核心UI |
| typescript | 5.9.3 | tsc类型检查，TS语言服务基础；检查通过不代表业务测试通过 |
| typescript-language-server | 5.1.3 | 给LSP扩展启动的语言服务器进程；扩展和语言服务器是两层 |
| tsx | 4.21.0 | 执行TypeScript脚本/测试；不是Agent扩展，也不提供LSP能力 |

这些包都有实际tgz及解压内容，路径和许可证看manifest。未新增qmd、其他语言服务器、浏览器运行时、企业数据库驱动；需要这些能力时，再按对应项目的要求安装和配置。

## 8. 安装后如何选配进自己的项目

本包的`npm ci`只安装依赖；Pi资源必须另行加载。先用单项入口看清功能，再迁移到自己的项目。如果你已经安装Pi，也可以在自己的项目中按固定版本安装：

```bash
pi install -l npm:pi-memory@0.4.2
pi install -l npm:pi-web-access@0.29.0
pi install -l npm:pi-mcp-adapter@2.34.0
pi install -l npm:@narumitw/pi-lsp@0.49.7
pi install -l npm:pi-subagents@0.68.0
pi install -l npm:@kkkiio/pi-web-ui@0.1.1
```

这组命令走npm网络源，`-l`写当前项目设置，不是读取本包缓存。若想复用已安装的本地目录，可用`pi install -l /实际路径/学员扩展资源包-20260918/node_modules/pi-memory`；请把示例路径替换成资源包在你电脑上的实际位置。Pi本地资源路径只登记、不复制，所以登记后不要随意移动目录。

使用tarball请走npm（本包package.json已配置），不要假定`pi install ./某包.tgz`会自动解压加载。包资源与安装方式见[Pi Packages官方文档](https://pi.dev/docs/latest/packages)。

组合时一次加一个：Todo/模板/Skill → Memory → MCP → 联网 → LSP → Subagents → Web UI。每加一个就确认“资源出现、工具真实调用、输出可核对”。Hooks建议先在独立终端中练习，再决定是否合并到自己的宿主；合并后需检查重复加载和事件顺序。

## 9. 如何判断练习成功，以及遇到问题怎么办

资源包已在独立环境中完成依赖安装、9个Extension入口加载、模板与Skill发现检查。参考MVP测试9/9通过，初始版本为3通过、6失败，MCP合成服务能够返回协议响应。详细检查记录见[validation.json](validation.json)。这些检查可以帮助你区分资源文件问题与本机环境问题；模型、网络和操作系统不同，仍需要在自己的环境中确认运行结果。

| 练习 | 你需要看到什么 | 还要检查什么 |
|---|---|---|
| 模板、Skill与Todo | `/implement`展开任务，Agent读取Skill，Todo出现并更新 | 实际测试通过、diff只包含预期修改 |
| Memory | 工具写入成功，新会话读回同一条约定 | Markdown文件位置与内容一致 |
| 联网 | 搜索与抓取返回真实内容和来源 | 来源可信、结论与原文相符 |
| MCP | 返回4小时、24小时阈值和6条工单 | 工具调用日志对应本次请求 |
| LSP | 指定文件出现诊断，修复后对应问题消失 | 项目测试和typecheck仍需通过 |
| Subagents | 子任务实际运行，返回各自的调查或审查结果 | 模型可用、修改范围符合约定、结论有依据 |
| Web UI | 页面可打开，消息与工具结果可见 | 额外工具已加载，关闭会话后服务状态符合预期 |
| 两个Hook | 写入被拦且文件未变；ping本地回复；quick改写输入 | 分清工具前拦截与输入处理的触发位置 |

常见问题：

- 只安装了包但看不到工具：检查是否通过`-e`或Pi packages设置加载；确认没有`--no-extensions`后漏掉显式入口。
- 模板不出现：进入`samples/mvp`，检查`.pi/prompts`，不要带`--no-prompt-templates`；使用`/implement`而非直接在shell运行。
- LSP提示服务器不可用：确认`typescript-language-server`在子进程PATH，检查受信任项目配置；不是反复让模型猜错误。
- MCP无结果：先检查python3与合成文件，再看MCP调用日志；进程启动成功不等于协议握手通过。
- 子Agent找不到模型：检查其Provider/模型可见性；父进程成功不能替代子进程配置。
- Web端口被占用：更换本机端口后重启；没有认证就不要直接对外监听。
- Memory内容不对：检查实际目录和文件，纠正历史条目；不能用重试掩盖错误记忆。
- 模型Connection error：保留当前输出，确认哪些工具已经成功，再从剩余步骤继续，避免重复写入。历史测试发生过连接错误，不承诺零失败。

## 10. 保存练习成果与查阅来源

建议保留一份未修改的资源包，在副本里练习。`npm run verify`可检查原始资源文件是否完整；如果你有意修改了示例或文档，校验出现差异是正常的，需要对照自己的改动判断。

安装后会生成`node_modules`，记忆练习会生成`student-state`。备份或分享练习成果时，请检查是否夹带自己的模型凭据、会话内容或项目记忆。

每个发布包的原始LICENSE/NOTICE保留在sources与tgz内；部分npm包未带独立LICENSE文本，manifest仍保留其声明。Pi官方示例许可证另见[LICENSE](official-examples/LICENSE)。课程模板、Skill、合成数据和启动脚本用于配套练习；复用第三方扩展时，请遵循各自的许可证。

遇到版本差异时，先看`sources/`中随包保存的同版说明，再查上游文档。这里的MCP数据均为合成样例；迁移到真实企业项目时，你需要重新配置数据来源，并验证身份、数据权限和只读边界。
