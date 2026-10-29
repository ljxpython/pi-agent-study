---
name: article-publisher
description: 工业级多平台文章自动发布与草稿箱同步技能。基于 WechatSync 浏览器原生 WebSocket 桥接技术，一键将 Markdown/HTML 底稿无损推送到掘金、知乎、小红书、CSDN、语雀、微信公众号等 29+ 平台的草稿箱。自动处理图片转存、首图封面提取、标题智能解析，零封号风险。触发词：「同步到掘金」「发布到知乎和小红书」「把文章推到草稿箱」「发布这篇博客」「多平台同步」「查一下发文平台登录状态」
---

# Article Publisher - 多平台文章草稿箱自动同步技能

> **老王暴躁技术流注**：写完好文章还要在 5 个平台之间人肉复制、重新上传 10 张图、排版调格式的，都是在浪费生命！该技能通过本地 WebSocket 桥接真实 Chrome 浏览器会话，一键直推各大平台草稿箱，把 90% 的脏活自动化，最后留 10 秒在草稿箱人工点个确定，稳得一批！

---

## 🎯 核心架构与设计哲学

### 为什么坚决不用“纯后端爬虫 / 账号密码模拟登录”？
1. **死得快**：知乎、小红书、掘金等平台的风控极其严格（设备指纹、滑动验证码、频控、动态 Token），自制爬虫写脚本不出三天账号必被封！
2. **维护地狱**：前端 DOM 稍有微调，自研模拟发文脚本就全线崩溃。
3. **安全第一**：明文存储账号密码是大忌。

