# CodeAgent教学项目规则

本项目是隔离教学副本。任务：给列表增加标题关键词与状态联合筛选。
只允许修改 `src/filter.js`，不要修改测试、样例数据或其他文件。
先读取 `.pi/skills/coding-verification/SKILL.md`，再读源码和测试。
用todo工具创建一条任务，真实测试全部通过后才标记完成。
不安装依赖，不访问网络，不读取项目外文件，不提交或推送Git。
允许的bash命令只有 `node --test test/filter.test.mjs`、`git diff -- src/filter.js`、`git status --short`。
实现必须遵守：关键词trim后忽略大小写匹配标题；状态all表示不限；条件同时满足；不修改原数组和原对象；无结果返回空数组。
最终中文说明改了什么、执行了哪些测试、尚未验证什么。Todo完成标记不能代替测试证据。
