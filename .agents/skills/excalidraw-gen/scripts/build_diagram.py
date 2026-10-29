#!/usr/bin/env python3
"""
Industrial-grade Excalidraw Tech Diagram Builder
Specialized for AI Application Engineering (RAG, Agent, LLM Arch, System Design).

Features:
- Pure Python 3 standard library for schema building.
- 100% Native Dual-Binding protocol (startBinding, endBinding, boundElements).
- 3 Out-of-the-box tech paradigms:
  1. pipeline: Linear/branching dataflow (e.g. Advanced RAG Retrieval & Rerank)
  2. loop: Cognitive agent loops (e.g. ReAct / Tool Calling with Deadlock Escape)
  3. versus: Side-by-side technical trade-off decisions (e.g. RAG vs Fine-tuning)
- Dynamic JSON spec runner for custom topologies.
- Auto-triggers export_image.py for 2x Retina SVG & PNG exports.
"""

import argparse
import json
import math
import os
import sys

def get_hash_seed(s):
    h = 0
    for char in str(s):
        h = (h * 31 + ord(char)) & 0x7FFFFFFF
    return h

class TechExcalidrawBuilder:
    def __init__(self):
        self.elements = []
        self.elements_by_id = {}
        self.element_counter = 0

    def next_id(self, prefix="elem"):
        self.element_counter += 1
        return f"{prefix}_{self.element_counter}_{get_hash_seed(self.element_counter)}"

    def register_element(self, elem):
        self.elements.append(elem)
        self.elements_by_id[elem["id"]] = elem
        return elem["id"]

    def add_rectangle(self, x, y, width, height, stroke_color="#1e1e1e", bg_color="transparent",
                      fill_style="solid", stroke_width=2, stroke_style="solid", roughness=1,
                      roundness=3, opacity=100, group_ids=None, elem_id=None):
        eid = elem_id or self.next_id("rect")
        elem = {
            "id": eid,
            "type": "rectangle",
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "angle": 0,
            "strokeColor": stroke_color,
            "backgroundColor": bg_color,
            "fillStyle": fill_style,
            "strokeWidth": stroke_width,
            "strokeStyle": stroke_style,
            "roughness": roughness,
            "opacity": opacity,
            "groupIds": group_ids or [],
            "frameId": None,
            "roundness": {"type": roundness} if roundness else None,
            "seed": get_hash_seed(eid),
            "version": 1,
            "versionNonce": get_hash_seed(eid + "_nonce"),
            "isDeleted": False,
            "boundElements": [],
            "updated": 1720000000000,
            "link": None,
            "locked": False
        }
        return self.register_element(elem)

    def measure_text_bounds(self, text, font_size, line_height=1.35):
        lines = str(text).split("\n")
        max_w = 0
        for line in lines:
            w = 0
            for ch in line:
                if ord(ch) > 127:
                    w += font_size * 1.05
                else:
                    w += font_size * 0.58
            if w > max_w:
                max_w = w
        h = max(len(lines) * font_size * line_height, font_size * line_height)
        return max(int(max_w), 10), max(int(h), 10)

    def add_text(self, x, y, width, height, text, font_size=16, font_family=1,
                 text_align="left", vertical_align="top", stroke_color="#1e1e1e",
                 container_id=None, group_ids=None, elem_id=None, line_spacing_factor=1.45):
        text_str = str(text)
        if "\n" in text_str:
            lines = text_str.split("\n")
            step_y = font_size * line_spacing_factor
            cur_y = y
            first_id = None
            for i, line in enumerate(lines):
                if not line.strip():
                    cur_y += step_y * 0.6
                    continue
                sub_id = self.add_text(
                    x, cur_y, width, font_size * 1.25,
                    line, font_size=font_size, font_family=font_family,
                    text_align=text_align, vertical_align=vertical_align,
                    stroke_color=stroke_color, container_id=container_id,
                    group_ids=group_ids, elem_id=f"{elem_id}_l{i}" if elem_id else None
                )
                if first_id is None:
                    first_id = sub_id
                cur_y += step_y
            return first_id

        eid = elem_id or self.next_id("text")
        calc_w, calc_h = self.measure_text_bounds(text_str, font_size, line_height=1.35)

        elem = {
            "id": eid,
            "type": "text",
            "x": x,
            "y": y,
            "width": calc_w,
            "height": int(font_size * 1.25),
            "angle": 0,
            "strokeColor": stroke_color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "groupIds": group_ids or [],
            "frameId": None,
            "roundness": None,
            "seed": get_hash_seed(eid),
            "version": 1,
            "versionNonce": get_hash_seed(eid + "_nonce"),
            "isDeleted": False,
            "boundElements": None,
            "updated": 1720000000000,
            "link": None,
            "locked": False,
            "text": text_str,
            "fontSize": font_size,
            "fontFamily": font_family,
            "textAlign": text_align,
            "verticalAlign": vertical_align,
            "baseline": int(font_size * 0.85),
            "containerId": container_id,
            "originalText": text_str,
            "lineHeight": 1.35
        }
        return self.register_element(elem)

    def add_arrow(self, start_x, start_y, end_x, end_y, stroke_color="#495057",
                  stroke_width=2, stroke_style="solid", roughness=1,
                  start_id=None, end_id=None, mid_offset=(0, 0), elem_id=None):
        eid = elem_id or self.next_id("arrow")
        dx = end_x - start_x
        dy = end_y - start_y
        mid_x = dx / 2 + mid_offset[0]
        mid_y = dy / 2 + mid_offset[1]

        points = [[0, 0], [mid_x, mid_y], [dx, dy]]
        elem = {
            "id": eid,
            "type": "arrow",
            "x": start_x,
            "y": start_y,
            "width": abs(dx),
            "height": abs(dy),
            "angle": 0,
            "strokeColor": stroke_color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": stroke_width,
            "strokeStyle": stroke_style,
            "roughness": roughness,
            "opacity": 100,
            "groupIds": [],
            "frameId": None,
            "roundness": {"type": 2},
            "seed": get_hash_seed(eid),
            "version": 1,
            "versionNonce": get_hash_seed(eid + "_nonce"),
            "isDeleted": False,
            "boundElements": None,
            "updated": 1720000000000,
            "link": None,
            "locked": False,
            "points": points,
            "lastCommittedPoint": None,
            "startBinding": {"elementId": start_id, "focus": 0.0, "gap": 8} if start_id else None,
            "endBinding": {"elementId": end_id, "focus": 0.0, "gap": 8} if end_id else None,
            "startArrowhead": None,
            "endArrowhead": "arrow"
        }
        self.register_element(elem)

        # Dual-binding protocol
        if start_id and start_id in self.elements_by_id:
            target = self.elements_by_id[start_id]
            if "boundElements" in target and target["boundElements"] is not None:
                target["boundElements"].append({"id": eid, "type": "arrow"})

        if end_id and end_id in self.elements_by_id:
            target = self.elements_by_id[end_id]
            if "boundElements" in target and target["boundElements"] is not None:
                target["boundElements"].append({"id": eid, "type": "arrow"})

        return eid

    def add_tech_card(self, x, y, width, height, title, subtitle=None, bullets=None,
                      theme_stroke="#1971c2", theme_bg="#ffffff", header_bg="#e7f5ff",
                      title_color="#1864ab", body_color="#212529", badge=None, card_id=None):
        cid = card_id or self.next_id("card")
        gid = f"grp_{cid}"

        # 1. Outer Box
        rect_id = self.add_rectangle(
            x, y, width, height,
            stroke_color=theme_stroke, bg_color=theme_bg, fill_style="solid",
            stroke_width=2, roundness=3, group_ids=[gid], elem_id=cid
        )

        # 2. Header
        header_h = 42
        self.add_rectangle(
            x, y, width, header_h,
            stroke_color=theme_stroke, bg_color=header_bg, fill_style="solid",
            stroke_width=2, roundness=3, group_ids=[gid]
        )

        # 3. Title Text
        self.add_text(
            x + 14, y + 10, width - 28, 22,
            text=title, font_size=16, font_family=1, text_align="left",
            stroke_color=title_color, group_ids=[gid]
        )

        # 4. Optional Badge
        if badge:
            bw, bh = len(badge) * 14 + 16, 22
            bx = x + width - bw - 10
            by = y + 10
            self.add_rectangle(
                bx, by, bw, bh, stroke_color=theme_stroke, bg_color=theme_stroke,
                fill_style="solid", stroke_width=1, roundness=2, group_ids=[gid]
            )
            self.add_text(
                bx + 6, by + 3, bw - 12, 16, text=badge, font_size=12,
                font_family=1, stroke_color="#ffffff", group_ids=[gid]
            )

        # 5. Subtitle & Bullets
        cur_y = y + header_h + 12
        if subtitle:
            self.add_text(
                x + 14, cur_y, width - 28, 20, text=f"📌 {subtitle}",
                font_size=13, font_family=1, stroke_color="#495057", group_ids=[gid]
            )
            cur_y += 24

        if bullets:
            for b in bullets:
                self.add_text(
                    x + 14, cur_y, width - 28, 20, text=f"• {b}",
                    font_size=13, font_family=1, stroke_color=body_color, group_ids=[gid]
                )
                cur_y += 22

        return rect_id

    def to_json(self):
        return {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": self.elements,
            "appState": {
                "viewBackgroundColor": "#ffffff",
                "gridSize": None
            },
            "files": {}
        }


