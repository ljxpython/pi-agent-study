# GPT Image 提示词工程与视觉风格指南 (Visual Style Guide & Meta Guide)

> **定位**：本指南是本系统多模态内容生产的视觉宪法。阐明四大视觉刚性铁律、通用负向约束与防翻车规约。  
> **模板注册表**：所有具体的风格配方（Recipes/Templates）均以独立原子文件的形式维护在 [`templates/`](file:///.agents/skills/gpt-image-gen/templates/) 目录下，实现渐进式、即插即用扩展。

---

## 一、 视觉设计四大刚性铁律 (The 4 Visual Laws)

1. **画面纯净法则（Zero-Text Mandate）**  
   生图模型绘制的文字绝大多数是错乱的外星乱码或残缺伪英文，会极大拉低工业级成品的质感。**所有图内台词、说明、数据，一律由下游渲染引擎（Headless Chrome / PIL）以 Retina 矢量字体进行装配排版，生图模型严禁绘制任何文字！**
2. **反差张力法则（Dichotomy & Tension）**  
   人际博弈与心理觉醒的核心是“对比”。弱势老好人一侧使用冷灰、慌乱暗红、蜷缩体态与满头冷汗；强势破局者一侧使用暖金、从容琥珀、开阔体态与大象气度。
3. **构图精确法则（Layout Precision）**  
   - 凡是用于切片组装（Diptych）的漫画，必须采用 `1024x576`（16:9），且人物主体必须向左右两侧偏移，正中轴留出至少 5%~10% 的空白切片间隙；
   - 凡是作为文章封面（Hero Visual）的大图，必须采用 16:9 或 2.35:1 电影宽幅，视觉焦点居中偏上。
4. **隐喻具象法则（Concrete Metaphor）**  
   严禁生成毫无语义的空洞美女/风景图。每一个心智法则必须绑定一个物理级具象符号（如：课题分离 ➔ 透明金色防护罩；破唱片 ➔ 旋转黑胶唱片；不必解释 ➔ 从容品茶；主线舵手 ➔ 金色剪刀咔嚓剪断杂乱藤蔓）。

---

## 二、 通用 Prompt 组装三段式公式 (The 3-Tier Formula)

编写 Prompt 时，建议采用结构化的三段式拼接：

```text
[第一层：场景矛盾与主体动作 (Subject & Interaction)]
+ [第二层：艺术媒介与画风修饰 (Art Style, Lighting & Medium)]
+ [第三层：负向约束与防翻车安全词 (Strict Negative Constraints)]
```

### 必备负向约束块 (Negative Boilerplate)
在任何 Prompt 末尾，强制附加以下安全防翻车约束：
```text
STRICT NEGATIVE CONSTRAINT: Absolutely NO text, NO letters, NO words, NO typography, NO Chinese characters, NO pseudo-language glyphs, NO labels, NO logos, NO watermarks, NO blurry messy lines. Pure visual illustration only.
```

---

## 三、 渐进式风格模板路由表 (Template Registry Index)

具体风格的参数标准、提示词骨架与负向词，请直接查阅对应原子模板文件：

| 模板 ID | 对应文件 | 类别 (Category) | 通用核心适用场景 (Use Cases) | 推荐尺寸 |
| :--- | :--- | :--- | :--- | :--- |
| **`chibi-diptych`** | [`chibi-diptych.yaml`](file:///.agents/skills/gpt-image-gen/templates/chibi-diptych.yaml) | `comic-strip` | 左右分屏行为对比、正反案例对照、中轴切片信息图 | `1024x576` |
| **`comic-strip-story`** | [`comic-strip-story.yaml`](file:///.agents/skills/gpt-image-gen/templates/comic-strip-story.yaml) | `webtoon-strip` | 垂直 3 格剧情故事条漫、戏剧反差、两难选择、对话气泡与信息卡片 | `1024x1792` / `9:16` |
| **`hero-metaphor`** | [`hero-metaphor.yaml`](file:///.agents/skills/gpt-image-gen/templates/hero-metaphor.yaml) | `concept-art` | 文章封面 Hero Visual、宏大哲学/心理隐喻、高概念主视觉 | `1024x576` / `2048x1152` |
| **`narrative-cinema`** | [`narrative-cinema.yaml`](file:///.agents/skills/gpt-image-gen/templates/narrative-cinema.yaml) | `cinematic-still` | 故事叙事转折点插图、人际谈判与冲突肢体对抗抓拍 | `1024x768` / `1024x576` |
| **`xiaohei-sketch`** | [`xiaohei-sketch.yaml`](file:///.agents/skills/gpt-image-gen/templates/xiaohei-sketch.yaml) | `editorial-sketch` | 16:9 纯白底手绘、小黑 IP 荒诞动作、认知转折与方法论配图 | `1024x576` |
| **`stoic-woodcut`** | [`stoic-woodcut.yaml`](file:///.agents/skills/gpt-image-gen/templates/stoic-woodcut.yaml) | `vintage-woodcut` | 古典哲学金句、先哲沉思卡片、历史文献中世纪木刻插图 | `1024x1024` |
| **`executive-blueprint`** | [`executive-blueprint.yaml`](file:///.agents/skills/gpt-image-gen/templates/executive-blueprint.yaml) | `minimal-diagram` | 战略商业报告、高管决策拓扑、组织架构与博弈网络分析 | `1024x576` |
| **`infographic-decision-poster`** | [`infographic-decision-poster.yaml`](file:///.agents/skills/gpt-image-gen/templates/infographic-decision-poster.yaml) | `diagram-chart` (JSON) | 教学决策与双栏博弈解剖海报、带顶层 Header、中轴分水岭与底栏 SOP | `1024x576` |
| **`infographic-grid-lecture`** | [`infographic-grid-lecture.yaml`](file:///.agents/skills/gpt-image-gen/templates/infographic-grid-lecture.yaml) | `slides-diagram` (JSON) | ⭐️ 极简硬卡片网格教学讲义海报、纯白底色、2~6字高频短语、彻底绝杜绝错字与脏斑 | `1024x576` |
| **`exploded-diagram-tech`** | [`exploded-diagram-tech.yaml`](file:///.agents/skills/gpt-image-gen/templates/exploded-diagram-tech.yaml) | `3d-schematic` (JSON) | 3D 爆炸拆解图、复杂硬件内部组件堆叠、引线编号标注与规格看板 | `1024x576` |

> 💡 **灵感案例库与实战参考**：请参阅 [`references/PROMPT_INSPIRATIONS.md`](file:///.agents/skills/gpt-image-gen/references/PROMPT_INSPIRATIONS.md)，深度解剖了开源生态精选的 10 大神级案例（含 VR 爆炸图、手绘地图、桃太郎 Slides、3D 石阶演化、涩谷街拍、Opus 漫画条等）。  
> 💡 **渐进扩展指南**：若需新增风格，请查阅 [`templates/README.md`](file:///.agents/skills/gpt-image-gen/templates/README.md) 并添加独立的 YAML 模板，无需改动任何已有脚本或代码。

---

## 五、 大模型文字直出与洁净度防翻车两大铁律 (Text Budget & Cleanliness Laws)

在让大模型原生直出包含大量汉字的教学海报或信息图时，必须无条件遵循以下两条黄金法则：

### 1. 文字注意力预算铁律 (Text Attention Budget Law)
- **单图字数安全阈值**：纯生图直出时，全图文字总量必须严格控制在 **30~50 字黄金区间**；
- **短语化提炼（No Long Sentences）**：严禁在提示词中塞入整段自然语言长句（>15字必翻车）。必须把所有核心知识点拆解成 **2~6 字的独立高频短语**（如：“① 反逻辑 · 不辩论”、“② 反说服 · 守底线”）；
- **网格物理容器约束（Bounding Box Anchors）**：学习 Case 3（霞关风格 Slides），显式声明 3~4 个带有边框的独立矩形白色卡片（White Card Boxes with Clean Border），强制把文字锁在卡片内部，杜绝空间抢占与字体重叠。

### 2. 画面洁净度防污染法则 (Anti-Grunge & Clean Surface Mandate)
- **杜绝假复古做旧词**：教学讲义类海报绝对禁止使用 `vintage paper, yellowed paper, grunge texture`（此类词会诱导模型在空白处绘制受潮霉斑、死苍蝇般的墨水黑块）；
- **统一转向现代纯净矢量感**：强制指定 `pristine clean white background, clean crisp line art, smooth vibrant anime flat color`；
- **强制注入去污负向约束**：
  ```text
  STRICT NEGATIVE: NO dirty stains, NO ink splatters, NO paper grunge, NO smudge, NO messy lines, NO ugly textures, pure clean digital anime illustration only.
  ```


---

## 四、 高阶技巧：结构化 JSON 提示词工程 (Structured JSON Prompting)

在复杂版面（如双栏对抗海报、流程分解图、带多级文字排版的决策图）中，传统的自然语言散文容易出现“空间层级混乱、文字位置跑偏”的通病。

### 为什么采用 JSON 结构输入？
GPT Image 2 / 2.5 具备强大的大语言模型底座，天生理解 JSON 的树状层级关系。直接传入结构化 JSON 字符串：
1. **拓扑绝对映射**：`header` 永远置顶，`layout.left_column` 严格在左侧，`layout.right_column` 严格在右侧，`footer` 严格在底栏；
2. **文字与视觉绑定**：`status_badge`、`title`、`diagnosis_box` 的键名直接提示模型文字的职能类型，排版精准度比散文高数倍；
3. **开箱即用模板**：参考 [`infographic-decision-poster.yaml`](file:///.agents/skills/gpt-image-gen/templates/infographic-decision-poster.yaml) 即可一键生成教学决策海报。




---

## 四、 防翻车自检清单 (Self-Check Checklist)

每次准备调用 `generate.py` 生图前，必须通过以下自检：
- [ ] **是否已规避文字？** Prompt 中是否包含严格的 `STRICT NEGATIVE: Absolutely NO text...` 声明？
- [ ] **比例是否对齐下游？** 双格切片漫画是否锁定了 `1024x576`？封面是否锁定了 16:9 或 2.35:1？
- [ ] **切片漫画是否预留了中缝？** 画面两侧的人物主体是否各自往左右靠拢，中间留足裁切安全区？
- [ ] **具象符号是否贴合哲学内核？** 是否将核心概念具象化为物理符号，杜绝空洞花瓶图？

---

## 六、 写实人物自然感法则（Anti-Over-Beautification）

> AI 的默认倾向是「过度美化」——皮肤如蜡、面容无缺陷、光线梦幻。写实类出图必须主动对抗这个倾向。

**指定自然缺陷（让人物真实可信）：**
```text
realistic skin texture with natural pores, subtle expression lines,
slight asymmetry in facial features, natural hair strands (not perfectly smooth),
candid unstaged body language, authentic environmental shadows
```

**指定摄影物理感：**
```text
shot on 35mm film, slight grain, natural color grading (not HDR),
lens breathing, authentic depth of field, no studio-perfect lighting
```

**禁止过度美化词（会让 AI 生成假人感）：**
- 禁用：`flawless skin` `perfect beauty` `HDR` `ultra-detailed perfect face` `ethereal glow`
- 替换为：`natural skin` `candid photo` `film photography` `authentic portrait`

---

## 七、 广告创意 Brief 写法（Ad Creative as Brief）

> 广告图的提示词不要写成「技术描述」，要写成「创意简报（Creative Brief）」。

**传统错误写法（技术描述）：**
```
画一张广告图，左边是产品，右边是文字，背景是渐变蓝色
```

**正确写法（创意简报）：**
```
Campaign: [产品名] 新品上市广告
目标受众: [25-35岁都市白领/学生/etc.]
核心主张: [产品核心价值一句话]
视觉调性: [极简/温暖/科技感/etc.]
主角: [产品 or 人物 or 场景]
情绪/氛围: [期待感/信赖感/活力感]
参考风格: [Apple/小米/无印良品/etc.] 的广告美学
```

**广告图三要素（必须都有）：**
1. **情感锚点**：让目标受众在 3 秒内产生共鸣的情绪触发
2. **产品位**：产品在画面中的精确位置和视觉权重
3. **信息层级**：主视觉 > 产品 > 文案的注意力顺序
