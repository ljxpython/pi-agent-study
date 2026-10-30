#!/usr/bin/env bash
# 动态获取当前脚本所在目录，确保无论在哪个终端、哪个工作目录下 source 都能正确解析
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# 动态定位项目内部安装的 pi 二进制路径（严禁硬编码绝对路径）
RESOURCE_BIN="$(cd "$SCRIPT_DIR/../../part2-harness/学员扩展资源包-20260918/node_modules/.bin" 2>/dev/null && pwd)"
RESOURCE_MODULES="$(cd "$SCRIPT_DIR/../../part2-harness/学员扩展资源包-20260918/node_modules" 2>/dev/null && pwd)"

if [ -n "$RESOURCE_BIN" ] && [ -d "$RESOURCE_BIN" ]; then
  export PATH="$RESOURCE_BIN:$PATH"
fi

if [ -n "$RESOURCE_MODULES" ] && [ -d "$RESOURCE_MODULES" ]; then
  export NODE_PATH="$RESOURCE_MODULES:${NODE_PATH:-}"
fi

# 自动加载大模型 API Key 环境配置（零感知静默加载，确保 DeepSeek / XiaoK 鉴权无缝透传）
if [ -f "$HOME/.my_best/.env" ]; then
  set -a
  source "$HOME/.my_best/.env"
  set +a
fi
