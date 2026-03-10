import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'ACoord',
  description: 'Atomic Coordinate Toolkit for VS Code',
  base: '/vscode-acoord/',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config

    // 顶部导航栏
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Tutorials', link: '/tutorials/' },
      { text: 'Features', link: '/features/' },
    ],

    // 侧边栏
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'File Formats', link: '/guide/file-formats' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'Overview', link: '/tutorials/' },
            { text: 'Viewing Structures', link: '/tutorials/viewing-structures' },
            { text: 'Editing Atoms', link: '/tutorials/editing-atoms' },
            { text: 'Working with Trajectories', link: '/tutorials/working-with-trajectories' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: '3D Visualization', link: '/features/3d-visualization' },
            { text: 'Atom Selection', link: '/features/atom-selection' },
            { text: 'Bond Measurement', link: '/features/bond-measurement' },
            { text: 'Unit Cell Editor', link: '/features/unit-cell' },
            { text: 'Color Schemes', link: '/features/color-schemes' },
          ],
        },
      ],
    },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wxia529/vscode-acoord' },
    ],

    // 页脚
    footer: {
      message: 'Released under the GPL-3.0 License.',
      copyright: 'Copyright © 2026 ACoord',
    },

    // 搜索
    search: {
      provider: 'local',
    },
  },
});
