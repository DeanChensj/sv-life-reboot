import type { GameEvent, GameState } from '../../types';
import { gameRandom } from './helpers';

// 「见招拆招」硬核终面链 — interactive multi-round onsite mini-game (T3a).
// Opt-in alternative to the auto「海投」dice in job_hunt: the player plays out THREE
// rounds (system design → coding → behavioral/negotiation), each round rewarding the
// choice that matches their real strengths (charm / leetcode / network). Points
// accumulate in story_flags.iv_score; the final round resolves them into concrete
// Offers and reuses the existing job_hop_market selection screen. No engine change —
// pure nextEventId chaining. iv_score is transient chain state, cleared on resolve.
//
// Rules kept: single-choice health loss <= 15; no money printers (Offers still come
// from job_hop_market's balanced packages); state-based routing; every round has an
// always-available choice (no dead-ends).

const OFFER_NAMES: Record<string, string> = {
  google: 'Google', meta: 'Meta', nvidia: 'NVIDIA', tiktok: 'TikTok', apple: 'Apple', startup: 'AI Startup',
};

// Final resolution shared by all round-3 choices: map the accumulated score to Offers.
function resolveGauntlet(s: GameState, addPts: number, healthDelta: number, flavor: string): Partial<GameState> {
  const total = (s.story_flags?.iv_score || 0) + addPts;
  const newLeet = Math.min(100, s.leetcode + 8); // a full onsite gauntlet sharpens you regardless of outcome
  const pool = ['google', 'meta', 'nvidia', 'tiktok', 'apple', 'startup'].filter((c) => c !== s.company && c !== s.job_type);
  const shuffled = [...pool].sort(() => gameRandom() - 0.5);

  let wonOffers: string[] = [];
  if (total >= 5 && newLeet >= 45) wonOffers = shuffled.slice(0, 2);
  else if (total >= 3) wonOffers = shuffled.slice(0, 1);

  const health = Math.max(0, s.health + healthDelta);
  const flags = { ...(s.story_flags || {}), iv_score: 0 };

  if (wonOffers.length > 0) {
    const names = wonOffers.map((id) => OFFER_NAMES[id] || id).join('、');
    return {
       health,
       leetcode: newLeet,
       hop_applied_count: 1,
       hop_offers: wonOffers,
       story_flags: flags,
      message: `${flavor}三轮鏖战下来，综合评分 ${total}/6——你成功拿下了 ${names} 的 Offer！请选择入职去向：`,
    };
  }
  return {
    health,
    leetcode: newLeet,
    hop_offers: [],
    story_flags: flags,
    message: `${flavor}综合评分 ${total}/6，终面惜败未发 Offer。但这场硬仗让你的算法与临场经验实打实大涨 (算法 +8)，下次再战！`,
  };
}

export const interviewEvents: Record<string, GameEvent> = {
  // ---------------- Round 1: 系统设计白板 ----------------
  'interview_onsite_gauntlet_r1': {
    id: 'interview_onsite_gauntlet_r1',
    title: '【终面 Round 1】系统设计白板',
    description: '面试官甩来一道开放题：「设计一个支撑十亿用户的全球短视频推荐系统」，然后把白板笔递到你手里。三轮终面的第一关，见招拆招。',
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
        text: '【手撕真实架构数据流】老老实实画数据流、估容量、逐层聊架构取舍',
        effect: (s) => {
          const pts = s.leetcode >= 55 ? 2 : (s.leetcode >= 40 ? 1 : 0);
          return { health: Math.max(0, s.health - 6), story_flags: { ...(s.story_flags || {}), iv_score: pts }, message: pts >= 2 ? '你把容量估算、分片与热点处理讲得滴水不漏，面试官在评分表上重重写下 Strong Hire 倾向。' : '你尽力画出了架构，但深度追问下暴露了一些经验短板。' };
        },
        nextEventId: 'interview_onsite_gauntlet_r2',
      },
      {
        text: '【抓住核心权衡讲透】稳妥路线：抓住核心权衡讲清楚，不吹不怯',
        effect: (s) => ({ health: Math.max(0, s.health - 3), story_flags: { ...(s.story_flags || {}), iv_score: 1 }, message: '你不追求惊艳，但把关键取舍讲得条理清晰，拿到了一个稳妥的中评。' }),
        nextEventId: 'interview_onsite_gauntlet_r2',
      },
    ],
  },

  // ---------------- Round 2: 手撕算法 ----------------
  'interview_onsite_gauntlet_r2': {
    id: 'interview_onsite_gauntlet_r2',
    title: '【终面 Round 2】Coding 手撕算法',
    description: '协作编辑器打开，一道 Hard 题静静躺在屏幕上，面试官盯着你的光标。第二关，硬碰硬。',
    choices: [
      {
        text: '【直接手撕 Hard 最优解】直接手撕 Hard 最优解，一遍 Bug-free 完美 AC',
        effect: (s) => {
          const pts = s.leetcode >= 65 ? 2 : (s.leetcode >= 45 ? 1 : 0);
          return { health: Math.max(0, s.health - 6), story_flags: { ...(s.story_flags || {}), iv_score: (s.story_flags?.iv_score || 0) + pts }, message: pts >= 2 ? '你行云流水地写出最优解，复杂度分析张口就来，面试官眼睛一亮。' : '题目啃下来了，但中途卡壳了一会儿，AC 得有点惊险。' };
        },
        nextEventId: 'interview_onsite_gauntlet_r3',
      },
      {
        text: '【稳妥做出可行解】稳做出可行解，重点保证边界条件 0 漏洞',
        effect: (s) => ({ health: Math.max(0, s.health - 3), story_flags: { ...(s.story_flags || {}), iv_score: (s.story_flags?.iv_score || 0) + 1 }, message: '你没有强求最优，但代码稳健、边界处理周全，拿到了扎实的及格分。' }),
        nextEventId: 'interview_onsite_gauntlet_r3',
      },
      {
        text: '【边写边讲主打沟通】边写边讲思路，主打工程沟通与 Collaboration',
        effect: (s) => {
          const pts = ((s.charm || 10) >= 15 ? 1 : 0) + (gameRandom() < 0.4 ? 1 : 0);
          return { health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), iv_score: (s.story_flags?.iv_score || 0) + pts }, message: pts >= 1 ? '你把解题思路讲得清清楚楚，面试官感受到了很强的协作沟通能力。' : '你顾着讲解，代码却写得慢了些，时间有点吃紧。' };
        },
        nextEventId: 'interview_onsite_gauntlet_r3',
      },
    ],
  },

  // ---------------- Round 3: Behavioral & 谈薪（含结算）----------------
  'interview_onsite_gauntlet_r3': {
    id: 'interview_onsite_gauntlet_r3',
    title: '【终面 Round 3】Behavioral & 谈薪',
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
