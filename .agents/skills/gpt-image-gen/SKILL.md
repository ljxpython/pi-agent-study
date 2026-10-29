---
name: gpt-image-gen
description: 任何图像生成需求均激活此技能。覆盖教学信息图、社媒内容卡、品牌海报、艺术插画、人物写真、漫画叙事、科技拆解图、IP卡牌、创意合成等所有场景。通过 OpenAI-compatible Images API（gpt-image-2.5）生成，支持高文字密度信息图与自然语言两种模式。
---

# GPT Image Generation · 通用生图技能

## 环境配置

通过 `.env` 解析端点与密钥，严格优先级：

1. **项目 `.env`（最高优先级 ⭐️）**：`IMAGE_25_URL` / `IMAGE_25_KEY` / `IMAGE_25_MODEL`（默认 `gpt-image-2.5`）
2. **进程环境变量**：`IMAGE_25_*`（严格遵循 `IMAGE_25_*`，禁止其他别名）
3. **用户全局**：`~/.my_best/.env`

> ⚠️ **通道硬约束**：严禁切换至任何非 `IMAGE_25_*` 资源。失败必须如实报错，绝对禁止私自换模型或渠道。

**生图命令（全局与本地自适应）：**
```bash
# 全局调用（任意项目与终端通用，推荐）：
python3 ~/.gemini/config/skills/gpt-image-gen/scripts/generate.py "Prompt" -o "output.png" -s "1024x1024" -q high
# 项目本地调用（当前工作区有 .agents/skills/ 存在时）：
python3 .agents/skills/gpt-image-gen/scripts/generate.py "Prompt" -o "output.png" -s "1024x1024" -q high
```

---

## gpt-image-2 尺寸规格铁律

> 违反这些约束会直接报错或出废图！

| 规格 | 要求 |
|---|---|
| 像素倍数 | 长边和短边**必须都是 16 的倍数** |
| 宽高比上限 | 最大 **3:1**（不能更瘦长） |
| 最长边 | ≤ 3840px |
| 像素总量范围 | 655,360 ~ 8,294,400 像素 |

**标准推荐尺寸（直接用，不用算）：**
| 用途 | 尺寸 | 比例 |
|---|---|---|
| 竖版 HD（手机/封面） | `1024x1536` | 2:3 |
| 横版 HD（文章/封面） | `1536x1024` | 3:2 |
| 方图（头像/卡片） | `1024x1024` | 1:1 |
| 2K 宽屏 | `2560x1440` | 16:9 |
| 4K 超高清 | `3840x2160` | 16:9 |

---

## 提示词六大铁律（每次出图前必须自检）

> 这是决定出图质量的底层规则，违反任意一条都会导致图片废掉。

### 法则 1：文字必须用反引号包裹
画面中**所有需要显示的文字**必须用反引号（`` ` ``）包裹，让 AI 明确区分「描述指令」和「要画出来的文字」。

- ❌ `生成一张海报，上面有欢迎光临的字样`
- ✅ `生成一张海报，上面显示 \`欢迎光临\``

### 法则 2：位置用「容器」描述，禁用模糊方位词
「左边」「中间」「顶部」这些方位词 AI 理解偏差大，必须改成「在什么形状的容器里」。

- ❌ `把这段文字放在画面左侧`
- ✅ `在画面左侧的矩形框内，居中显示：\`这段文字\``
- ✅ `在画面顶部 15% 的横幅内，从左到右显示：\`这段文字\``

### 法则 3：插画必须与文字绑定描述
插画和对应文字必须在同一描述语句中出现，明确位置和归属关系。

