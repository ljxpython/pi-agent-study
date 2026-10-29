# 视觉提示词模板库规范与新增指南 (Template Catalog & Engineering Specification)

> **定位**：本目录是 `gpt-image-gen` 通用生图技能的**渐进式风格模板注册中心（Template Catalog）**。  
> 融合业界顶级项目（如 `awesome-gpt-image-2`、Fooocus）的工程精髓，采用**业务中立、三维正交分类（3D Taxonomy）与双模态提示词架构（自然语言流 + 结构化 JSON 树）**，实现即插即用、无限渐进扩展。

---

## 一、 模板目录结构

```
templates/
├── README.md                          # 本规范说明书与新增模板 SOP
├── 3d-staircase-evolution.yaml        # ⭐️【3D演化石阶】JSON 驱动的 3D 蜿蜒阶梯与时间轴信息图 (Structured JSON)
├── anime-character-sheet.yaml         # ⭐️【角色设定】动漫/游戏角色三视图与服装分解表 (Natural Language)
├── chibi-diptych.yaml                 # 【双格对垒】超萌 2D 矢量分屏对比漫画
├── comic-strip-story.yaml             # ⭐️【连续故事】垂直三格剧情与戏剧冲突条漫 (Natural Language)
├── creature-lore-sheet.yaml           # ⭐️【奇幻生物】哥特暗黑生物图鉴与誓言卡 (Natural Language)
├── executive-blueprint.yaml           # 【现代极简】包豪斯几何与商业组织权力拓扑
├── exploded-diagram-tech.yaml         # ⭐️【3D爆炸图】JSON 驱动的高科技硬件与系统架构拆解图 (Structured JSON)
├── handdrawn-map-infographic.yaml     # ⭐️【手绘地图】JSON 驱动的水彩美食与城市导览地图 (Structured JSON)
├── hero-metaphor.yaml                 # 【封面隐喻】高概念哲学与抽象意境视觉大图
├── infographic-decision-poster.yaml   # ⭐️【结构化海报】JSON 树驱动的教学决策与博弈解剖信息图 (Structured JSON)
├── infographic-grid-lecture.yaml      # ⭐️【硬卡片网格讲义】JSON 驱动的极简纯白高密度教学海报 (Structured JSON)
├── japanese-editorial-poster.yaml     # ⭐️【日式编辑】极简博物馆与独立杂志编辑风海报 (Natural Language)
├── narrative-cinema.yaml              # 【电影抓拍】35mm 胶片级现实冲突与博弈瞬间
├── stoic-woodcut.yaml                 # 【古典木刻】中世纪复古黑白蚀刻与羊皮纸版画
└── xiaohei-sketch.yaml                # 【怪诞手绘】纯白底极简手绘与小黑认知动作

> 💡 **灵感兵器谱**：详见 [`references/PROMPT_INSPIRATIONS.md`](../references/PROMPT_INSPIRATIONS.md)，收录了 10 大神级案例全景解剖、完整 Prompt 与老王技术点评！

---

## 二、 三维多面分类系统 (3D Taxonomy)

为了确保模板库具有全球工业级检索能力，每个模板必须在 Frontmatter 中明确声明三个正交维度的标签：

```yaml
taxonomy:
  scene: <使用场景>    # infographic-edu | editorial-article | cover-hero | social-card | tech-doc | ui-mockup
  style: <视觉风格>    # sketch-line-art | chibi-cartoon | cinematic-still | vintage-woodcut | minimalism-3d | vector-flat
  subject: <核心主体>  # diagram-chart | character-interaction | abstract-concept | architecture-flow | product-hardware
```

---

## 三、 双模态提示词架构 (Dual-Mode Prompt Architecture)

根据视觉复杂度的不同，模板库支持两类提示词骨架：

### 模式 A：自然语言流 (Natural Language Stream)
- **适用场景**：意境封面、艺术摄影、极简手绘等单主体/直觉型视觉（如 `hero-metaphor`、`xiaohei-sketch`）。
- **编写原则**：导演式分层交底，杜绝 `8k, masterpiece` 等远古水词，描述具体的物理材质、动作与光影。

### 模式 B：结构化 JSON 树 (Structured JSON Tree) ⭐️
- **适用场景**：双栏博弈海报、复杂信息图、爆炸分解图、流程回路、带文字排版海报（如 `infographic-decision-poster`）。
- **为什么使用 JSON？**：GPT Image 2/2.5 具备大语言模型底座，能精准理解 JSON 对象的父子层级关系，实现**顶层 Header、左右分栏、底部 Footer、箭头批注（Callouts）**的像素级空间布局，彻底解决自然语言排版混乱的千古难题！

---

## 四、 模板标准 YAML Schema 规范

```yaml
id: <template-id>              # 唯一标识符（如 infographic-decision-poster）
name: <风格名称>                # 人类可读名称
version: 1.0.0
prompt_mode: structured-json   # natural-language | structured-json

taxonomy:
  scene: infographic-edu
  style: sketch-line-art
  subject: diagram-chart

tags:                          # 通用检索标签
  - comparison
  - decision-tree
  - two-column

description: <风格定位与视觉特征概述>
use_cases:                     # 通用适用场景（面向任何项目）
  - "Side-by-side behavioral comparison and anatomical poster"

parameters:
  aspect_ratio: "16:9"         # 推荐画面比例
  recommended_size: "1024x576" # 推荐分辨率（需满足宽高为16的倍数）
  quality: "high"              # low | medium | high
  layout_type: "horizontal-split | single-focus | widescreen"

variables:                     # 参数化插槽与默认值 (Parameterized Slots)
  - name: <variable_name>
    description: <变量通用含义>
    default: "<开箱即用的默认值>"
    example: "<示例内容>"

prompt_skeleton: |             # 提示词骨架（自然语言字符串 或 JSON 字符串）
  ...

strict_negative: |             # 强制通用负向约束（防翻车铁律）
  STRICT NEGATIVE: ...
```

---

## 五、 如何新增一个新风格模板？（3 步极简 SOP）

1. **新建文件**：在 `templates/` 目录下新建 `<style-id>.yaml`；
2. **选择模式并填入 Schema**：按上述规约填写 `taxonomy`、`variables`，并选择使用自然语言流或结构化 JSON 树；
3. **跨项目即刻复用**：任何 Agent 或上层工作流均可通过 `taxonomy` 快速检索并加载该模板。
