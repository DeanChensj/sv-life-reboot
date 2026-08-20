import type { GameEvent, GameState, StoryFlags } from '../../types';
import { h1ToH2Router, addImpact } from './helpers';

// 中后期 engagement 事件 — Late-game texture events (T2, NON-destructive first pass).
// Purpose: kill the 32+「自动驾驶挂机」mid-game fatigue by giving the 33-55 window (and
// the post-FIRE exploration phase) real, once-per-life decisions — WITHOUT any of the
// asset-halving / forced-unemployment / unrecoverable-setback mechanics (those are a
// separate, balance-tuned pass). Every choice here has at most a small, cash-gated cost,
// so nothing tanks the FIRE win-rate gate and everything is easily reversible.
// Rules kept: single-choice health loss <= 15; charm capped at max_charm; no money
// printers; state-based routing; every event has an unconditional safe choice; each
// choice stamps story_flags.<id>_seen so the router won't repeat it.
const seen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

export const lateGameEvents: Record<string, GameEvent> = {
  // ---------------- 中年身份抉择：IC vs 管理 (H1, 在职, age>=34) ----------------
  'late_ic_vs_management': {
    id: 'late_ic_vs_management',
    title: '【中年抉择】技术专家 vs 带兵管理',
    description: '人到中年，你站在了职业身份的岔路口：是继续深耕成为无可替代的资深技术专家 (IC)，还是转型带团队、走管理路线 (EM)？两条路没有对错，只有取舍。',
    choices: [
      {
        text: '【深耕 IC】深耕 IC：死磕架构与技术影响力，冲 Staff / Principal 技术天花板',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 6),
          impact: addImpact(s, 10),
          story_flags: seen(s, 'late_ic_vs_management'),
          message: '你选择做一辈子写代码的手艺人。你把架构能力磨到炉火纯青，成了组里那个「谁都绕不开」的技术定海神针。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【转型 EM】转型 EM：放下键盘带团队，用杠杆放大影响力',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          leetcode: Math.max(0, s.leetcode - 3),
          health: Math.max(0, s.health - 6),
          impact: addImpact(s, 6),
          story_flags: seen(s, 'late_ic_vs_management'),
          message: '你转身做了 Engineering Manager，从「自己写」变成「让一群人写好」。手感生疏了些，但你学会了用组织杠杆撬动更大的事。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【暂不站队】暂不站队：维持现状，先把手头的事做好',
        effect: (s) => ({
          health: Math.min(100, s.health + 4),
          story_flags: seen(s, 'late_ic_vs_management'),
          message: '你觉得没必要急着贴标签，继续做好当下的活，把选择权留给未来的自己。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 养生 / 长寿投资 (H2, age>=35) ----------------
  'late_longevity_investment': {
    id: 'late_longevity_investment',
    title: '【养生觉醒】中年健康投资',
    description: '一次体检报告让你惊出一身冷汗——常年久坐、熬夜、外卖的账，身体开始跟你算了。是时候认真对待健康这件人生头等大事了。',
    choices: [
      {
        text: '【砸钱系统抗衰】砸钱系统抗衰：私教 + 全套体检 + 营养管理 (花费 $5w)',
        costBadge: '花费 $5w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 5,
        effect: (s) => ({
          cash: parseFloat((s.cash - 5).toFixed(1)),
          health: Math.min(100, s.health + 15),
          story_flags: seen(s, 'late_longevity_investment'),
          message: '你请了私教、做了全面体检、请了营养师定制餐。半年下来精气神脱胎换骨，体检各项指标全面回正，为后半生攒足了健康本钱。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【免费养生】免费养生：早睡早起、跑步、戒糖戒外卖',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          story_flags: seen(s, 'late_longevity_investment'),
          message: '你不花冤枉钱，靠自律重建作息：晨跑、自己做饭、按时睡觉。身体慢慢好了起来，钱包也没受伤。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
    ],
  },

  // ---------------- Mentor / 影响力 legacy (H2, age>=36) ----------------
  'late_mentor_legacy': {
    id: 'late_mentor_legacy',
    title: '【传承】留下点什么',
    description: '走到这个阶段，你开始思考：除了 TC 和职级，你还想给这个行业、给后来人留下点什么？',
    choices: [
      {
        text: '【带新人】带新人 / 做开源 maintainer / 写技术书，沉淀影响力',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 4),
          impact: addImpact(s, 10),
          story_flags: seen(s, 'late_mentor_legacy'),
          message: '你开始系统地带新人、维护自己的开源项目、在博客与书里沉淀方法论。你的名字成了一块招牌，行业影响力悄然复利。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【做天使】做天使 / Advisor，用资源与经验扶持后辈创业 (需现金>=20w)',
        condition: (s) => s.cash >= 20,
        effect: (s) => ({
          cash: parseFloat((s.cash - 3).toFixed(1)),
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          story_flags: seen(s, 'late_mentor_legacy'),
          message: '你以小额天使 + Advisor 身份加入了几个年轻团队。出钱出力出人脉，既回馈了行业，也把自己织进了更广的创业网络。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【顺其自然】顺其自然：先过好自己的小日子',
        effect: (s) => ({
          health: Math.min(100, s.health + 6),
          story_flags: seen(s, 'late_mentor_legacy'),
          message: '你觉得不必刻意留下什么。把自己的生活过明白、过舒坦，本身就是一种圆满。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
    ],
  },

  // ---------------- Post-FIRE 探索 (H2, 已达成初始 FIRE) ----------------
  'late_post_fire_exploration': {
    id: 'late_post_fire_exploration',
    title: '【财务自由之后】人生下半场怎么过',
    description: '你早已越过 FIRE 线，钱不再是问题。真正的问题变成了：接下来这几十年，你想怎么过？',
    choices: [
      {
        text: '【环游世界】环游世界 Gap Year：把攒了半辈子的诗与远方一次走个够 (花现金 $5w)',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({
          cash: parseFloat((s.cash - 5).toFixed(1)),
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          story_flags: seen(s, 'late_post_fire_exploration'),
          message: '你背上行囊环游世界，从冰岛极光到南美雨林。身心被彻底治愈，看世界的眼界也宽了一圈——原来自由是这个味道。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【投身慈善】投身慈善 / 成立开源基金会，把财富转化为影响力 (捐赠 $10w)',
        condition: (s) => s.cash >= 20,
        effect: (s) => ({
          cash: parseFloat((s.cash - 10).toFixed(1)),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 5),
          story_flags: seen(s, 'late_post_fire_exploration'),
          message: '你成立了自己的公益 / 开源基金会，资助教育与开源生态。钱花在了让你真正心安的地方，人生的意义感被重新点亮。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【Encore】Encore Career：重新出发做一直想做的事 (写作 / 教学 / 独立开发)',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 4),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 2),
          story_flags: seen(s, 'late_post_fire_exploration'),
          message: '没有 KPI、没有 Deadline，你纯凭热爱重启了一段「第二事业」：写作、教书、或做个独立开发者。这一次，只为自己而做。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【岁月静好】岁月静好：就这么低调惬意地享受生活',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          story_flags: seen(s, 'late_post_fire_exploration'),
          message: '你不追求轰轰烈烈，只想安安静静地享受来之不易的自由：晒太阳、陪家人、读闲书。平淡即是福。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
    ],
  },
};