- ❌ 「内容：人物介绍 / 插画：画一个人」（分开描述，AI 不知道放哪）
- ✅ 「\`人物介绍\`（旁边画一个戴眼镜咧嘴大笑的费曼简笔肖像）」

**插画描述公式**：`[主体] + [具体特征/动作] + [环境/位置] + [艺术风格/材质]`

| 维度 | ❌ 抽象（废） | ✅ 具体（可执行） |
|---|---|---|
| 人物 | 画一个人 | 画一位戴圆框眼镜的老奶奶，坐藤椅织毛衣，阳光在膝头形成光斑，水彩晕染风格 |
| 图标 | 画一个箭头 | 画一个深蓝到霓虹青的渐变箭头，3D玻璃质感，尖端悬浮发光粒子，指向右上方 |

### 法则 4：多图必须强制声明独立输出
AI 默认将多张图合并在一个画布。多图场景必须在指令最开头声明：

```
生成 3 张独立的单张图，每张图独立完整，禁止拼合在同一画布：
【第 1 张 - 独立完整的一张图】...
【第 2 张 - 独立完整的一张图】...
```

### 法则 5：单张图内容密度上限
| 维度 | 上限 | 超过怎么办 |
|---|---|---|
| 元素数量 | 8 个以内 | 拆成多张图 |
| 文字描述 | 300 字以内 | 拆成多张图 |
| 画布尺寸 | 2000px 以内 | 拆成多张图 |

**拆分策略**：9~16 个元素 → 拆 2 张；17~24 个 → 拆 3 张；25+ → 独立成篇。

### 法则 6：风格统一必须前置定义
系列图的风格只定义一次，放在所有图的描述之前：

```
## 整体风格统一（适用于所有 N 张图）
- 风格：手绘涂鸦笔记 (Sketchnote)
- 画幅：独立 3:4 竖版（750×1000px）
- 背景：浅米色纸张纹理，边角带水渍
- 配色：柔和暖色，黑色轮廓，黄/绿/红点缀
- 序号：右上角标注 01/03、02/03、03/03
---
【第 1 张】（在以上风格下，具体画什么）
```

### 法则 7：原子化图文互锁 (Atomic Multi-Compartment) ⭐️ 新
高信息密度知识图谱严禁使用模糊长难句。必须对每个单元格进行**原子化局部封闭描述**：
1. **物理外框死锁**：显式声明“深蓝手绘大圆角外框，内部精确切分为 2 列 × 4 行”。
2. **四件套语法锁定**：
   `Row {r} Col {c} ({ID})` ➔ `[红色双圈序号]` + `[模块手写标题与下划线]` + `[小胶囊框: 定义内容]` + `[1个具象微简笔画/图示]` + `[2~3点精炼列表]`。
   杜绝各模块间文字溢出与重合。

### 法则 8：纸张底衬与物理纯净度安全壳 (Paper Cleanliness Armor) ⭐️ 新
手绘/手账/笔记类出图，AI 极易自作聪明画出脏阴影、发灰褶皱和杂乱打孔。**必须在提示词开头与末尾双向锁定纯净安全壳**：
- **正向声明**：`The background is a completely flat, pristine warm cream-white (or cream-green grid) paper, absolutely flat without any binder rings, spiral coils (除非模板显式指定), hole punchers, harsh shadows, or dirty paper stains.`
- **负向拦截**：`Strict Negative: NO 3D rendering, NO photorealistic objects, NO binder rings, NO hole punchers, NO harsh shadows, NO dirty paper stains, NO blurry text, NO background overlap.`

### 法则 9：架构语义蒸馏与色块分层协议 (Architecture Structurer Protocol) ⭐️ 新
面对用户杂乱、发散的产品或系统描述，严禁直接丢进画图模型！必须先启动**架构结构化蒸馏器**：
1. **一句话定位**：系统靠什么变强、越用越怎样。
2. **严格 3~5 层从上到下分层**：
   - 每层只答两件事：① 是什么　② 负责什么/产出喂给谁。
   - 标注色块顺序（蓝 ➔ 绿 ➔ 紫 ➔ 橙 ➔ 灰），为画图 AI 设定色彩路由。
3. **数据闭环（一句话）**：从数据输入到下一次判断更准的完整闭环。
4. **待补清单**：没说清楚的地方绝不替用户硬编，单列「⚠ 待补」反问。

### 法则 10：大厂生产架构纯白矢量与单层卡片铁律 (Vector Flat & Single-Deck Rule) ⭐️ 新
工业级/企业级系统架构图出图，必须严格遵循防翻车红线：
1. **绝对纯白矢量底**：背景强制 `#FFFFFF`，杜绝 3D 渲染、玻璃反光、杂乱纹理。
2. **严禁冷色跳色污染**：全图色系统一为科技深蓝（Royal Navy Blue）、浅冰蓝（Ice Blue）与纯白，严禁突兀插入紫色（易导致扩散模型字符粘连崩溃）。
3. **彻底拍平，拒绝双层套娃**：卡片一律采用单层圆角白色长方块，横向并排单行卡片绝对不能超过 5~6 个，字数控制在 4~6 字以内，黑字白底，保证极高边缘对比度。

