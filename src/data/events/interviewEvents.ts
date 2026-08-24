import type { GameEvent, GameState } from '../../types';
import { gameRandom } from './helpers';

// 「见招拆招」硬核终面链 — interactive multi-round onsite mini-game (T3a).
// Opt-in alternative to the auto「海投」dice in job_hunt: the player plays out TWO
// rounds (system design → behavioral/negotiation), each round rewarding the choice
// that matches their real strengths (charm / leetcode / network). Points accumulate
// in story_flags.iv_score; the final round resolves them into concrete Offers and
// reuses the existing job_hop_market selection screen. No engine change — pure
// nextEventId chaining. iv_score is transient chain state, cleared on resolve.
//
// Rules kept: single-choice health loss <= 15; no money printers (Offers still come
// from job_hop_market's balanced packages); state-based routing; every round has an
// always-available choice (no dead-ends).

const OFFER_NAMES: Record<string, string> = {
  google: 'Google',
  meta: 'Meta',
  nvidia: 'Nvidia',
  tiktok: 'TikTok',
  apple: 'Apple',
  amazon: 'Amazon',
  startup: 'AI Startup',
  robinhood: 'Robinhood',
  openai: 'OpenAI',
};

// Final resolution shared by all round-2 choices: map the accumulated score to Offers.
// Score economy: R1 technical (0-2) + R2 behavioral (0-2) = max 4.
function resolveGauntlet(s: GameState, addPts: number, healthDelta: number, flavor: string): Partial<GameState> {
  const total = (s.story_flags?.iv_score || 0) + addPts;
  const isKingOfRoll = s.trait_title === '卷王之王';
  const newLeet = s.leetcode; // Already boosted in job_hunt prep, plus ongoing practice

  const allPool: Array<{ id: string; name: string; minLeet: number; weight: number }> = [
    { id: 'google', name: 'Google', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 45), weight: 0.95 },
    { id: 'meta', name: 'Meta', minLeet: s.macro_economy === 'bear' ? 65 : (s.macro_economy === 'bull' ? 45 : 55), weight: 0.90 },
    { id: 'nvidia', name: 'Nvidia', minLeet: s.macro_economy === 'bear' ? 60 : (s.macro_economy === 'bull' ? 40 : 48), weight: 0.90 },
    { id: 'tiktok', name: 'TikTok', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
    { id: 'apple', name: 'Apple', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
    { id: 'amazon', name: 'Amazon', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 44), weight: 1.0 },
    { id: 'startup', name: 'AI Startup', minLeet: 30, weight: 1.05 },
    { id: 'robinhood', name: 'Robinhood', minLeet: s.macro_economy === 'bear' ? 54 : (s.macro_economy === 'bull' ? 38 : 46), weight: s.macro_economy === 'bear' ? 0.7 : 0.9 },
  ];

  if ((newLeet >= 70 || s.is_phd) && (s.impact || 0) >= 30) {
    allPool.push({ id: 'openai', name: 'OpenAI', minLeet: s.macro_economy === 'bull' ? 70 : 75, weight: 0.65 });
  }

  const eligiblePool = allPool.filter((c) => c.id !== s.company && c.id !== s.job_type);

  // 终面选择策略打分 total (0~4分) 显著影响通过概率与 Offer 数量
  const scoreBonus = (total - 2) * 0.18; // -0.36 to +0.36
  const econBonus = s.macro_economy === 'bull' ? 0.14 : (s.macro_economy === 'bear' ? -0.20 : 0);
  const charmBonus = ((s.charm || 10) - 10) / 140;
  const luckBonus = ((s.luck || 20) - 20) / 300;
  const ageBonus = s.age >= 35 ? -Math.min(0.18, (s.age - 35) * 0.015) : 0;

  const targetCount = Math.min(eligiblePool.length, total >= 3 ? (isKingOfRoll ? 4 : 3) : (total >= 2 ? 2 : 1));
  const targetCompanies = [...eligiblePool].sort(() => gameRandom() - 0.5).slice(0, targetCount);

  const wonOffers: string[] = [];
  for (const comp of targetCompanies) {
    if (newLeet >= comp.minLeet - (total >= 3 ? 8 : 0)) {
      const diff = newLeet - comp.minLeet;
      const passProb = Math.max(0.05, Math.min(0.85, (0.35 + (diff / 75) + scoreBonus + econBonus + charmBonus + luckBonus + ageBonus) * comp.weight));
      if (gameRandom() < passProb) {
        wonOffers.push(comp.id);
      }
    }
  }

  // 卷王保底机制 / 高分保底
  if ((isKingOfRoll || total >= 3) && wonOffers.length === 0 && targetCompanies.length > 0 && newLeet >= 35) {
    wonOffers.push(targetCompanies[0].id);
  }

  const health = Math.max(0, s.health + healthDelta);
  const flags = { ...(s.story_flags || {}), iv_score: 0 };

  if (wonOffers.length > 0) {
    const names = wonOffers.map((id) => OFFER_NAMES[id] || id).join('、');
    return {
      health,
      leetcode: newLeet,
      hop_applied_count: targetCompanies.length,
      hop_offers: wonOffers,
      story_flags: flags,
      message: `${flavor}两轮鏖战下来（综合表现评分 ${total}/4），你凭借出色的现场发挥与扎实的代码功底，成功斩获了 ${names} 的正式录用 Offer！请选择入职去向：`,
    };
  }
  return {
    health,
    leetcode: newLeet,
    hop_applied_count: targetCompanies.length,
    hop_offers: [],
    story_flags: flags,
    message: `${flavor}两轮综合评分 ${total}/4，由于岗位竞争激烈或临场发挥略有遗憾，未能进入最终录用名单。好在硬核终面让你积累了宝贵的实战经验，技术底子更加扎实！`,
  };
}

