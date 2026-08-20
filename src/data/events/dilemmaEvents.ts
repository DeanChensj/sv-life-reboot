import type { GameEvent, GameState, StoryFlags, NPCState } from '../../types';
import { h1ToH2Router, addImpact } from './helpers';

// 有牙的两难抉择 — Dilemma events where BOTH options genuinely hurt, binding
// emotion / ethics / money together so there is no "always-optimal" answer. These
// dramatize mechanics that already exist in the engine (green-card PERM reset on
// job-hop, partner_strain → breakup_crisis, NPC arcs) into explicit choices.
// Each is once-per-life (story_flags.<id>_seen), injected from midYearEventRouter.
// Rules: single-choice health loss <= 15; charm capped; no money printers; route on
// STATE via h1ToH2Router; every event has an available choice (no dead-ends).
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
const seen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

export const dilemmaEvents: Record<string, GameEvent> = {
  // ---------------- 有毒老板 vs 绿卡人质 ----------------
  // Only injected when on a temp visa with PERM/I-140 NOT yet approved, so leaving
  // actually forfeits green-card progress (enforced centrally in stateTransitions.ts
  // when is_new_job flips). That real penalty is what makes staying a genuine dilemma.
  'dilemma_toxic_boss_gc_hostage': {
    id: 'dilemma_toxic_boss_gc_hostage',
    title: '【两难】有毒老板 vs 绿卡人质',
    description: '你的直属经理把你当成了免费劳力：PUA、抢功、周末夺命连环 call 样样精通。你早就想跳槽逃离——可一算绿卡：你的 PERM/I-140 还没批下来，一跳槽整个排期就得从头再来。你被这道「绿卡人质」死死拿捏。',
    choices: [
      {
        text: '【忍气吞声熬过排期】忍气吞声留下，死盯绿卡排期熬到 I-140 获批',
        effect: (s) => ({
          health: Math.max(0, s.health - 12),
          network: Math.min(100, (s.network || 10) + 2),
          story_flags: seen(s, 'dilemma_toxic_boss_gc_hostage'),
          message: '你把满腔委屈咽了回去，一边挨着 PUA 一边盯着移民排期表。绿卡进度保住了，但这一年过得身心俱疲，只求 I-140 早日落地。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【愤而跳槽逃离毒环境】愤而跳槽逃离毒环境 (未获批绿卡进度清零重来)',
        condition: employed,
        effect: (s) => ({
          company: 'microsoft',
          job_type: 'big_tech',
          is_new_job: true,
          health: Math.min(100, s.health + 15),
          story_flags: seen(s, 'dilemma_toxic_boss_gc_hostage'),
          message: '你受够了，接了另一家的 offer 转身就走。逃离毒环境后整个人如释重负、神清气爽——代价是绿卡长征只能推倒重来。',
        }),
        // GC reset on hop is applied by the central middleware (is_new_job + temp visa).
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Startup All-in 冲刺 vs 家庭 ----------------
  // Only injected for startup / founder players who currently have a partner.
  'dilemma_startup_allin_family': {
    id: 'dilemma_startup_allin_family',
    title: '【两难】All-in 冲刺 vs 家庭',
    description: '公司到了决定生死的冲刺窗口：投资人等着看数据，deadline 迫在眉睫。而家里，伴侣已经独自撑了好几个月，最近一次争吵后对你说：「你心里到底还有没有这个家？」',
    choices: [
      {
        text: '【All-in 初创拼一把】All-in 扑进公司，赌一把改变命运窗口 (冷落家庭)',
        condition: employed,
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 6),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 12),
          story_flags: { ...seen(s, 'dilemma_startup_allin_family'), partner_strain: (s.story_flags?.partner_strain || 0) + 2 },
          message: '你搬进公司打地铺，家里的消息已读不回。项目冲上了新台阶，但伴侣眼里的失望肉眼可见地堆积——这笔感情账，迟早要还。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【为家庭踩下刹车】把重心拉回身边人与家庭 (放弃部分事业机会)',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          story_flags: { ...seen(s, 'dilemma_startup_allin_family'), partner_strain: 0 },
          message: '你推掉了周末的冲刺，补上了对家人的亏欠。事业那扇窗或许就此错过，但家还在，你久违地睡了个安稳觉。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 独吞功劳 vs 提携恩情 ----------------
  'dilemma_credit_grab_mentor': {
    id: 'dilemma_credit_grab_mentor',
    title: '【两难】独吞功劳 vs 提携恩情',
    description: '一个能一战成名的核心项目，是当年手把手带你入行的老 mentor 和你一起做的。年底评审只有一个升职名额，而你恰好握着能把主要功劳都算到自己头上的话语权。踩着恩人上位，还是把机会让给他？',
    choices: [
      {
        text: '【独吞功劳抢下升职】独吞核心架构功劳，抢下升职名额 (背弃提携恩情)',
        condition: employed,
        effect: (s): Partial<GameState> => {
          const mentor: NPCState = s.npcs?.mentor
            ? { ...s.npcs.mentor, status: 'departed', note: '被你抢功后心灰意冷离职的老恩师' }
            : { name: '老 Mentor', role: 'mentor', status: 'departed', note: '被你抢功后心灰意冷离职的老恩师' };
          return {
            tc: s.tc + 5,
            network: Math.max(0, (s.network || 10) - 6),
            charm: Math.max(0, (s.charm || 10) - 1),
            health: Math.max(0, s.health - 4),
            impact: addImpact(s, 10),
            npcs: { ...(s.npcs || {}), mentor },
            story_flags: { ...seen(s, 'dilemma_credit_grab_mentor'), credit_grabbed: true },
            message: '你在评审会上把关键决策都包装成了自己的功劳，如愿拿下名额。但组里都看在眼里，那位提携过你的前辈默默递了离职信——这笔人情债，你欠下了。',
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【功劳让给恩师 Mentor】把主要功劳让给 Mentor，成全恩人 (放弃升职)',
        effect: (s): Partial<GameState> => {
          const mentor: NPCState = s.npcs?.mentor
            ? { ...s.npcs.mentor, status: 'ally', note: '因你知恩图报而成为坚实盟友的老恩师' }
            : { name: '老 Mentor', role: 'mentor', status: 'ally', note: '因你知恩图报而成为坚实盟友的老恩师' };
          return {
            network: Math.min(100, (s.network || 10) + 8),
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
            health: Math.min(100, s.health + 4),
            npcs: { ...(s.npcs || {}), mentor },
            story_flags: seen(s, 'dilemma_credit_grab_mentor'),
            message: '你主动把 spotlight 让给了恩师。这次升职与你无缘，但你赢得了整个团队发自内心的敬重，也守住了做人的底线，那位前辈从此成了你坚实的盟友。',
          };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