### 法则 11：色彩克制与呼吸通透 (Color Harmony)
- **拒绝杂乱刺眼**：底色与主视觉保持协调（低饱和或同色阶统合），点缀色适可而止，避免色彩打架。
- **防止颜色渗漏**：在提示词中避免突兀堆砌互斥的高饱和原色，保持整体画面的质感与通透呼吸。

### 法则 12：主次分明与空间呼吸 (Visual Hierarchy)
- **文字是主角，装饰是绿叶**：配图与装饰只烘托氛围，严禁遮挡、压盖文字主体。
- **构图灵动透气**：不拘泥死板骨架，根据内容自然排版流动，留足呼吸空间，杜绝死气沉沉的机械感。



---


## 构图决策矩阵

> Agent 在 Step 1 诊断需求后，必须先过这张矩阵确定构图，再选模板。

| 内容逻辑 | 典型场景 | 推荐构图 | 对应模板 |
|---|---|---|---|
| **知识速记/考点大盘** | 8大概念、核心考点、基础语法、术语地图 | 2×N 深蓝手绘大网格 | `sketchnote-knowledge-map` ⭐️ |
| **理论演进/深度剖析** | 架构演进时间线、调用链路、微架构剖析 | 5mm 方格纸三段式 (左文右图) | `studygram-swiss-grid` ⭐️ |
| **上手指南/实战总览** | 生产落地指南、大纲第 1 页、踩坑清单 | 活页打孔纸 + 7栏图标 + 火柴人 | `binder-geek-guide` ⭐️ |
| **公式/协议/选型盘点** | 工具库盘点、万能公式系列、选型对比 | 金属双线圈手账 + 胶带便签拼贴 | `spiral-notebook-scrapbook` ⭐️ |
| **全景生产架构全景** | 企业级 AI 平台全景蓝图、三栏翼展 | 三栏翼展纯白底 2D 矢量图 | `enterprise-architecture-blueprint` ⭐️ |
| **全景自检/痛点诊断** | 架构自检、排查避坑、社媒高互动引流图 | 多层堆栈 + 痛点警示标签 + 底部互动横幅 | `diagnostic-architecture-stack` ⭐️ |
| **执行流水线/Skills** | 5步线性流水线、从需求到执行的技能链路 | 单列纵向5层 + 灰色圆角序号 + 2×4技能矩阵 | `linear-skills-pipeline` ⭐️ |
| **治愈彩泥/玩法套图** | 工具玩法盘点、治愈系干货手账、小红书高赞爆款 | 3D 彩泥捏制 + 小熊吉祥物 + 圆角泥塑卡片 | `claymation-studygram-guide` ⭐️ |
| **复古素描/学霸手记** | 学习方法论、自律日程表、复古文艺手账 | 金属线圈装订 + 蘸水笔排线素描 + 焦糖淡彩 + 伏案少女 | `vintage-sketchbook-studygram` ⭐️ |
| **并列清单** | N个要点/建议/书单，无先后强弱 | 竖版卡片堆叠 / 网格布局 | `infographic-grid-lecture` |
| **层级递进** | 新手→进阶→专家，从0到1蜕变 | 阶梯递进 / 3D石阶 | `3d-staircase-evolution` |
| **对比分析** | 正确vs错误，传统vs现代，Before&After | 左右分屏双栏 | `infographic-decision-poster` |
| **总分结构** | 核心观点+N个分论点，一个主题多维度 | 花瓣环绕 / 中心发散 | `infographic-grid-lecture` |
| **地图/导览** | 城市探店，知识地图，美食地图 | 手绘水彩地图 | `handdrawn-map-infographic` |
| **叙事故事** | 博弈场景，情感冲突，角色对话 | 竖版多格条漫 | `comic-strip-story` |
| **电影封面** | 文章配图，演讲封面，哲学隐喻 | 16:9 电影横幅 | `hero-metaphor` |
| **角色人物** | 品牌IP，游戏角色，人物档案 | 三视图/多角度展示 | `anime-character-sheet` |
| **硬件拆解** | 产品爆炸图，系统架构，组件层级 | 3D立体爆炸图 | `exploded-diagram-tech` |

