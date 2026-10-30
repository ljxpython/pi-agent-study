# 研学排障与踩坑全记录 (Debug Log)

本文件如实记录在实操推进过程中遭遇的真实环境异常、原因剖析与解决方案。

---

## 踩坑 01：在 Warp/zsh 终端运行 `pi` 报错 `command not found: pi`

- **现象**：在 `student-workspaces/ticket-live` 运行 `source ./course-env.sh` 后，输入 `pi` 报 `zsh: command not found: pi`。
- **底层原因**：
  讲师在原版 `course-env.sh` 中只导出了 `PI_MEMORY_DIR` 等变量，但**并未将学员资源包的 `node_modules/.bin` 目录写入 `$PATH`**。若用户未在宿主机执行过第一课的全局安装命令（`npm install -g @earendil-works/pi-coding-agent@0.85.1`），zsh 无法在系统路径中寻址到 `pi`。
- **解决方案**：
  在 `student-workspaces/ticket-live/course-env.sh` 中增加跨 shell（兼容 zsh 与 bash）的 PATH 自动注入：
  ```bash
  COURSE_BIN="$(cd "$(dirname "${(%):-%N}" 2>/dev/null || dirname "${BASH_SOURCE[0]}" 2>/dev/null || echo ".")"/../.. && pwd)/node_modules/.bin"
  if [ -d "$COURSE_BIN" ]; then
    export PATH="$COURSE_BIN:$PATH"
  fi
  ```
- **验证**：重新执行 `source ./course-env.sh` 后，`which pi` 准确指向资源包二进制，`pi --version` 正确输出 `0.85.1`。

---

## 踩坑 02：运行 `/course-check` 报缺失 10 个工具（包括 `todo` 与 `memory` 系列）

- **现象**：在靶场终端输入 `/course-check`，检查结果显示 `missing: ["todo", "memory_read", ...]` 缺失 10 个扩展工具。
- **底层原因**：
  资源包根目录仅执行了 `npm install` 下载依赖，但未执行官方指定的 6 条 `pi install` 命令，导致 `~/.pi/agent/settings.json` 的 `packages` 数组未登记这些扩展，Pi 启动时无法加载。
- **解决方案**：
  在资源包根目录下完整执行 6 项扩展全局登记命令：
  ```bash
  ./node_modules/.bin/pi install npm:pi-memory@0.4.2 --approve
  ./node_modules/.bin/pi install npm:pi-mcp-adapter@2.34.0 --approve
  ./node_modules/.bin/pi install npm:pi-web-access@0.29.0 --approve
  ./node_modules/.bin/pi install npm:@narumitw/pi-lsp@0.49.7 --approve
  ./node_modules/.bin/pi install npm:pi-subagents@0.68.0 --approve
  ./node_modules/.bin/pi install ./official-examples/todo.ts --approve
  ```
- **验证**：重新运行 `/course-check`，`.course-evidence/registration.json` 中 `"missing": []` 为空列表，全部 14 个扩展工具就绪。
