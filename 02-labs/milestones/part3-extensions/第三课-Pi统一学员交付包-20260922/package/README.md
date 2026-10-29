# Pi第三课统一能力包

状态：候选包，整体验收未放行。已测与未测见交付根目录“验证说明.md”；单项测试通过不代表完整组合通过。

## 功能与基线

Pi 0.85.1，Node ≥22.19.0。包含 /project-map 模板、/monitor 监控栏、/activity 简洁执行，以及 /messenger 面板和 pi_messenger 团队工具、配套Skill。Teams涉及任务和文件协作，不只是显示；安装不自动开始团队任务。简洁执行依赖该版本的终端组件行为，不保证其他版本兼容。

完整版monitor开关只保留在当前进程，不具备课堂最小版的跨窗口开关合同。课堂源码不自动加载。本包不修改模型上限或压缩策略，不包含账号、认证和会话。

## 解压目录安装

保持整个package目录不移动。先确认使用自己的Pi 0.85.1与模型配置。进入要使用的项目，在系统终端运行：

```bash
pi install -l "/实际解压位置/package"
pi list
pi
```

上面的路径替换成真实绝对路径，含空格时加引号。本包生产代码无普通第三方运行库，核心peer由目标Pi宿主提供；日常使用不需要npm ci。按当前信任状态审阅项目资源。不要同时加载旧的monitor、activity、messenger副本或课堂最小底栏；先记录来源，仅停用确认冲突的资源。

也可在确认组合正常后省略-l安装到用户范围；不要项目和全局重复安装。已有Pi退出后再普通启动，或按实际情况/reload。新手优先按交付根README的新项目步骤操作。

## 调用

复制交付资料中的课堂练习/samples到当前项目后，在Pi输入框发送：

```text
/project-map samples/project-notes.md
/monitor off
/monitor on
/activity
/messenger
```

模板应说明Markdown标题练习，入口与验证尚未确定。/activity切换工具详情，不改变真实工具结果。/monitor展开/收起详情，on/off切换显示；off恢复Pi原生栏，不卸载扩展。

Teams先完成自己的模型配置（见交付根示例），再使用：

> 请只调用 pi_messenger 的 join 和 status 查看当前团队状态，不规划、不执行任务。

模型角色占位符必须替换为自己可用的provider/model，不要将示例整体覆盖已有pi-messenger.json。需要执行团队任务时，先在独立练习项目明确目标、成员模型与修改范围；本组合的自然语言团队完整流程尚待验收。

## 移除与数据

在安装项目退出Pi，系统终端执行同一来源路径：

```bash
pi remove -l "/实际解压位置/package"
pi
```

新进程不应再从本包加载资源。此操作不删除项目资料、团队历史、模型认证或其他扩展。团队注册数据在用户配置的messenger目录，任务在项目.pi/messenger/crew。监控栏可能读取本机Codex额度记录，仅显示快照，不是实时账单。

## 源码开发（使用者可跳过）

进入package目录执行npm ci --ignore-scripts后，可运行npm test与npm run verify:load。测试为局部验证，不发送模型请求。运行依赖由顶层清单统一管理；extensions/messenger/UPSTREAM-README.md仅供上游功能参考，统一安装以本文件为准。

## 三个完整扩展在哪里

| 扩展 | 实际入口 | 其他实现与资源 |
|---|---|---|
| 终端监控栏 | extensions/monitor/extensions/index.ts | 同目录上一级src/ |
| 简洁执行 | extensions/activity/index.ts | 同目录src/ |
| Agent Teams | extensions/messenger/index.ts | 同目录crew/、skills/及相邻TS模块 |

这些目录包含真正的实现，不使用原电脑目录的快捷方式或符号链接。始终保留整个package目录，单独取走一个入口文件会丢失相邻模块。
