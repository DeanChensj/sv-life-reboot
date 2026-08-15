# AGENTS.md - 硅谷人生重开模拟器 (Silicon Valley Life Reboot Simulator)

欢迎使用并开发《硅谷人生重开模拟器》！本文件是本项目的全局上下文与核心开发规范。

---

## 📌 项目概述 (Project Overview)
- **技术栈**：React 19 + TypeScript + Vite 8 + Tailwind CSS 3
- **核心玩法**：基于文字抉择、多分支事件树、真实移民/职场机制的硅谷生活模拟养成游戏。
- **状态面板**：Bento Grid 仪表盘（现金/股票/TC、健康、LeetCode、签证排期、公司/职级、感情/房产）。

---

## 🎯 核心开发规范与设计准则

1. **数值平衡与寿命保障**：
   - 保证玩家平均寿命在 **35 ~ 55 岁**，单次常规选项扣血不超过 15 点，提供充沛的带薪年假与养生回血渠道。
   - 阶梯式 FIRE 目标设定（$500w 基础 / $800w 舒适 / $1500w+ 奢华），通关后支持自由探索。

2. **全局状态不变性 (Invariants)**：
   - **身份不可逆降级**：公民与绿卡身份受全局中间件保护，绝不可因后续事件降级。
   - **失业约束**：`job_type === 'unemployed'` 或 `laid_off === true` 时，`tc` 必须置 0。
   - **资产流动性**：大额支出（买房首付、大额消费）支持使用 `cash + stocks` 总资产，并在现金不足时自动平仓变现。

3. **测试规范**：
   - 任何涉及事件与状态修改的代码，必须通过全量测试：
     ```bash
     npm test
     # 包括：
     # 1. audit.ts (路由连通性与死胡同校验)
     # 2. audit_all_flows.ts (有向图 BFS 孤岛可达性与文案合规校验)
     # 3. test_all_cujs.ts (7 大核心用户旅程 CUJ 场景断言)
      # 4. fuzz_test.ts (10,000 局状态不变性 + 路由不变量 Fuzzing)
      # 5. test_monte_carlo_balance.ts (3,000 局蒙特卡洛数值平衡与寿命保障 CI 门禁)
      # 6. test_routing_guards.ts (禁止基于文案子串的路由/判断，防回归)
      ```

4. **路由与分支判断规范 (防两类高频 Bug)**：
   - **禁止用文案子串做控制流/判定**：`nextEventId`、成就解锁、任何分支逻辑都**不得**依赖
     `message.includes('X')`/`msg.includes('X')` —— 非目标结局的文案也可能含 X（假阳性），
     目标文案也可能不含（假阴性）。请改用**状态字段**判断：`level` / `last_promo_age`
     (本回合是否真晋升) / `visa` / `status` / `story_flags`。`test_routing_guards.ts` 会对
     此设 ratchet 门禁；`fuzz_test.ts` 校验「进入晋升庆祝事件 ⇒ 本回合确实晋升」。
   - **`job_type`/`company` 分支链必须覆盖所有取值**：新增 `job_type` 时，务必检查
     `settlement.ts`(年终健康文案/税/PERM 担保)、`gameStateSelectors.ts`(职业/签证/职级标签)
     等分支链是否都处理了该值，否则会静默落入错误的 fallback（如 TikTok 曾误判为「养老大厂」）。
     `test_all_cujs.ts` CUJ 11 会枚举所有 `job_type` 校验年终文案覆盖。
     ⚠️ 注意：TikTok 存储为 `company:'tiktok', job_type:'big_tech'`，判断时须用 `company` 而非 `job_type`。

---

## 🗺️ 后续迭代任务与优先级 (Roadmap)
- **P0**：✅ 修复商城“股票抵扣买房”判断；✅ 优化【卷王之王】特质属性与内卷抗压加成；✅ 达成初始目标后支持“继续探索更高目标”与“立即退休结算”自主抉择。
- **P1**：✅ 房产出租与被动现金流系统 (ADU出租/外州投资房/4-Plex公寓楼)；引入指数基金定投、双职工家庭与子女教育成长线。
- **P2**：增加局内历年资产走势图、生涯大事记 Timeline、扩充隐藏成就图鉴至 30+ 项。
- **P3**：将庞大的 `events.ts` 按领域拆分到 `src/data/events/` 子模块中。
