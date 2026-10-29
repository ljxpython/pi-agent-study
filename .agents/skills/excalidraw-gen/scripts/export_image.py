#!/usr/bin/env python3
"""
Headless Excalidraw Image Exporter
Renders .excalidraw JSON into ultra-high-definition PNG & SVG using Playwright.
Applies native typography overrides (LXGW WenKai / 霞鹜文楷) for Chinese glyphs.
"""

import argparse
import json
import os
import sys
import time
from playwright.sync_api import sync_playwright

def export_excalidraw_to_image(input_file, output_png=None, output_svg=None, font_family="LXGW WenKai"):
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Resolve renderer template
    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.abspath(os.path.join(script_dir, "../templates/renderer.html"))
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Renderer template not found: {template_path}")

    # Determine default output paths if not specified
    input_base = os.path.splitext(input_file)[0]
    if not output_png and not output_svg:
        output_png = f"{input_base}.png"

    print(f"🎨 启动无头渲染引擎: {input_file}")
    print(f"🖋️ 目标中文字体: {font_family}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # device_scale_factor=2 gives crisp 2x retina images
        context = browser.new_context(device_scale_factor=2, viewport={"width": 3840, "height": 2160})
        page = context.new_page()

        file_url = f"file://{template_path}"
        page.goto(file_url)

        # Wait for ExcalidrawUtils to be ready
        try:
            page.wait_for_function("window.__READY__ === true || window.__ERROR__ !== undefined", timeout=15000)
        except Exception as e:
            error_val = page.evaluate("window.__ERROR__ || 'timeout'")
            browser.close()
            raise RuntimeError(f"渲染器加载失败: {error_val}") from e

        # Render Canvas for pixel-perfect PNG
        render_js = """
        async (excalidrawJson) => {
            const utils = window.ExcalidrawUtils.default;
            const container = document.getElementById('export-container');
            container.innerHTML = '';
            
            const canvas = await utils.exportToCanvas({
                elements: excalidrawJson.elements,
                appState: {
                    ...(excalidrawJson.appState || {}),
                    exportBackground: true,
                    viewBackgroundColor: "#ffffff",
                    exportWithDarkMode: false,
                    exportScale: 2
                },
                files: excalidrawJson.files || {}
            });
            
            container.appendChild(canvas);
            return { width: canvas.width, height: canvas.height };
        }
        """
        canvas_info = page.evaluate(render_js, data)

        # Give font a split second to render glyphs cleanly
        page.wait_for_timeout(300)

        # Capture PNG directly from Canvas element
        if output_png:
            os.makedirs(os.path.dirname(os.path.abspath(output_png)), exist_ok=True)
            canvas_elem = page.locator("canvas")
            canvas_elem.screenshot(path=output_png)
            print(f"✅ 高清 PNG 图片已生成: {output_png} ({canvas_info['width']}x{canvas_info['height']})")

        # Save SVG if requested
        if output_svg:
            svg_js = """
            async (excalidrawJson) => {
                const utils = window.ExcalidrawUtils.default;
                const svg = await utils.exportToSvg({
                    elements: excalidrawJson.elements,
                    appState: {
                        ...(excalidrawJson.appState || {}),
                        exportBackground: true,
                        viewBackgroundColor: "#ffffff",
                        exportWithDarkMode: false,
                        exportScale: 2
                    },
                    files: excalidrawJson.files || {}
                });
                return svg.outerHTML;
            }
            """
            svg_html = page.evaluate(svg_js, data)
            os.makedirs(os.path.dirname(os.path.abspath(output_svg)), exist_ok=True)
            with open(output_svg, "w", encoding="utf-8") as f:
                f.write(svg_html)
            print(f"✅ SVG 矢量图已保存: {output_svg}")

        browser.close()

    return output_png, output_svg


def parse_args():
    parser = argparse.ArgumentParser(description="Export Excalidraw to high-res PNG / SVG.")
    parser.add_argument("input", help="Path to .excalidraw file")
    parser.add_argument("-o", "--output-png", default=None, help="Output PNG path")
    parser.add_argument("-s", "--output-svg", default=None, help="Output SVG path")
    parser.add_argument("--font", default="LXGW WenKai", help="Handwritten font name")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    export_excalidraw_to_image(args.input, args.output_png, args.output_svg, args.font)