# ==============================================================================
# Presets: Advanced RAG Pipeline, ReAct Agent Loop, Versus Trade-off
# ==============================================================================

def build_rag_pipeline():
    b = TechExcalidrawBuilder()

    # Title Banner
    b.add_rectangle(50, 40, 1100, 56, stroke_color="#099268", bg_color="#e6fcf5", stroke_width=2, roundness=3)
    b.add_text(80, 55, 1000, 30, "🔥 工业级 RAG 检索增强进阶召回全链路架构 (Advanced RAG Pipeline)", font_size=20, stroke_color="#087f5b")

    # Step 1: Query Processing
    c1 = b.add_tech_card(
        50, 140, 240, 170,
        title="1. 意图解析 & 扩展", subtitle="Query Transformation",
        bullets=["HyDE (假想文档生成)", "多轮对话上下文改写", "Query 路由与分流"],
        theme_stroke="#2f9e44", header_bg="#ebfbee", title_color="#2b8a3e", badge="入口"
    )

    # Step 2: Dual Retrieval
    c2_dense = b.add_tech_card(
        340, 120, 240, 140,
        title="2A. 语义稠密检索", subtitle="Dense Embedding",
        bullets=["BGE-M3 / OpenAI", "HNSW 向量索引库", "Top-K: 50 粗召回"],
        theme_stroke="#1971c2", header_bg="#e7f5ff", title_color="#1864ab", badge="向量"
    )
    c2_sparse = b.add_tech_card(
        340, 290, 240, 140,
        title="2B. 关键词稀疏检索", subtitle="BM25 / SPLADE",
        bullets=["专有名词 / 精确编号", "Elasticsearch / Qdrant", "Top-K: 50 粗召回"],
        theme_stroke="#e8590c", header_bg="#fff4e6", title_color="#d9480f", badge="字面"
    )

    # Step 3: Fusion & Rerank
    c3 = b.add_tech_card(
        630, 180, 250, 180,
        title="3. 混合融合与重排", subtitle="Fusion & Rerank",
        bullets=["RRF (倒数排名融合)", "Cross-Encoder (BGE-Reranker)", "过滤低分噪点 Chunk", "Top-K 压缩: 50 ➔ 5"],
        theme_stroke="#7048e8", header_bg="#f3f0ff", title_color="#5f3dc4", badge="核心防幻觉"
    )

    # Step 4: Generation
    c4 = b.add_tech_card(
        930, 160, 230, 200,
        title="4. 上下文装配与生成", subtitle="Context & Generation",
        bullets=["Lost-in-the-Middle 乱序重排", "Prompt 模板与安全约束", "LLM 流式回答生成", "引用溯源 (Citation)"],
        theme_stroke="#099268", header_bg="#e6fcf5", title_color="#087f5b", badge="产出"
    )

    # Connectors with Dual-Binding
    b.add_arrow(290, 200, 340, 180, start_id=c1, end_id=c2_dense, stroke_color="#2f9e44", stroke_width=2)
    b.add_arrow(290, 240, 340, 340, start_id=c1, end_id=c2_sparse, stroke_color="#2f9e44", stroke_width=2)
    b.add_arrow(580, 180, 630, 240, start_id=c2_dense, end_id=c3, stroke_color="#1971c2", stroke_width=2)
    b.add_arrow(580, 340, 630, 280, start_id=c2_sparse, end_id=c3, stroke_color="#e8590c", stroke_width=2)
    b.add_arrow(880, 260, 930, 260, start_id=c3, end_id=c4, stroke_color="#7048e8", stroke_width=2)

    return b.to_json()


