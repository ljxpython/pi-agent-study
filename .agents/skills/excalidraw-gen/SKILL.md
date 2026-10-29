---
name: excalidraw-gen
description: 专为 AI 应用开发工程师面试与技术架构打造的 Excalidraw 原生手绘思维导图生成与导出引擎。支持技术链路 (Pipeline)、智能体认知循环 (Agent Loop)、架构对比 (Versus)，提供 100% 原生双向物理吸附 Binding 协议与霞鹜文楷手绘中文字体渲染，一键离线导出 2x Retina 高清 SVG 与 PNG。
---

# Excalidraw 技术思维导图与架构生成技能 (Excalidraw Gen)

## 一、 技能定位

在 AI 应用开发工程师的面试准备与技术输出中，**千言万语不如一张高密度的手绘白板架构图**。
本技能负责将复杂的 AI 原理与系统设计（如：RAG 进阶检索重排链路、Agent 认知循环与死锁防护、Fine-tuning vs RAG 抉择矩阵）直接转化为：
1. **`.excalidraw` 纯文本工程文件**：可直接拖入 [excalidraw.com](https://excalidraw.com) 自由二次拖拽编辑，原生双向 Binding 保证节点拖动时连线绝对不散架。
2. **`.svg` 矢量图**：高清无损缩放，直接嵌入 `knowledge-site`、`01-interview-qa` 与 `knowledge-deck`。
3. **`.png` 超清位图**：2x Retina 像素级导出，直接作为掘金、知乎、小红书与 CSDN 技术文章的插图。

---

## 二、 核心技术优势（三大杀手锏）

1. **中文手绘字体原生劫持**：
   官方 Excalidraw 默认不支持中文手绘字体，导致中文直接变成死板黑体。本技能在渲染模板中通过 CSS `@font-face` 实现了 Unicode 字符集定向映射，默认注入 **「霞鹜文楷 (LXGW WenKai)」**，让导出的中文自带手绘白板温度与大牛质感！
2. **100% 原生双向物理吸附协议 (Dual-Binding)**：
   严禁使用绝对坐标死画连线。箭头的 `startBinding` / `endBinding` 与目标卡片的 `boundElements` 严格双向注册。
3. **极速无头离线导出**：
   无需人工打开浏览器点导出，通过 `scripts/export_image.py` 驱动 Playwright 与官方 `@excalidraw/utils` 秒级自动化批量生成 SVG/PNG。

---

## 三、 快速上手 (Quick Start)

### 1. 使用内置技术预设一键生成并导出
```bash
# 生成 RAG 进阶召回全链路并自动导出 SVG 与 PNG
python3 .agents/skills/excalidraw-gen/scripts/build_diagram.py --preset rag --export

# 生成 Agent 认知循环与死锁防护架构图并自动导出
python3 .agents/skills/excalidraw-gen/scripts/build_diagram.py --preset agent --export
```

### 2. 单独把已有 `.excalidraw` 文件导出为图片
```bash
python3 .agents/skills/excalidraw-gen/scripts/export_image.py \
  "assets/excalidraw/02-rag-hybrid-search-rerank.excalidraw" \
  -s "assets/excalidraw/02-rag-hybrid-search-rerank.svg" \
  -o "assets/excalidraw/02-rag-hybrid-search-rerank.png"
```

---

## 四、 技术视觉版式范式

| 版式类型 | 适用场景 | 经典案例 |
|---------|---------|---------|
| **Pipeline 链路型** | 多阶段数据流、检索召回重排、推理优化时序 | RAG 粗召回 ➔ 混合重排 ➔ 提示词组装 |
| **Loop 循环型** | 智能体自主决策、工具调用、失败自愈、死循环跳出 | ReAct (Thought ➔ Act ➔ Obs ➔ Reflection) |
| **Versus 决策型** | 技术选型对比、Trade-off 决策分析、方案优劣评估 | RAG vs Fine-tuning、Dense vs Sparse |

---

## 五、 输出与资产命名规范

所有生成的文件必须统一保存在 `assets/excalidraw/` 下：
- 工程文件：`assets/excalidraw/[序号]-[模块]-[英文简称].excalidraw`
- 矢量图：`assets/excalidraw/[序号]-[模块]-[英文简称].svg`
- 位图：`assets/excalidraw/[序号]-[模块]-[英文简称].png`

在 Markdown 中引用：
```markdown
![架构图](../../assets/excalidraw/02-rag-hybrid-search-rerank.svg)
```
