// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import site from './site.config.ts';

// 自动从 GitHub Actions 环境变量获取当前仓库名作为二级路径，实现 0 配置自适应！
const repoBase = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : (site.base || '');

export default defineConfig({
  site: site.url,
  base: repoBase,
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },
});