**万能兜底三选一**（想不出来就用这三个）：
1. 🃏 `2×N 深蓝手绘网格` → 概念速记类 (`sketchnote-knowledge-map`)
2. ⏳ `方格纸左文右图` → 原理与演进类 (`studygram-swiss-grid`)
3. 🌸 `线圈便签拼贴` → 选型与工具盘点 (`spiral-notebook-scrapbook`)

---

## 模板库总览

### 当前 22 个模板（按场景域分组）

**📝 学霸手绘手记（AI 核心技术与面试首选 ⭐️）：**
- `sketchnote-knowledge-map`：学霸手绘手账知识地图 (2xN 宫格、双圈红标、纯平底纸) ⭐️
- `studygram-swiss-grid`：现代学院派方格手绘笔记 (5mm方格纸、三色马克笔高亮、左文右图) ⭐️
- `binder-geek-guide`：极客活页草稿本上手指南 (活页纸打孔、7栏虚线能力、爬楼火柴人) ⭐️
- `spiral-notebook-scrapbook`：线圈手账便签拼贴风 (金属双螺旋线圈、和纸胶带、机器人吉祥物、清单卡) ⭐️

**🎓 教学信息图：**
- `3d-staircase-evolution`：9:16 三维石阶演化时间轴（层级递进、100字原生直出）⭐️
- `infographic-grid-lecture`：纯白底极简硬卡片网格（2~6字短语、零错字）
- `infographic-decision-poster`：左错右对双栏博弈海报（教学/心理诊断/SOP）
- `handdrawn-map-infographic`：复古水彩手绘导览地图（编号地标、图例）

**📖 漫画叙事：**
- `comic-strip-story`：竖版 3 格剧情故事条漫（两难抉择、对话气泡）
- `chibi-diptych`：超萌 2D 矢量双格对垒漫画（正反行为分屏对照）

**⚙️ 科技架构：**
- `exploded-diagram-tech`：3D 硬件立体爆炸拆解图（多层悬浮、引线标注）
- `executive-blueprint`：包豪斯极简几何权力拓扑（组织架构、商业博弈）

**🎨 艺术封面：**
- `hero-metaphor`：电影级哲学隐喻大图（16:9/2.35:1 文章封面）
- `narrative-cinema`：35mm 胶片级现实冲突人像（纪实光影、微表情）
- `xiaohei-sketch`：纯白底手绘极简怪诞动作插画（小黑 IP）
- `stoic-woodcut`：古典中世纪黑白蚀刻版画（先哲沉思卡片）

**🎪 品牌·社媒·通用：**
- `social-media-mockup`：社媒界面仿真截图（X/微博/小红书/直播间 UI）⭐️ 新
- `brand-poster`：品牌海报·国潮·城市系列·产品宣传 ⭐️ 新
- `encyclopedia-card`：科普百科卡·模块化图鉴（信息分区·评分·收藏级） ⭐️ 新

**⛩️ 角色设定：**
- `anime-character-sheet`：动漫/游戏角色三视图与服装分解（Model Sheet）
- `creature-lore-sheet`：哥特暗黑奇幻生物图鉴（属性、解剖、誓言封印）
- `japanese-editorial-poster`：极简日式编辑杂志展出海报（留白美学）

---

## 交互协议

### Protocol A：模板目录展示
当用户问「你有哪些模板/画风/风格」时，立即以**视觉架构师**身份展示以上模板库，按场景域分组呈现，然后询问用户目标场景。

### Protocol B：需求诊断 → 一键出图（4步流程）

```
Step 1: 意图识别 → 查 INTENT_DICTIONARY 路由
  ↓
Step 2: 构图决策 → 查构图决策矩阵 + 选模板
  ↓
Step 3: 提示词合成 → 套铁律六法则 + 适配模板 YAML
  ↓
Step 4: 出图确认 → 展示方案 → 执行 generate.py
```

#### Step 1：意图识别与场景路由
读取 `references/INTENT_DICTIONARY.md`，用快速路由决策树匹配用户意图 → 确定场景域。
- 意图明确 → 直接路由，必要时懒加载对应 `cases/*.md` 参考案例
- 意图模糊 → 执行 Protocol A 展示模板库，引导用户选择

