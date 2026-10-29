# 第四章练习：让 Pi 完成工单查询与汇总工具

这里提供的是待实现项目，不是完成版。你将让 Pi 修改三个 TypeScript 文件，并观察 Memory、MCP、联网、LSP、子 Agent 和 Todo 如何参与同一任务。

## 先准备，再启动

在**学员扩展资源包根目录**按总 README 安装五个社区包和官方 Todo。然后执行：

```bash
node scripts/prepare-ticket-demo.mjs
```

脚本创建新的 `student-workspaces/ticket-时间戳`，安装本项目的 TypeScript/测试依赖，并建立 Git 暂存基线；不修改全局 Pi 配置、不复制模型凭据、不覆盖旧项目。网络用于 npm 依赖安装，这不是全离线包。不要直接在本模板目录做题。

复制脚本打印的 `cd` 命令进入新项目，再逐条执行：

```bash
npm run preflight
source ./course-env.sh
pi
```

首次启动时检查并信任这个练习项目，才能加载项目资源。使用 `/model` 选择你已配置可用的模型，先发送一句简单问候确认响应，再输入 `/course-check`。缺工具、模型不可用或记忆目录不是当前项目 `.course-memory`，先处理原因。`/course-check` 只验证工具登记，不代替真实调用。

扩展只安装一次；以后仍然直接 `pi`。`source ./course-env.sh` 是本次教学隔离记忆所需的环境设置，同一终端只需执行一次；换终端、换项目时重新执行。它不负责安装或启动扩展。练习结束后开一个新终端使用其他项目，可避免继承本次环境变量。

## 文件对应什么

| 文件/目录 | 用途 |
|---|---|
| `src/sla.ts` | 计算经过时间与是否超时，等待实现 |
| `src/search.ts` | 筛选、排序，等待实现 |
| `src/report.ts` | 汇总数量、团队和列表，等待实现；初态有一处类型错误 |
| `sample.json` | 六条合成工单、固定报告时间、4/24小时政策 |
| `test/report.test.ts` | 24项业务测试 |
| `test/adversarial.test.ts` | 3项特殊团队名测试 |
| `.pi/mcp.json`、`tools/mcp-server.py` | Pi适配器连接本地只读MCP，返回政策和工单；不查询真实企业系统 |
| `.pi/pi-lsp.json` | 启动本项目的TypeScript语言服务器 |
| `.pi/agents/` | 只读调查/审查角色，继承当前模型；不会分发讲师模型配置 |
| `.pi/prompts/` | `/ticket-investigate`和`/ticket-implement`提示词模板 |
| `.pi/extensions/course-check.ts` | 课程辅助检查命令，不是另一个社区能力包 |
| `.course-memory/` | 实际运行后生成的MEMORY.md及daily日记 |
| `.course-evidence/` | 工具登记清单、MCP调用记录 |

`AGENTS.md`与提示词约定只修改三个实现文件；角色配置给子Agent只读工具。`check:protected`做事后哈希核对，不是操作系统沙箱，也没有迁入历史SDK的guard与bash白名单。

## 按顺序验证

1. 按[操作稿](../../../05-直播演示操作稿与提示词.md)T1写入约定，退出后以新的 `pi` 会话读回。
2. 粘贴T2或输入 `/ticket-investigate`；逐项检查工具回执。两种方式内容相同，选一种即可。
3. T2实际通过后，粘贴T3或输入 `/ticket-implement`。如果只测试基础开发，按操作稿说明显式跳过联网失败项，并保留“联网未通过”的记录。
4. 在同一项目另开终端，独立执行下面命令：

```bash
npm test
npm run test:edge
npm run typecheck
npm run demo
npm run check:protected
git diff -- src
git status --short
```

初态应是24项业务测试中7通过/17失败，3项反例失败，类型检查报 `total` 的string/number不匹配。这说明任务尚未完成，不是安装失败。

完成目标：24+3项测试全部通过、类型检查通过、受保护文件未变；open报告为total=5、overdue=2、byTeam={平台:3,前端:2}，rows顺序T01、T05、T02、T04、T06。

5. 通过后按T5把本次事实写入daily，打开实际Markdown文件核对。

## 当前验证边界

本机干净副本已验证依赖、普通CLI自动加载、Memory工具写读、MCP查询、LSP诊断和子角色发现；既有完成实现放入另一份新副本后通过24+3项测试与类型检查。这不代表新模型已经完成本轮开发。

本轮真实模型请求返回401 Invalid token，已停止重试；T1—T5模型执行、子Agent真实任务、原生TUI画面与计时彩排尚未通过。联网搜索已返回官方结果，但官方网站与官方仓库Markdown的正文抓取都出现乱码；raw模式也未取得有效正文。正文抓取当前未通过，操作稿保留独立复测和跳过该项的边界。不要把安装成功当作完整演示通过。
