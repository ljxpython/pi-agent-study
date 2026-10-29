# 第三课统一学员交付包

这是统一交付候选，尚未完成全部真实组合验收。请先阅读“验证说明.md”，不要据旧独立包的结果认定本包全部通过。

## 收到什么

- package：一个可安装的Pi Package，含project-map模板、终端监控栏、简洁执行、Agent Teams及必要Skill。
- 开发指南：Extensions与Package方法文档。
- 课堂练习：分阶段开发提示词、项目样本、早期最小底栏源码快照（不自动加载）。
- [课堂演示最终成果-上下文底栏-20260922](./课堂演示最终成果-上下文底栏-20260922/README.md)：直播最终工程，含完整三个 TS 文件、开关持久化与检查脚本，按次加载体验。
- 第三方来源：pi-messenger原始元数据与课程补丁。

## 最短试用流程

先安装兼容Pi并配置自己的模型。解压后保留整个目录，在一个新的练习项目中操作：

1. 将“课堂练习/samples”复制到该项目，保持samples/project-notes.md相对路径。
2. 确认没有同名project-map模板或旧版三扩展重复加载；已装旧版者记录并停用准确来源，不删除认证。
3. 在练习项目终端执行 pi install -l "/实际解压位置/package"；路径替换为真实路径。
4. 普通执行pi。输入 /project-map samples/project-notes.md，再按package/README.md测试显示与团队状态。
5. 用完按同一README移除项目安装；不要移动仍被引用的package目录。

模型认证继续使用日常全局配置；项目级安装只限制资源登记范围，不新建认证。无需把三个旧ZIP再分别安装。

开发提示词用于从零练习，不自动作为斜杠模板加载；如要跟课从零创建，先停用本包，以免现成功能掩盖练习结果。完整版与最小底栏不可同时接管底栏。

## 按课件从零练习前的准备

先停用统一包，避免现成功能与新开发功能重复。在系统终端创建课件使用的目录：

```bash
mkdir -p "$HOME/.pi/agent/lesson3-demo/materials"
mkdir -p "$HOME/.pi/agent/lesson3-demo/samples"
```

把“开发指南”中的两篇Markdown复制到上述materials目录；把“课堂练习/samples/project-notes.md”复制到上述samples目录。保留自己已有同名文件，不直接覆盖。第二章需要单独创建模板时，模板参考文件为package/prompts/project-map.md，放入~/.pi/agent/prompts后重新启动Pi；不要与统一包重复启用。

“分阶段开发提示词.md”按第三、四、五、六章顺序交给编程助手，每次只执行当前阶段。最小底栏参考源码供对照阅读，不是从零练习时必须安装的依赖。开发指南中的官方网络资料需要联网；开发时也可按自己安装的Pi版本查阅本地官方docs。

## 源码与分发范围

三个完整扩展已直接放入package/extensions/monitor、activity、messenger中；原单行转发入口已取消。请发送整个ZIP或完整解压目录，不只发送extensions内某一个文件。所有包内资源以相对路径引用；~/.pi是使用者自己的Pi配置位置，不是作者的目录。Pi宿主、Node与模型认证由使用者准备，账号和认证不随包分发。

解压后可在系统终端运行 `python3 验证工具/check_portability.py .` 检查本地引用完整性（当前目录为本交付包根目录）。这只检查文件与引用，不调用模型，也不代替真实使用验收。
