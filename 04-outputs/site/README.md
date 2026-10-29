# Knowledge Site Template

A Markdown-first Astro template for technical notes, knowledge bases, and course explainers. Features an editorial paper reading layout, theme switcher, offline full-text search powered by Pagefind, and zero-effort GitHub Pages deployment.

Repository: https://github.com/ljxpython/knowledge-site-template

## What You Edit

```text
site.config.ts          Site name, author, base URL, and collection definitions
content/*.md            Self-contained Markdown articles with frontmatter
public/imgs/            Images referenced as /imgs/file.png
public/pdfs/            Optional PDFs referenced as /pdfs/file.pdf
public/examples/        Standalone source files published with the site
AGENTS.md               Standard operating manual for AI agents
```

## Quick Start

```bash
npm install
npm run dev
```

Before publishing:

```bash
npm run assets:check
npm test
npm run build
npm run preview
```

## Add an Article

Create `content/my-article.md` with standard YAML Frontmatter:

```markdown
---
title: "My Article Title"
description: "What the reader will learn."
collection: "foundations"
section: "Basics"
order: 1
published: true
---

## First Section

Start directly with H2 headings. The H1 title is rendered automatically.
```

- No central manifest to maintain.
- Adding or moving an article has zero boilerplate.
- Global full-text search index (`⌘K`) is automatically built during `npm run build`.

## For AI Agents

See [AGENTS.md](file:///Users/lijiaxin/PyCharmMiscProject/research/knowledge-site-template/AGENTS.md) for the exact contract, frontmatter specification, and validation checklist for autonomous AI agents.

## Assets

Use absolute public paths in Markdown:

```md
![Diagram](/imgs/diagram.png)
[Download PDF](/pdfs/lesson.pdf)
```

`npm run assets:check` rejects missing local `/imgs/` and `/pdfs/` references.

## Example Code & Resources

Keep example code in the lesson body as fenced Markdown blocks.

For standalone sample files, add a `resources` entry in your article's Frontmatter:

```yaml
resources:
  - label: "Example: 01_real_model_agent.py"
    url: "https://github.com/example/repo/blob/main/example.py"
  - label: "Local UTF-8 Example"
    url: "/knowledge-site-template/examples/utf8-example.py"
```

## GitHub Pages Deployment

1. Set `url`, `base`, `repositoryUrl`, and links in `site.config.ts`.
2. Push to `main`.
3. In GitHub repository settings, set Pages source to **GitHub Actions**.

The included workflow automatically builds `dist/` (including Pagefind search indexes) and deploys it to GitHub Pages.

## License

MIT
