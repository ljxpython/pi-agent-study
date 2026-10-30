#!/usr/bin/env bash
# ==============================================================================
# verify-all.sh: 自动化研学质量门禁脚本 (Automated Quality Gate)
# 
# 铁律：Agent 在向学习者交付任何笔记、沙盒代码或知识站前，必须在后台静默执行此脚本！
# 必须 Exit Code 0 绿灯全过，方可交卷。
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}🔍 启动研学项目全量质量门禁检查 (Quality Gate Verification)...${NC}"
echo -e "${BLUE}================================================================${NC}"

# ------------------------------------------------------------------------------
# Check 1: 扫描 Markdown 文件中是否有写死的宿主机绝对路径
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Check 1/4] 检查宿主机绝对路径残留 (/Users/ 或 C:\)...${NC}"
ABS_PATHS=$(grep -rnE --exclude-dir=raw --exclude-dir=node_modules --exclude-dir=.git "(\(/Users/|\(C:\\\)" "${ROOT_DIR}/03-notes" "${ROOT_DIR}/01-resources" "${ROOT_DIR}/AGENTS.md" "${ROOT_DIR}/USAGE.md" 2>/dev/null || true)

if [ -n "${ABS_PATHS}" ]; then
  echo -e "${RED}❌ 发现死硬编码的宿主机绝对路径（必须替换为相对路径）：${NC}"
  echo "${ABS_PATHS}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ 通过：未检测到宿主机绝对路径残留。${NC}"
fi

# ------------------------------------------------------------------------------
# Check 2: 扫描 Mermaid 代码块中常见的保留字冲突
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Check 2/4] 检查 Mermaid 语法保留字冲突 (如 participant Loop / participant end)...${NC}"
MERMAID_CONFLICTS=$(grep -rnE --exclude-dir=raw --exclude-dir=node_modules --exclude-dir=.git "(participant[[:space:]]+Loop[[:space:]]|participant[[:space:]]+end[[:space:]]|participant[[:space:]]+subgraph[[:space:]])" "${ROOT_DIR}/03-notes" "${ROOT_DIR}/AGENTS.md" "${ROOT_DIR}/USAGE.md" 2>/dev/null || true)

if [ -n "${MERMAID_CONFLICTS}" ]; then
  echo -e "${RED}❌ 发现 Mermaid 保留关键字冲突（会导致渲染时出现炸弹报错）：${NC}"
  echo "${MERMAID_CONFLICTS}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ 通过：未发现易引发解析崩溃的 Mermaid 关键字。${NC}"
fi

# ------------------------------------------------------------------------------
# Check 3: 扫描 Markdown 中相对路径链接的死链情况 (基本文件存在性核验)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Check 3/4] 检查本地相对路径超链接是否有效 (Dead-link Check)...${NC}"
DEAD_LINKS=0

# 提取 Markdown 中以 ./ 或 ../ 开头的相对路径链接并验证 (排除模板文件和 raw 目录)
while IFS= read -r md_file; do
  # 跳过模板示范文件
  if [[ "${md_file}" =~ template\.md$ ]]; then
    continue
  fi
  dir_of_file="$(dirname "${md_file}")"
  # 提取 [text](rel_path) 中的相对路径
  links=$(grep -oE '\[[^]]+\]\(\.\.?[^)]+\)' "${md_file}" | sed -E 's/.*\]\(([^)#]+).*/\1/' || true)
  for rel_link in ${links}; do
    # 忽略纯 hash 或网络链接
    if [[ "${rel_link}" =~ ^http || "${rel_link}" =~ ^mailto || "${rel_link}" =~ ^# ]]; then
      continue
    fi
    target_path="${dir_of_file}/${rel_link}"
    if [ ! -e "${target_path}" ]; then
      echo -e "${RED}❌ 死链发现：在 ${md_file} 中引用的 [${rel_link}] 不存在！${NC}"
      DEAD_LINKS=$((DEAD_LINKS + 1))
    fi
  done
done < <(find "${ROOT_DIR}/03-notes" "${ROOT_DIR}/01-resources" -path "*/raw" -prune -o -name "*.md" -print 2>/dev/null)

if [ "${DEAD_LINKS}" -gt 0 ]; then
  echo -e "${RED}❌ 共检测到 ${DEAD_LINKS} 个无效相对路径死链！${NC}"
  ERRORS=$((ERRORS + DEAD_LINKS))
else
  echo -e "${GREEN}✅ 通过：所有本地相对路径超链接均有效。${NC}"
fi

# ------------------------------------------------------------------------------
# Check 4: 静态知识站 (04-outputs/site) 构建健康度检查 (如已初始化)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Check 4/4] 检查 Astro 静态知识站构建健康度...${NC}"
SITE_DIR="${ROOT_DIR}/04-outputs/site"

if [ -f "${SITE_DIR}/package.json" ]; then
  if [ -d "${SITE_DIR}/node_modules" ]; then
    echo -e "正在执行静态知识站构建测试 (npm run build)..."
    if (cd "${SITE_DIR}" && npm run build > /dev/null 2>&1); then
      echo -e "${GREEN}✅ 通过：Astro 静态知识站 100% 编译通过，Pagefind 索引成功！${NC}"
    else
      echo -e "${RED}❌ 静态知识站构建失败，请检查 Astro 页面或 Markdown 语法！${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo -e "${YELLOW}⚠️ 跳过：site/node_modules 尚未安装，建议运行 npm install 后验证。${NC}"
  fi
else
  echo -e "${GREEN}✅ 通过：未启用或未配置 site/package.json，跳过构建检验。${NC}"
fi

# ------------------------------------------------------------------------------
# 门禁终局判定
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}================================================================${NC}"
if [ "${ERRORS}" -eq 0 ]; then
  echo -e "${GREEN}🎉 恭喜！全量质量门禁 100% 检查通过，具备交付标准！${NC}"
  echo -e "${BLUE}================================================================${NC}"
  exit 0
else
  echo -e "${RED}🚫 门禁拦截！共发现 ${ERRORS} 处质量违规，严禁向学习者交付！请先修复上述问题！${NC}"
  echo -e "${BLUE}================================================================${NC}"
  exit 1
fi
