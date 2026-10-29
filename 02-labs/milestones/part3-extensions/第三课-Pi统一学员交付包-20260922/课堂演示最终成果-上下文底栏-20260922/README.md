# 课堂演示最终成果：上下文底栏

这是 2026 年 9 月 22 日直播项目的最终源码副本：命令开关、上下文占用进度条、跨会话保存显示偏好。源码保持原样。它是课堂最小版，统一包中 monitor 是功能更多的完整版。

## 先运行看看

准备 Node.js 22.6 或以上、Pi Agent（本源码基于 0.85.1），并在日常 Pi 中配置自己的模型。这个目录不附带账号、认证或个人状态。

1. 将整个交付包解压，在终端输入 `cd `（后面有一个空格），再把本 README 所在的文件夹拖进终端，按回车。当前位置应是“课堂演示最终成果-上下文底栏-20260922”。
2. 若日常已启用完整版监控栏，先在原 Pi 会话输入 `/monitor off` 并退出；其他接管底栏的扩展也应停用，避免互相覆盖。
3. 在该目录执行：

```bash
# 确认当前目录包含入口和两个依赖文件
ls extensions
# 加载课堂版本，继续使用日常 Pi 的模型与认证配置
pi -e ./extensions/context-panel.ts
```

不要只复制入口文件，也不要把本目录中的三个 TS 文件分别注册为扩展。加载入口会自动引用另外两个文件。直接运行不需要先执行 npm ci。

进入 Pi 后逐条输入：

```text
/context-panel on
你好，请用一句话回复。
/context-panel off
/context-panel on
```

开启后底栏显示上下文占用百分比和进度条；没有可用用量时显示“上下文：待更新”。关闭后恢复 Pi 默认底栏。发送对话后观察占用变化。无参数 `/context-panel` 或 `/context-panel toggle` 反转开关。

## 新窗口怎样延续状态

在本目录用相同的 `pi -e ./extensions/context-panel.ts` 再开一个窗口，新会话读取最后一次成功保存的开关。默认保存于 `~/.pi/agent/lesson3-context-panel/state.json`；若自行设置了 PI_CODING_AGENT_DIR，则保存在对应 agent 目录下。

这不是所有已打开窗口实时联动：旧窗口在新建、切换会话或重载时重新读取。首次无记录默认开启，退出不会覆盖其他窗口最后保存的状态。此处只保存底栏开关，不保存模型或思考等级。

本版本通过 `-e` 按次加载，不会自动安装到所有项目。体验完整版时退出本窗口，再普通启动 Pi，并按完整版说明开启监控栏。

## 文件说明与继续开发

- `extensions/context-panel.ts`：唯一加载入口。
- `extensions/context-panel-core.ts`：命令、底栏绘制与生命周期逻辑。
- `extensions/context-panel-store.ts`：开关持久化与并发写入保护。
- `samples/project-notes.md`：练习用样本。
- `tests/`、`scripts/check.mjs`：类型与针对性回归检查；故障夹具不是运行入口。
- `package.json`、`package-lock.json`、`tsconfig.json`：开发检查配置。

开发方法使用交付包中的[Extensions 指南](../开发指南/Pi-Agent-Extensions标准开发指南.md)和[Package 指南](../开发指南/Pi-Agent-Package标准打包指南.md)。本目录按原直播工程交付，没有另加自动安装清单；不要把这里的 package.json 当作已注册资源的 Pi Package。

可选开发检查（仍在本目录）：

```bash
npm ci
npm run check
```

检查脚本需要找到全局安装的 Pi 及其 pi-tui 依赖。自动检查与实际模型对话是不同层次；完整包的验证边界见上一层“验证说明.md”。