#### Step 2：构图决策 + 模板选择
1. 用「构图决策矩阵」确定视觉结构
2. 选择最匹配的模板 YAML（读取 `templates/<id>.yaml`）
3. 决定生成模式：
   - **JSON 结构化模式**：文字密度 50+ 字、多栏对比、层级标注 → `3d-staircase-evolution` / `infographic-decision-poster` / `exploded-diagram-tech`
   - **自然语言模式**：情感张力、电影光影、人物故事 → `comic-strip-story` / `hero-metaphor` / `narrative-cinema`

#### Step 3：工业级提示词合成
1. **加载模板**：读取 YAML 的 `variables`、`prompt_skeleton`、`negative_prompt_block`
2. **语义蒸馏**：长句压缩为 2~6 字高频短语（如「避免盲目行动」→ `① 明确需求·杜绝盲动`）
3. **槽位注入**：将提炼短语注入模板语义槽，严格保留所有物理容器和网格结构
4. **安全壳注入**：追加 `strict_negative` 块（防脏斑/错字/比例畸变）
5. **六法则自检**：过一遍铁律六法则，确认文字包裹、位置容器、插画绑定、独立输出声明

#### Step 4：展示方案 + 执行出图
展示完整方案（场景域 × 构图 × 模板 × 提示词），然后执行（优先使用全局绝对路径，确保在任何工作区不报错）：
```bash
python3 ~/.gemini/config/skills/gpt-image-gen/scripts/generate.py "<prompt>" -o "<output-path>" -s "<size>" -q high
# 或本地项目路径：
# python3 .agents/skills/gpt-image-gen/scripts/generate.py "<prompt>" -o "<output-path>" -s "<size>" -q high
```

---

## 🧠 高信息密度手绘知识图谱提示词合成范式 (Prompt Synthesis Paradigm SOP) ⭐️

> **核心原则**：AI Agent 严禁将大段长篇大论的原版技术文字直接堆入提示词！高质量出图依靠的是 **4 步严密蒸馏与原子化封装**。

```
原始技术长文 / 代码 / 题目
       ↓
Step 1: 语义蒸馏 (Semantic Distillation) ➔ 压缩为高频短语 + 物理微隐喻
       ↓
Step 2: 构图骨架匹配 (Skeleton Selection) ➔ 4 大手绘手账母版匹配
       ↓
Step 3: 原子化图文互锁注入 (Atomic Slot Injection) ➔ 物理边界锁死 + 反引号包裹
       ↓
Step 4: 纸张纯净度与负向安全壳 (Armor Injection) ➔ 强制注入防脏/防阴影/防乱码
```

### 1. Step 1: 语义蒸馏 (Semantic Distillation)
将原本数十行的技术解析，提炼为统一的原子卡片四件套：
* **模块标题**：2~6 字（如 `Chunking 文档切分`、`MCP 工具协议`）
* **核心定义**：1 句话、20 字以内（如 `海量文本切为语义块`）
* **微简笔画隐喻**：将抽象代码具象化为 1 个生活/物理符号（如：切文档 ➔ 剪刀与重叠块；混合检索 ➔ 放大镜与磁铁；状态机 ➔ 小机器人头戴齿轮）
* **行动列表**：2~3 条短语，带 `•` 或 `☑️`（如 `• 固定长度/语义边界/父子切分`）

### 2. Step 2: 构图骨架匹配 (Skeleton Selection)
* 概念速记 / 考点大盘 (6~8项) ➔ 选 **`sketchnote-knowledge-map`**（2×N 宫格）
* 架构演进 / 理论模型 / 状态时序 ➔ 选 **`studygram-swiss-grid`**（5mm方格纸三段式左文右图）
* 实战上手指南 / 生产总览 / 避坑清单 ➔ 选 **`binder-geek-guide`**（活页打孔纸+火柴人）
* 工具库选型 / 万能公式系列 ➔ 选 **`spiral-notebook-scrapbook`**（金属线圈便签拼贴）

### 3. Step 3: 原子化图文互锁注入 (Atomic Slot Injection)
* 绝不使用模糊方位词（如“在旁边画”、“在右下角放文字”）。
* **单元格内部使用原子公式封闭描述**：
  `Row {r} Col {c} ({ID}): Top left shows red double-circle badge with {ID}, title {TITLE} underlined in red. Inside blue capsule: {DEFINITION}. Doodle illustration of {DOODLE}. Bullet points: {BULLETS}.`