### 本技能方案：Local Extension Bridge（本地扩展桥接）
- **本地服务**：CLI 工具在本地启动轻量 WebSocket Server（默认端口 `9527`）。
- **浏览器会话**：复用用户已登录的真实 Chrome 浏览器及 [WechatSync 扩展](https://github.com/wechatsync/Wechatsync)。
- **原生 DOM 注入**：浏览器扩展接收到 CLI 发送的 Markdown 与媒体资产后，直接调用宿主平台的官方创作端 API 写入**草稿箱**。
- **免密免风控**：完全走正常用户 Cookie/Session，不触碰任何敏感凭据，安全合规。

```
[Markdown 底稿] 
       │
       ▼
[publish.py (CLI Wrapper)] 
       │ (WebSocket :9527 / Token 校验)
       ▼
[Chrome WechatSync 扩展]
       │ (走已登录 Cookie，调用官方创作后台)
       ├───────────────┼───────────────┼───────────────┐
       ▼               ▼               ▼               ▼
   [掘金草稿箱]     [知乎专栏草稿]   [小红书草稿]    [CSDN/语雀草稿]
```

---

## 📋 支持的平台代码速查 (29+ Platforms)

| 平台标识 (CLI 参数) | 平台名称 | 登录与特性说明 |
|:---|:---|:---|
| `juejin` | **掘金** | 支持 Markdown、代码高亮、标签选择，稳定推送到草稿箱 |
| `zhihu` | **知乎** | 写入专栏/回答草稿，图片自动转存知乎 CDN |
| `xiaohongshu` | **小红书** | **强制必须带封面图**（`--cover` 或自动提取第一张），适合图文卡片 |
| `csdn` | **CSDN** | 写入个人博客草稿箱 |
| `wechat` | **微信公众号** | 需在公众平台登录，素材库自动同步图片 |
| `yuque` | **语雀** | 知识库文档同步 |
| `jianshu` | **简书** | 写入文稿草稿 |
| `toutiao` | **今日头条 / 头条号** | 文章/微头条草稿 |
| `segmentfault` | **思否** | 开发者问答与专栏草稿 |
| `bilibili` | **哔哩哔哩专栏** | B 站专栏文章草稿 |

---

## ⚙️ 一次性前置环境配置

1. **安装 Chrome 扩展**：
   - 访问 [Chrome 应用商店安装 WechatSync 同步助手](https://chromewebstore.google.com/detail/wechatsync/heildfgocedifeiebinnpaafbipfdibe) 或通过源码加载。
2. **开启本地同步桥接**：
   - 点击浏览器右上角 WechatSync 插件图标 ➔ 进入【设置】。
   - 找到【同步桥接 / CLI / MCP 连接】，将开关拨至**开启（绿色）**。
   - 复制生成的 Token（例如：`63e90d0b-d7d8-4354-9ed1-73acf90c51f3`）。
3. **配置本地密钥**：
   - 在项目根目录 `.env` 或全局 `~/.my_best/.env` 中填入：
     ```bash
     WECHATSYNC_TOKEN="你的Token"
     ```

---

## 🚀 常用指令与自动化调用

核心执行脚本位于：
`python3 .agents/skills/article-publisher/scripts/publish.py`

### 1. 探测支持平台与登录态
```bash
python3 .agents/skills/article-publisher/scripts/publish.py list
```
输出各平台是否已在 Chrome 中保持登录状态。

### 2. 默认一键同步到长文四大核心平台草稿箱（知乎、掘金、CSDN、博客园）
> **铁律**：除小红书走独立图文轨外，技术长文平台**绝对收敛至四大核心阵地（`zhihu,juejin,csdn,cnblogs`）**，默认无需输入 `-p`，其他平台暂时不发布！

```bash
python3 .agents/skills/article-publisher/scripts/publish.py sync \
  "03-articles/drafts/my-article.md"
```
- **自动标题**：脚本会自动提取 Markdown 首行 `# 标题` 作为发布标题。
- **自动防盗链**：知乎自动拆解为专属批次优先转存知乎原生图床，其余平台转存掘金原生图床，杜绝碎图。
- **返回结果**：输出各大平台草稿箱直达编辑链接。

### 3. 发布图文到小红书（自动提取封面）
```bash
python3 .agents/skills/article-publisher/scripts/publish.py sync \
  "03-articles/xiaohongshu/publish_ready.md" \
  -p xiaohongshu \
  -c "assets/images/cover.png"
```
> [!TIP]
> 如果未传入 `-c / --cover` 参数，脚本会自动扫描并提取 Markdown 文档中出现的**第一张图片**作为封面！

### 4. 演练模式（Dry-Run）
```bash
python3 .agents/skills/article-publisher/scripts/publish.py sync \
  "03-articles/drafts/test.md" \
  -p juejin --dry-run
```

---

## ⚠️ 平台特定排坑指南（老王血泪总结）

1. **小红书 (Xiaohongshu) 绝对不能没有封面**：
   - 小红书后台是纯视觉卡片流，若不提供封面图片，接口直接抛出异常或者前端卡在 loading。
   - 确保使用 `publish.py` 自动提取的第一张配图或明确指定有效封面。
2. **目录/专栏/话题标签属于创作最后 5% 的细节**：
   - 自动化工具的作用是**100% 解决复制粘贴与图床上传**。
   - 专栏、分卷、话题分类由于各平台权限不同（如知乎专栏有特定 ID，掘金有特定分类标签），建议在工具推送成功后，点击控制台输出的**草稿箱直达链接**，在浏览器中花 10 秒钟勾选目标专题并最终发布。
3. **超时与端口占用排查**：
   - CLI 默认监听 `localhost:9527`。如果报连接超时，请确认 Chrome 浏览器正在运行，且 WechatSync 设置中的【CLI / MCP 连接】处于打开状态。

---

## 🔗 在全仓库工作流中的协同角色

```
[01-interview-qa] 
       │ (沉淀高质量硬核题解)
       ▼
[.agents/skills/article-gen]
       │ (一鱼多吃：转换掘金技术流 / 小红书图文 / 知乎长文)
       ▼
[.agents/skills/gpt-image-gen + archify]
       │ (生成高清手账卡片 / 工业级架构图)
       ▼
[.agents/skills/article-publisher]  <-- 本技能
       │ (一键推送各平台草稿箱，生成直达链接)
       ▼
[人工 10 秒确认发布] ➔ 全网技术影响力分发！
```
