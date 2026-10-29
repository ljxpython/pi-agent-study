# AGENTS.md - 智能体协作与内容维护规范

> **本文档专供各类 AI 智能体（Agent）及自动化脚本阅读**。
> 当用户要求你（Agent）向本项目添加新文章、新知识合集、更新文档或修复问题时，必须严格遵守本规范，确保每次操作 100% 契约合规且构建通过。

---

## 1. 核心架构认知 (System Overview)

- **框架底座**：Astro 7 (纯静态输出，零运行时开销) + Tailwind CSS v4。
- **搜索能力**：基于 Pagefind 的离线轻量静态全文搜索（自动在构建阶段分词索引）。
- **内容核心原则**：**所有 Markdown 都是自包含的纯文本**，元数据直接写在文件顶部的 Frontmatter 中。不存在任何中央 JSON 注册表，不要尝试创建或修改任何 manifest 胶水文件。

---

## 2. 知识库目录结构 (Directory Tree)

```text
knowledge-site-template/
├── site.config.ts          <-- 站点配置、网站标题、合集定义 (collections)
├── content/                <-- 【核心】所有知识文章 Markdown 文件放这里！
│   ├── welcome.md
│   ├── writing-a-lesson.md
│   └── <your-slug>.md
├── public/                 <-- 静态资源目录
│   ├── imgs/               <-- 文档引用图片 (/imgs/example.png)
│   ├── pdfs/               <-- PDF 附件 (/pdfs/example.pdf)
│   └── examples/           <-- 随站发布的代码文件 (/examples/demo.py)
├── src/                    <-- 站点 UI 组件与页面路由 (如无特殊需求严禁随意篡改)
└── AGENTS.md               <-- 本规范文件
```

---

## 3. 新增/编辑文章规范 (Document Contract)

### 3.1 文件命名与位置
- 必须放在 `content/` 目录下。
- 文件名采用连字符小写英文字符：`content/<slug>.md`（如 `content/agentic-coding-guide.md`）。该文件名即为访问路由的 ID。

### 3.2 严格 Frontmatter 格式
每个 Markdown 文件**必须且仅允许**在开头声明 YAML Frontmatter。

```markdown
---
title: "文章标题"
description: "一句话阐明该文章能解决什么问题或教会读者什么。"
collection: "foundations"
section: "架构设计"
order: 1
published: true
resources:
  - label: "参考代码仓库"
    url: "https://github.com/example/repo"
  - label: "本地 Python 示例"
    url: "/knowledge-site-template/examples/utf8-example.py"
---
```

#### 字段详细规则：
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `title` | `string` | **是** | 文章主标题。**注意：正文开头严禁再写 `# 标题`，模板会自动渲染为 H1**。 |
| `description` | `string` | **是** | 简短描述，用于卡片预览、SEO 及搜索摘要。 |
| `collection` | `string` | **是** | 所属合集 ID。**必须是 `site.config.ts` 中已定义的合集 ID**！ |
| `order` | `integer` | **是** | 该合集内的排序序号（非负整数，数字越小越靠前）。 |
| `published` | `boolean` | **是** | 是否正式发布。若为 `false` 则在构建时自动忽略。 |
| `section` | `string` | 否 | 所属小节标签。若所属合集开启了折叠分组，会按此字段归类。 |
| `source` | `string` | 否 | 外部来源链接（合法完整 URL）。 |
| `resources` | `array` | 否 | 底部附带资源列表，项包含 `label` 与 `url`。本地资源必须以配置的 `site.base` 开头。 |

### 3.3 正文内容编写规范
1. **标题层级**：正文请直接从 `## 二级标题` 开始编写，小节用 `### 三级标题`。右侧目录轨（Table of Contents）会自动提取 H2 和 H3。
2. **图片与附件路径**：
   - 图片存放在 `public/imgs/`，正文引用使用**绝对根路径**：`![示意图](/imgs/my-diagram.png)`。
   - 严禁使用相对路径（如 `../imgs/my-diagram.png` 或 `./imgs/my-diagram.png`），否则会被资产检查工具驳回。
3. **提示块 (Callouts / Alerts)**：
   支持 GitHub 风格的语义提示块，已配置专属高亮样式：
   ```markdown
   > [!NOTE]
   > 这是一个常规说明提示。

   > [!TIP]
   > 这是一个最佳实践或优化建议。

   > [!WARNING]
   > 这是一个避坑指南或关键警告。

   > [!IMPORTANT]
   > 这是一个必须遵守的核心要求。
   ```

---

## 4. 新增知识合集规范 (Collection Management)

如果用户要求你新增一个全新的分类/合集（比如新增一个“模型评测”合集）：

1. 打开 `site.config.ts`。
2. 在 `site.collections` 数组中添加配置项：
   ```ts
   {
     id: 'model-eval',             // 英文小写唯一标识
     title: '模型深度评测',          // 页面展示的主标题
     description: '真实场景下的推理与编码评测。', // 描述说明
     order: 3,                     // 全站合集排序优先级
     sectionMode: 'collapsible',   // 'flat' (平铺卡片) 或 'collapsible' (按 section 折叠分组)
   }
   ```
3. 随后便可以在 `content/*.md` 的 Frontmatter 中指定 `collection: "model-eval"`。

---

## 5. 智能体标准执行与验证 SOP (Agent Workflow)

当 Agent 完成文件的新增或修改后，**必须在终端依次执行以下三道验证程序**，确保无任何报错后才可向用户汇报完成：

```bash
# 1. 资产与链接完整性自检（确保所有图片路径和资源存在）
npm run assets:check

# 2. 契约测试（验证所有 Frontmatter 格式、字段合法性）
npm test

# 3. 完整静态构建与 Pagefind 全文搜索索引生成
npm run build
```

### 验证合格标准：
- `npm run assets:check` 输出：`Content and assets are valid.`
- `npm test` 输出：所有测试用例均为 `ok`。
- `npm run build` 输出：页面全部构建完成且 `Running Pagefind ... Finished in ...`，返回码为 0。

---

## 6. 严禁行为防线 (Guardrails)

- ❌ **严禁重新引入全局 JSON 字典**：不要尝试创建任何类似 `content.manifest.json` 的中心化文件。
- ❌ **严禁随意修改 UI 基础布局**：如无用户明确指令，不得改动 `src/components/` 和 `src/layouts/` 的核心排版逻辑。
- ❌ **严禁死链和幽灵图片**：引用任何 `/imgs/xxx.png` 必须确保文件真实提交在 `public/imgs/` 中。
- ❌ **严禁执行未经确认的 Git 提交**：不要私自运行 `git commit` 或 `git push`，除非用户主动发出明确要求。