* **所有要画出来的文字必须 100% 用反引号包裹**：`\`Token\``、`\`RAG 检索增强\``。

### 4. Step 4: 纸张纯净度与负向安全壳 (Armor Injection)
在生成的最终 Prompt 开头与结尾，强制缝合纯净纸张约束：
* **开头纸张锁定**：`The background is a completely flat, pristine warm cream-white paper with faint lines, completely flat without any binder rings, spiral coils (除非显式指定), hole punchers, or harsh shadows.`
* **末尾严格负向拦截**：`STRICT NEGATIVE: NO 3D rendering, NO photorealistic objects, NO metallic gloss, NO binder rings, NO hole punchers, NO harsh shadows, NO dirty stains, NO dark backgrounds, NO blurry text, NO cluttered overlap.`

---


## 资源文件索引

| 文件 | 用途 | 加载时机 |
|---|---|---|
| `references/STYLE_GUIDE.md` | 4大视觉法则 + 负向约束标准 | 合成提示词时参考 |
| `references/INTENT_DICTIONARY.md` | 场景域路由词典（~3K tokens） | **随 SKILL.md 永久加载** |
| `references/PROMPT_INSPIRATIONS.md` | 10 个顶级提示词范式精解 | 需要深度参考范例时 |
| `references/cases/infographic-edu-a.md` | 教学信息图案例（前28个） | 匹配 infographic-edu 意图时 |
| `references/cases/infographic-edu-b.md` | 教学信息图案例（后28个） | 匹配 infographic-edu 意图时 |
| `references/cases/social-media.md` | 社媒场景案例（70个） | 匹配 social-media 意图时 |
| `references/cases/brand-poster-a.md` | 品牌海报案例·国潮城市（33个） | 匹配 brand-poster 意图时 |
| `references/cases/brand-poster-b.md` | 品牌海报案例·产品节庆（33个） | 匹配 brand-poster 意图时 |
| `references/cases/art-illustration.md` | 艺术插画案例（45个） | 匹配 art-illustration 意图时 |
| `references/cases/character-portrait.md` | 人物写实案例（53个） | 匹配 character-portrait 意图时 |
| `references/cases/ip-collectibles.md` | IP卡牌收藏品案例（12个） | 匹配 ip-collectibles 意图时 |
| `references/cases/tech-hardware-a.md` | 硬件拆解爆炸图案例（61个） | 匹配 tech-hardware 意图时 |
| `references/cases/tech-hardware-b.md` | 系统架构科普案例（61个） | 匹配 tech-hardware 意图时 |
| `references/cases/comic-narrative.md` | 漫画叙事案例（11个） | 匹配 comic-narrative 意图时 |
| `references/cases/creative-special.md` | 创意特殊案例（21个） | 匹配 creative-special 意图时 |
| `templates/<id>.yaml` | 各风格模板详细规格 | 选定模板后读取 |
| `templates/README.md` | 新增模板 SOP | 扩展模板时 |

---

## 图像编辑范式（局部修改 vs 重新生成）

> 核心思想转变：编辑不是「重新生成」，而是「**控制变化范围**」——只改要改的，其他全部锁死。

### 编辑七大场景 + 提示词公式

| 场景 | 核心公式 | 关键约束词 |
|---|---|---|
| **风格迁移** | 「将 [内容] 改成 [目标风格]，保留 [构图/光源/比例]」 | `保持构图不变` / `仅改变画风` |
| **局部修改** | 「只改 [X]，其他所有元素保持不变」 | `只改X` / `其他一切不动` |
| **虚拟换装** | 「锁定面部/体型/姿势，只更换服装为 [描述]」 | `锁定面部` / `姿势不变` |
| **草图渲染** | 「保留草图的布局/透视/比例，加上 [材质/光照]」 | `保留透视` / `仅添加材质` |
| **产品抠图** | 「清晰边缘抠图，纯白/透明背景，无白边白晕」 | `clean edges` / `no white fringe` |
| **对象移除** | 「移除 [X]，不要改变其他任何内容，无痕填充背景」 | `移除X` / `seamless fill` |
| **主体迁移** | 「将 [人物/物品] 移至 [位置]，锁定外观/服装/光照，与新环境融合」 | `锁定外观` / `匹配光照透视` |

