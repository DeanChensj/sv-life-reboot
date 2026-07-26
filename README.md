# 🚀 硅谷人生重开模拟器 | Silicon Valley Life Reboot Simulator

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> **“刷题、抽签、裁员、升职、买房、FIRE...”**  
> 《硅谷人生重开模拟器》是一款基于 React 19 + TypeScript + Vite 打造的文字模拟养成游戏。玩家将扮演一名在硅谷打拼的华人工程师/留学生，在身份签证、职场内卷、高房价与财富自由之间做出选择，体验真实的硅谷生存法则！

---

## ✨ 核心特色 (Key Features)

- 🎓 **多重开局与特质设定**
  - 自选初始特质（做题家、富二代、卷王、社交达人等）
  - 选择毕业院校（Stanford、CMU、SJSU 等）与学位，开启不同的初始起点。
- 📊 **Bento 风格高颜值属性面板**
  - **身份签证**：F1 ➔ OPT ➔ H1B ➔ 绿卡 (GC) 进度条，体验大排期与抽签焦虑。
  - **职业总包 (TC)**：涵盖 Big Tech、Startup、AI Research、Quant 以及顶级科技巨头。
  - **生存指标**：健康值 (Health)、刷题量 (LeetCode)、现金流 (Cash)、车辆与房产状态。
- 🎲 **丰富且真实的硅谷随机事件**
  - 体验大厂裁员潮、抽 H1B 没中、跳槽涨薪、Day 1 CPT 救急、L1 外派归来、AI 创业浪潮等真实剧情。
- 🪪 **身份卡与年度/终局战报**
  - **角色通行证 (Character Pass)**：高质感身份卡展示。
  - **年度决算 & 终局战报 (War Report)**：复盘你的湾区奋斗史，统计总资产与人生结局。
- 🏆 **隐藏成就图鉴系统 (Codex)**
  - 收集数十种达成不同人生结局或特定条件解锁的成就与勋章。

---

## 🛠️ 技术栈 (Tech Stack)

- **前端框架**：React 19, TypeScript
- **构建工具**：Vite 8
- **样式与 UI**：Tailwind CSS 3, Bento Grid 风格设计
- **代码规范与检查**：Oxlint
- **部署发布**：gh-pages (GitHub Pages)

---

## 📦 快速开始 (Quick Start)

### 前置要求

- [Node.js](https://nodejs.org/) (建议 LTS 版本，如 `>= 18.0`)
- `npm` / `pnpm` / `yarn`

### 本地运行步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/sv-life-reboot.git
   cd sv-life-reboot
   ```

2. **安装项目依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   打开浏览器访问 [http://localhost:5173](http://localhost:5173) 即可开始游戏。

4. **构建生产版本**
   ```bash
   npm run build
   ```

5. **代码质量检查**
   ```bash
   npm run lint
   ```

6. **一键部署到 GitHub Pages**
   ```bash
   npm run deploy
   ```

---

## 📁 项目结构 (Project Structure)

```
sv-life-reboot/
├── public/                 # 静态资源
├── src/
│   ├── assets/             # 媒体与图表资源
│   ├── components/         # 页面弹窗与 UI 组件
│   │   ├── AchievementCodexModal.tsx   # 成就图鉴弹窗
│   │   ├── BentoStatsPanel.tsx         # Bento 风格属性仪表盘
│   │   ├── CharacterProfileModal.tsx   # 角色档案通行证
│   │   ├── WarReportModal.tsx          # 终局结算战报
│   │   └── YearEndStatementModal.tsx   # 年度总结弹窗
│   ├── data/               # 游戏数据与事件树
│   │   ├── achievements.ts # 隐藏成就定义与解锁条件
│   │   └── events.ts       # 分支逻辑与事件决策节点
│   ├── types.ts            # 全局 TypeScript 类型定义
│   ├── App.tsx             # 游戏主逻辑与视图状态管理
│   └── main.tsx            # Vite 入口文件
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🤝 贡献与反馈 (Contribution)

欢迎提交 Issue 或 Pull Request 来丰富剧情事件、增加隐藏成就或优化 UI 体验！

## 📄 许可证 (License)

[MIT License](LICENSE)