def build_agent_loop():
    b = TechExcalidrawBuilder()

    # Title Banner
    b.add_rectangle(50, 40, 1000, 56, stroke_color="#1864ab", bg_color="#e7f5ff", stroke_width=2, roundness=3)
    b.add_text(80, 55, 900, 30, "🤖 工业级 ReAct Agent 认知循环与死锁防护架构", font_size=20, stroke_color="#1864ab")

    # Step 1: User & Input
    c_user = b.add_tech_card(
        50, 180, 220, 160,
        title="1. 用户请求 / 目标", subtitle="Task & Environment",
        bullets=["用户复杂指令", "系统 Prompt 约束", "工具定义 (JSON Schema)"],
        theme_stroke="#495057", header_bg="#f8f9fa", title_color="#212529", badge="Trigger"
    )

    # Step 2: LLM Reason
    c_llm = b.add_tech_card(
        330, 150, 250, 200,
        title="2. 推理与决策 (Reason)", subtitle="Thought & Tool Selection",
        bullets=["分解子目标 (Decomposition)", "评估环境反馈", "决定: 调工具 OR 直给终局", "输出严格 Tool Calls"],
        theme_stroke="#1971c2", header_bg="#e7f5ff", title_color="#1864ab", badge="LLM Core"
    )

    # Step 3: Tool Execution
    c_tool = b.add_tech_card(
        640, 150, 250, 180,
        title="3. 行动执行 (Act)", subtitle="Sandbox & Tool Execution",
        bullets=["参数校验 (Pydantic)", "网络/数据库/API 执行", "异常捕获 (Timeout/Error)", "结果格式化截断"],
        theme_stroke="#e8590c", header_bg="#fff4e6", title_color="#d9480f", badge="Execution"
    )

    # Step 4: Deadlock & Guard
    c_guard = b.add_tech_card(
        480, 400, 280, 180,
        title="4. 死锁检测与反射 (Reflection)", subtitle="Self-Correction & Safety",
        bullets=["死循环检测 (重复参数呼叫)", "上下文溢出裁剪 (Window Buffer)", "最大迭代轮数截断 (MaxSteps)", "反思失败并自适应换路"],
        theme_stroke="#c2255c", header_bg="#fff0f6", title_color="#a61e4d", badge="工业级安全网"
    )

    # Connectors
    b.add_arrow(270, 250, 330, 250, start_id=c_user, end_id=c_llm, stroke_color="#495057", stroke_width=2)
    b.add_arrow(580, 230, 640, 230, start_id=c_llm, end_id=c_tool, stroke_color="#1971c2", stroke_width=2)
    b.add_arrow(760, 330, 680, 400, start_id=c_tool, end_id=c_guard, stroke_color="#e8590c", stroke_width=2)
    b.add_arrow(480, 480, 400, 350, start_id=c_guard, end_id=c_llm, stroke_color="#c2255c", stroke_width=2)

    return b.to_json()


