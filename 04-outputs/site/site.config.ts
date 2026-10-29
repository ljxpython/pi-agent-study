export interface CollectionConfig {
  id: string;
  title: string;
  description: string;
  order: number;
  sectionMode?: 'flat' | 'collapsible';
  notice?: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

export const site = {
  title: 'Pi Agent 架构实战与源码深潜',
  description: '专注于轻量级 Coding Agent 架构、四大内置工具、Harness 生态与双端 Spec 生产落地的体系化研学专栏。',
  author: 'ljxpython',
  url: 'https://ljxpython.github.io',
  base: '/pi-agent-study',
  repositoryUrl: 'https://github.com/ljxpython/pi-agent-study',
  accent: {
    primary: '#0284c7',
    soft: '#e0f2fe',
  },
  navigation: {
    label: 'Pi Agent 研学',
    sourceLabel: '项目仓库',
  },
  links: {
    github: 'https://github.com/ljxpython/pi-agent-study',
  },
  collections: [
    {
      id: 'foundations',
      title: '核心认知',
      description: '从思维模型与最小可用实践开始，理清脉络。',
      order: 1,
      sectionMode: 'collapsible' as const,
      sourceLabel: '查看源码',
      sourceUrl: 'https://github.com/ljxpython/knowledge-site-template',
      notice: '示例代码仅供学习参考。若要在本地测试，请手动执行相应命令。',
    },
    {
      id: 'practice',
      title: '工程实践',
      description: '将实践经验转化为可复现的高质量工作流。',
      order: 2,
      sectionMode: 'flat' as const,
      sourceLabel: '查看源码',
      sourceUrl: 'https://github.com/ljxpython/knowledge-site-template',
    },
  ],
} as const;

export default site;
