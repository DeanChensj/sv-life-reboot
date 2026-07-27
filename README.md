# 🚀 硅谷人生重开模拟器 | Silicon Valley Life Reboot Simulator

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> **“刷题、抽签、裁员、升职、买房、卖股、FIRE...”**  
> 《硅谷人生重开模拟器》是一款基于 React 19 + TypeScript + Vite 打造的文字模拟养成游戏。玩家将扮演一名在硅谷打拼的华人工程师/留学生，在身份签证、职场内卷、高房价与财富自由之间做出选择，体验真实的硅谷生存法则！

---

## ✨ 核心特色 (Key Features)

- 🌟 **隐藏款 SSR 天赋与防刷机制**
  - **【隐藏款 SSR·原生美籍】**：8% 概率开局隐蔽刷出，专属金色霓虹发光卡牌。自带 $15w 留学专款与加州湾区老宅，终身豁免 H1B 抽签、PERM 排期与 60 天失业遣返逼退倒计时！
  - **`localStorage` 抽卡持久化**：针对网页刷新进行了防作弊锁定，按 F5 无法重置当前局抽卡结果，唯有重启新人生才会开启新的 8% 判定。
- 🎓 **多重开局与特质设定**
  - 自选初始特质（小镇做题家、家里有矿、卷王之王、湾区海王、天选之子等）。
  - 选择毕业院校（Stanford、CMU、MIT、UCB、理工强校、普通公立等）与学位，开启不同的初始起点。
- 💰 **自动卖股票解救现金流危机**
  - 具备真实的现金流保护机制：当扣除房租或日常开销导致现金为负数且手头持有股票时，自动触发卖股平仓（Auto Stock Liquidation）救急，防止因工资发放延迟或初创公司期权占比高而导致的突发破产。
- 📊 **Bento 风格高颜值属性面板**
  - **身份签证**：F1 ➔ OPT ➔ H1B ➔ 绿卡 (GC) / 原生美籍 (100%)，体验大排期与抽签焦虑。
  - **职业总包 (TC)**：涵盖 OpenAI MTS、Meta、Google、NVIDIA、TikTok、Amazon、Startup 及 Quant 顶级交易员。
  - **生存指标**：健康值 (Health)、刷题量 (LeetCode)、现金流 (Cash)、持仓股票 (Stocks)、车辆与房产状态。
- 🛒 **硅谷资产与消费商城**
  - 涵盖豪车（Porsche 911, Cybertruck, Model Y）、买房置业（Atherton 顶级豪宅、Sunnyvale 老破小、North San Jose 联排、Fremont 学区房）及养猫养狗等娱乐消费。
- 🎲 **丰富且真实的硅谷随机事件**
  - 体验大厂裁员潮、周五 PIP 绩效开除、抽 H1B 没中、日间 Day 1 CPT 挂靠、L1 外派归来、NeurIPS Best Paper 顶级论文、AI 创业浪潮等真实剧情。
- 🪪 **身份卡、年终账单与终局战报**
  - **角色通行证 (Character Pass)**：高质感身份卡展示。
  - **年度决算 & 终局战报 (War Report)**：复盘你的湾区奋斗史，获得专属人生勋章（如【出生在终点线】、【湾区房哥/房姐】等）。
- 🏆 **隐藏成就图鉴系统 (Codex)**
  - 收集数十种达成不同人生结局或特定条件解锁的成就与勋章。
- 📱 **移动端深度响应式适配**
  - 专门优化的移动端模态框滚动（WelcomeModal, BentoStatsPanel）与响应式触控，保障全平台流畅体验。

---

## 🛠️ 技术栈 (Tech Stack)

- **前端框架**：React 19, TypeScript
- **构建工具**：Vite 8
- **样式与 UI**：Tailwind CSS 3, Bento Grid 风格设计, CSS Flex/Grid 响应式布局
- **代码规范与检查**：Oxlint, TypeScript Strict Mode
- **部署发布**：gh-pages (GitHub Pages)

---

## 📦 快速开始 (Quick Start)

### 前置要求

- [Node.js](https://nodejs.org/) (建议 LTS 版本，如 `>= 18.0`)
- `npm` / `pnpm` / `yarn`

### 本地运行步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/DeanChensj/sv-life-reboot.git
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
├── public/                 # 静态资源与音频
├── src/
│   ├── assets/             # 媒体与图表资源
│   ├── components/         # 页面弹窗与 UI 组件
│   │   ├── AchievementCodexModal.tsx   # 成就图鉴弹窗
│   │   ├── BentoStatsPanel.tsx         # Bento 风格属性仪表盘
│   │   ├── CharacterProfileModal.tsx   # 角色档案通行证
│   │   ├── ShopModal.tsx               # 硅谷资产与消费商城
│   │   ├── WarReportModal.tsx          # 终局结算战报
│   │   ├── WelcomeModal.tsx            # 欢迎与规则弹窗
│   │   └── YearEndStatementModal.tsx   # 年度财务总结弹窗
│   ├── data/               # 游戏数据与事件树
│   │   ├── achievements.ts # 隐藏成就定义与解锁条件
│   │   └── events.ts       # 分支逻辑与事件决策节点
│   ├── utils/              # 音效与辅助工具
│   │   └── sound.ts        # Web Audio API 音效管理
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
