# 第一课课件资料使用说明

单文件 HTML 可直接用浏览器打开，用于查看交互讲解。`sdk-demo` 是配套的最小 SDK 示例：向你配置的模型发送一次“你好”，显示真实回复。它不加载扩展、不调用文件工具，也不演示多轮对话。

## 1. 保持文件位置

`sdk-demo` 中的 `package.json` 与 `sdk-chat.mjs` 请一起保留。使用配套 Notebook 时，将 `.ipynb` 文件放在本说明所在目录，与 `sdk-demo` 文件夹同级，并让 Notebook 的工作目录保持在这里。

## 2. 安装 SDK 依赖

需要 Node.js 22.19.0 或更高版本及 npm。在本说明所在目录打开操作系统终端，先检查环境：

```bash
node --version
npm --version
```

若命令不存在或 Node.js 版本过低，先准备环境，再继续。然后安装示例依赖：

```bash
npm install --prefix sdk-demo --ignore-scripts
```

命令按照 `package.json` 安装 Pi SDK `0.85.1` 到示例目录，不替换全局 Pi。安装失败时先处理网络、权限或依赖错误，不继续运行示例。`node_modules` 由学员本地安装产生，无需随课件分发。

## 3. 准备模型并运行

先按完整课件配置自己的模型服务及凭据，并确认 Pi 中的最小对话成功。示例读取现有 Pi 模型配置；默认配置目录为 `~/.pi/agent/`，自定义配置目录需与运行环境保持一致。供应商标识和模型 ID 应与实际配置一致，不是界面上的任意显示名称。

以下命令适用于 macOS/Linux 的 Bash 或 zsh。把引号内的占位内容替换为自己的实际值，在同一终端执行：

```bash
export PI_DEMO_PROVIDER='替换为供应商标识'
export PI_DEMO_MODEL='替换为模型ID'
```

这两个变量只负责选择模型，不提供 API Key。若模型配置通过环境变量读取凭据，还需按课件在当前终端准备相应变量；不要把真实凭据写入课件或分享文件。准备好后，从本说明所在目录运行：

```bash
node sdk-demo/sdk-chat.mjs
```

正常时应显示所选模型、“你：你好”以及模型的实际回答，随后退出。回答内容不要求逐字相同。若报未设置变量、未找到模型或请求失败，分别检查当前终端变量、模型标识、服务地址与凭据，修正后再试；必要时按 Ctrl+C 停止终端运行。

## 4. 在 Notebook 中查看结果

使用配套 Notebook 时，需要可用的 Python/Jupyter 环境。从上述已准备好变量的同一终端启动 Jupyter，再打开同级的课件 `.ipynb`，运行 SDK 小节的 Python 单元。Python 负责调用 Node.js，实际 Agent 对话由 `sdk-chat.mjs` 完成；该单元等待请求结束后统一显示输出，并设置了 60 秒超时。

已经运行的 Jupyter 不会自动继承另一个终端新设置的变量。遇到变量缺失，应从准备好环境的终端重新启动 Jupyter；遇到找不到脚本，应检查 Notebook 工作目录；遇到找不到 `node`，应检查启动 Jupyter 时的 PATH。
