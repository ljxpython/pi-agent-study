# 在本项目根目录执行 source ./course-env.sh，然后直接 pi。
export PI_MEMORY_DIR="$PWD/.course-memory"
export PI_MEMORY_QMD_UPDATE=off
# 本练习只用 Markdown 读写，不安装或声明已验证 QMD 语义搜索。
export PI_MEMORY_EXIT_SUMMARY=0
export PI_MEMORY_SUMMARIZE_TRANSITIONS=0

# 自动将学员扩展资源包中的 pi 二进制目录注入 PATH (完美兼容 zsh 与 bash)
COURSE_BIN="$(cd "$(dirname "${(%):-%N}" 2>/dev/null || dirname "${BASH_SOURCE[0]}" 2>/dev/null || echo ".")"/../.. && pwd)/node_modules/.bin"
if [ -d "$COURSE_BIN" ]; then
  export PATH="$COURSE_BIN:$PATH"
fi

# 自动加载大模型 API Key 环境配置
if [ -f "$HOME/.my_best/.env" ]; then
  set -a
  source "$HOME/.my_best/.env"
  set +a
fi
