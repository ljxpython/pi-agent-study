#!/usr/bin/env bash
set -e

# ==============================================================================
# Part 2 全链路渐进式一键运行脚本 (run-part2.sh)
# ==============================================================================
# 🎯 包含三个演进阶段：
# 1. demo:01 - MCP 协议原始报文对齐与握手解密 (01-mcp-handshake.mjs)
# 2. demo:02 - Pi 扩展与 MCP 协议无缝融合与大模型自主决策 (02-pi-mcp-integration.mjs)
# 3. ticket  - Ticket Agent 工业级实战与 24+3 项测试门禁 (ticket-live)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DEMO_DIR="${SCRIPT_DIR}/milestones/part2-harness/mcp-demo"
TICKET_DIR="${SCRIPT_DIR}/milestones/part2-harness/ticket-live"

echo "=================================================="
echo "🚀 [Part 2] 开始执行 Harness 生态与 MCP 协议全链路演进..."
echo "=================================================="

# 1. 执行阶段 1：MCP 裸协议握手
echo -e "\n📌 [阶段 1] 运行 01-mcp-handshake.mjs (MCP 原始协议三步握手)..."
(cd "${MCP_DEMO_DIR}" && npm run demo:01)

# 2. 执行阶段 2：Pi 扩展与 MCP 动态挂载
echo -e "\n📌 [阶段 2] 运行 02-pi-mcp-integration.mjs (Pi 动态扩展与大模型多步推理)..."
(cd "${MCP_DEMO_DIR}" && npm run demo:02)

# 3. 执行阶段 3：Ticket Agent 24+3 单元测试与 Demo 运行
echo -e "\n📌 [阶段 3] 运行 Ticket Agent 工业级实战与质量门禁..."
(cd "${TICKET_DIR}" && npm test && npm run test:edge && npm run typecheck && npm run demo)

echo -e "\n=================================================="
echo "🎉 [Part 2] 全部 3 个阶段全链路自动化验证通过！"
echo "=================================================="