# ==============================================================================
# CLI Entrypoint
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate Excalidraw Tech Diagrams.")
    parser.add_argument("--preset", choices=["rag", "agent"], default="rag", help="Prebuilt technical diagram preset")
    parser.add_argument("-o", "--output", default=None, help="Output .excalidraw file path")
    parser.add_argument("--export", action="store_true", help="Auto-trigger export_image.py to generate SVG & PNG")

    args = parser.parse_args()

    # Generate JSON
    if args.preset == "rag":
        data = build_rag_pipeline()
        default_name = "02-rag-hybrid-search-rerank.excalidraw"
    elif args.preset == "agent":
        data = build_agent_loop()
        default_name = "03-agent-react-loop.excalidraw"
    else:
        raise ValueError(f"Unknown preset: {args.preset}")

    # Project root is 4 levels up from scripts/ (scripts -> excalidraw-gen -> skills -> .agents -> ai-learn)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "../../../../"))
    output_path = args.output or os.path.join(project_root, "assets/excalidraw", default_name)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Excalidraw 原生手绘图生成成功: {output_path}")

    # Optional export
    if args.export:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        exporter = os.path.join(script_dir, "export_image.py")
        svg_out = os.path.splitext(output_path)[0] + ".svg"
        png_out = os.path.splitext(output_path)[0] + ".png"
        cmd = f"python3 \"{exporter}\" \"{output_path}\" -s \"{svg_out}\" -o \"{png_out}\""
        print(f"🚀 自动启动无头导出引擎: {cmd}")
        os.system(cmd)

if __name__ == "__main__":
    main()