### 编辑保留锚点（每次迭代都要重申）

每轮编辑提示词必须重复声明「保留不变的内容」，不能假设 AI 记得上轮约束：

```
[目标修改]
同时必须保留：
- 人物面部特征与表情
- 整体构图与画面比例
- 背景主体和光照方向
- [其他需要锁定的元素]
```

### 图像编辑路由决策

```
用户要「修改/调整/只改某部分」→
  ├─ 改风格不改内容？ → 风格迁移公式
  ├─ 改服装/道具不改人物？ → 虚拟换装公式
  ├─ 删掉某个元素？ → 对象移除公式
  ├─ 换背景/场景？ → 主体迁移公式
  ├─ 草图变渲染图？ → 草图渲染公式
  └─ 改文字/品牌信息？ → 局部修改公式（只改文字容器，锁定所有图形元素）
```

---

## 迭代纪律（避免越改越烂）

> **四大主原则**（来自指导文档 Page10）：
> 1. 结构 > 措辞：构图和布局比具体用词更重要
> 2. 约束 > 灵感：明确说「不能做什么」比「做成什么」更有效
> 3. 分步迭代 > 一次写全：每轮只改一个变量
> 4. 重复不变量：每轮都要重申保留约束，不要假设模型记住了

### 迭代操作规范

| 规范 | ❌ 错误做法 | ✅ 正确做法 |
|---|---|---|
| 每次只改一个变量 | 同时改构图+风格+文字 | 先改构图，确认后再改风格 |
| 从干净的基础提示词开始 | 在坏结果上追加修改指令 | 重新从基础 prompt 出发 |
| 出现漂移时重新锚定 | 继续往下加补丁 | 重启迭代，重新声明所有约束 |
| 验证流程 | 一次到位硬怼 | 先快速验证构图 → 再正式精出 |

### 八项生产检查清单

出正式发布版前，过一遍：
- [ ] 场景/主体/关键细节/约束四要素是否都有？
- [ ] 画面文字是否用反引号包裹？
- [ ] 尺寸是否符合 gpt-image-2 约束（16x倍数，3:1以内）？
- [ ] 画面主体与核心构图是否清晰明确？
- [ ] 多图是否声明了独立输出？
- [ ] 编辑场景是否重申了所有保留锚点？
- [ ] 负向约束块是否已追加（防文字乱码/脏斑）？
- [ ] 迭代是否遵循了「一次只改一个变量」？

---

## 角色一致性工作流（连续剧/故事板）

当需要在多张图中保持**同一角色**的外观一致时：

### 两步工作流

**Step 1 - 创建角色锚点图（Character Anchor）：**
```
生成一张 [角色名] 的标准参考图：
- 全身/半身正面像
- 明确面部特征：[五官/发色/发型]
- 服装：[具体描述]
- 艺术风格：[统一风格]
- 画面无背景/纯白背景，用于后续故事续写参考
```

**Step 2 - 故事续写（Story Continuation）：**
```
基于以下角色参考：[角色描述 from Step 1]
场景：[具体场景]
动作/情绪：[描述变化]
背景：[场景背景]
保持：面部特征、发型发色、服装（除非剧情要求改变）、整体艺术风格不变
```

### 角色一致性关键规则
- 每次续写都要**完整重复**角色的外貌描述，不要只写「保持上一张的外观」
- 服装颜色/款式用精确词汇（不要「蓝色外套」，要「深海蓝单排扣羊毛大衣」）
- 系列图在风格前置声明中锁定「统一艺术指导：[风格]」

---

## 多图输入规范（Image Reference）

当用户提供多张参考图时：

```
【参考图输入规范】
- Image 1：[角色参考/样式参考] — 用于提取 [什么特征]
- Image 2：[场景参考/背景参考] — 用于提取 [什么元素]
- Image 3：[构图参考] — 用于参考 [视角/比例]

生成要求：
将 Image 1 中的 [X] 放置到 Image 2 的 [Y] 位置，
匹配 Image 2 的光照方向和色彩基调，
采用 Image 3 的构图视角
```

> 每张输入图必须编号并明确声明其角色，AI 不会自动推断哪张图用来做什么。