export const interviewEvents: Record<string, GameEvent> = {
  // ---------------- Round 1: 技术白板（系统设计 + Coding）----------------
  'interview_onsite_gauntlet_r1': {
    id: 'interview_onsite_gauntlet_r1',
    title: '【终面 Round 1】技术白板：系统设计 + Coding',
    description: '面试官甩来一道开放题：「设计一个支撑十亿用户的全球短视频推荐系统」，随后还要现场手撕一道 Hard 算法题。两轮终面的第一关，见招拆招。',
    choices: [
      {
        text: '【架构黑话大词轰炸】一致性哈希/CAP/分层缓存……先用黑话镇住场子',
        effect: (s) => {
          const pts = (s.charm || 10) >= 15 ? 2 : (gameRandom() < 0.5 ? 1 : 0);
          return { health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), iv_score: pts }, message: pts >= 2 ? '你口若悬河、气场全开，面试官频频点头，被你的架构视野与表达力折服。' : '大词是甩出去了，但面试官追问细节时你有点露怯，勉强稳住。' };
        },
        nextEventId: 'interview_onsite_gauntlet_r2',
      },
      {
        text: '【手撕真实架构与最优解】老老实实画数据流、估容量，再一遍 Bug-free 手撕 Hard 题',
        effect: (s) => {
          const pts = s.leetcode >= 55 ? 2 : (s.leetcode >= 40 ? 1 : 0);
          return { health: Math.max(0, s.health - 6), story_flags: { ...(s.story_flags || {}), iv_score: pts }, message: pts >= 2 ? '你把容量估算、分片与热点处理讲得滴水不漏，Hard 题也行云流水一遍 AC，面试官重重写下 Strong Hire 倾向。' : '你尽力画出了架构、啃下了算法题，但深度追问下暴露了一些经验短板。' };
        },
        nextEventId: 'interview_onsite_gauntlet_r2',
      },
      {
        text: '【抓住核心权衡讲透】稳妥路线：抓住核心取舍讲清楚、代码求稳，不吹不怯',
        effect: (s) => ({ health: Math.max(0, s.health - 3), story_flags: { ...(s.story_flags || {}), iv_score: 1 }, message: '你不追求惊艳，但把关键取舍讲得条理清晰、代码稳健，拿到了一个稳妥的中评。' }),
        nextEventId: 'interview_onsite_gauntlet_r2',
      },
    ],
  },

  // ---------------- Round 2: Behavioral & 谈薪（含结算）----------------
  'interview_onsite_gauntlet_r2': {
    id: 'interview_onsite_gauntlet_r2',
    title: '【终面 Round 2】Behavioral & 谈薪',
    description: 'Hiring Manager 终轮：一半聊 past projects 与 culture fit，一半是暗流涌动的薪资博弈。最后一关，一锤定音。',
    choices: [
      {
        text: '【亮出竞对 Offer 强势谈薪】亮出手上竞对 Offer，强势谈薪拉高包裹',
        effect: (s) => {
          const pts = ((s.network || 10) >= 25 ? 1 : 0) + ((s.charm || 10) >= 15 ? 1 : 0);
          return resolveGauntlet(s, pts, -5, '你把竞对 Offer 摊上桌，气定神闲地谈判——');
        },
        nextEventId: (s) => (s.hop_offers && s.hop_offers.length > 0 ? 'job_hop_market' : 'job_hunt_fail'),
      },
      {
        text: '【真诚讲述成长故事】真诚讲成长故事，主打 Culture Fit 与长期主义',
        effect: (s) => resolveGauntlet(s, 1, -4, '你用几个真实的项目故事打动了面试官——'),
        nextEventId: (s) => (s.hop_offers && s.hop_offers.length > 0 ? 'job_hop_market' : 'job_hunt_fail'),
      },
      {
        text: '【低调求稳】低调求稳，不冒进不给自己挖坑',
        effect: (s) => resolveGauntlet(s, 0, 2, '你选择了最稳妥的收尾，不出彩但也不失分——'),
        nextEventId: (s) => (s.hop_offers && s.hop_offers.length > 0 ? 'job_hop_market' : 'job_hunt_fail'),
      },
    ],
  },
};
