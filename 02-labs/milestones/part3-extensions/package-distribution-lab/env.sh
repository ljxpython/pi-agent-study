#!/usr/bin/env bash
# ==============================================================================
# 🔥 老王暴躁技术流：Package 打包与消费沙盒环境激活脚本
# ==============================================================================
# 零宿主机污染保证：
# 1. PI_CODING_AGENT_DIR 锁定在当前沙盒内部；
# 2. pi CLI 别名指向沙盒已就绪的二进制；
# 3. 绝不触碰 ~/.pi/ 下的任何配置！
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PI_CODING_AGENT_DIR="${SCRIPT_DIR}/.pi-agent"
mkdir -p "${PI_CODING_AGENT_DIR}"

PI_BIN="/Users/lijiaxin/PyCharmMiscProject/ai-research/pi-agent-study/02-labs/milestones/part2-harness/学员扩展资源包-20260918/node_modules/.bin/pi"

# 设置别名与函数
function pi() {
  "${PI_BIN}" "$@"
}
export -f pi

echo "================================================================================"
echo "🚀 老王 Package 打包与分发实操沙盒已就绪！"
echo "================================================================================"
echo "📁 隔离配置目录 PI_CODING_AGENT_DIR: ${PI_CODING_AGENT_DIR}"
echo "🔧 当前 pi 命令指向: ${PI_BIN}"
echo "================================================================================"
echo "🎯 实战操作极速四步法："
echo "1. 打包:   cd ${SCRIPT_DIR}/producer-bundle && npm pack"
echo "2. 查验:   tar -tzf laowang-pi-custom-suite-1.0.0.tgz"
echo "3. 安装:   cd ${SCRIPT_DIR}/consumer-app && pi install -l \"../producer-bundle/laowang-pi-custom-suite-1.0.0.tgz\""
echo "4. 验证:   pi list  以及  npx tsx verify-e2e.ts"
echo "================================================================================"
