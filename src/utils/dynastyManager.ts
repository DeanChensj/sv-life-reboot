import type { GameState, DynastyState, DynastyPerk, AncestorRecord } from '../types';
import { safeStorage } from './safeStorage';
import { STORAGE_KEYS } from '../constants/gameConstants';
import { determineEnding } from './endings';
import { getUnlockedAchievements } from '../data/achievements';
import { getJobDisplayInfo } from './gameStateSelectors';

export const DYNASTY_PERKS: DynastyPerk[] = [
  {
    id: 'perk_acm_gold_gene',
    name: '做题家血脉',
    cost: 150,
    category: 'career',
    icon: '⚡',
    description: '继承先祖手撕红黑树的做题基因，代码直觉融于骨髓。',
    effectDescription: '开局 LeetCode 刷题底子 +25 题，面试算法题判定门槛大幅降低。',
  },
  {
    id: 'perk_titanium_liver',
    name: '钛合金肝脏',
    cost: 250,
    category: 'health',
    icon: '🛡️',
    description: '经历数代 996 与 On-call 淬炼出的超凡体魄与抗压抗糙基因。',
    effectDescription: '开局基础健康上限提升至 105，全游戏内卷与加班扣血减免 25%。',
  },
  {
    id: 'perk_sand_hill_uncle',
    name: '沙丘路人脉',
    cost: 350,
    category: 'network',
    icon: '👔',
    description: '家族通讯录里躺着几位沙丘路顶级风投 Partner 与大厂高管。',
    effectDescription: '开局自带人脉 (Network) +20，创业融资与社招内推概率显著提高。',
  },
  {
    id: 'perk_compound_interest',
    name: '复利先锋',
    cost: 400,
    category: 'wealth',
    icon: '📈',
    description: '从小耳濡目染资产配置之道，深谙硅谷科技股与指数基金复利密码。',
    effectDescription: '开局股票本金 +$3.0w，股市牛市爆发收益与房产被动租金增幅额外 +15%。',
  },
  {
    id: 'perk_stanford_legacy',
    name: '名校校友通道',
    cost: 500,
    category: 'career',
    icon: '🏛️',
    description: '先祖名校毕业积累的校友网络，让你在顶尖学术圈与实验室畅通无阻。',
    effectDescription: '开局魅力与个人背景评分额外提升，申请全奖博士与名校加急美硕优先录取。',
  },
  {
    id: 'perk_native_citizen',
    name: '天生美籍 (SSR)',
    cost: 800,
    category: 'immigration',
    icon: '🇺🇸',
    description: '经过数代打拼，家族终于在美扎根，出生即拥有美籍公民身份！',
    effectDescription: '永久激活天生美国公民 (SSR) 开局，彻底甩开 H-1B 抽签、L-1 与绿卡排期枷锁！',
  },
];

export const DEFAULT_DYNASTY_STATE: DynastyState = {
  generation: 1,
  leet_points: 0,
  total_runs: 0,
  dynasty_trust_cash: 0,
  unlocked_perk_ids: [],
  ancestor_hall_of_fame: [],
};

export function getDynastyState(): DynastyState {
  try {
    const raw = safeStorage.getItem(STORAGE_KEYS.DYNASTY_SAVE);
    if (!raw) return { ...DEFAULT_DYNASTY_STATE };
    const parsed = JSON.parse(raw);
    return {
      generation: typeof parsed.generation === 'number' && parsed.generation >= 1 ? parsed.generation : 1,
      leet_points: typeof parsed.leet_points === 'number' && parsed.leet_points >= 0 ? parsed.leet_points : 0,
      total_runs: typeof parsed.total_runs === 'number' && parsed.total_runs >= 0 ? parsed.total_runs : 0,
      dynasty_trust_cash: typeof parsed.dynasty_trust_cash === 'number' && parsed.dynasty_trust_cash >= 0 ? parsed.dynasty_trust_cash : 0,
      unlocked_perk_ids: Array.isArray(parsed.unlocked_perk_ids) ? parsed.unlocked_perk_ids : [],
      ancestor_hall_of_fame: Array.isArray(parsed.ancestor_hall_of_fame) ? parsed.ancestor_hall_of_fame : [],
      last_inheritance_summary: parsed.last_inheritance_summary,
    };
  } catch (e) {
    return { ...DEFAULT_DYNASTY_STATE };
  }
}

export function saveDynastyState(state: DynastyState): void {
  try {
    safeStorage.setItem(STORAGE_KEYS.DYNASTY_SAVE, JSON.stringify(state));
  } catch (e) {}
}

export interface SettlementRewards {
  leetPointsEarned: number;
  trustCashEarned: number;
  pointBreakdown: { label: string; points: number }[];
  ancestorRecord: AncestorRecord;
}

/**
 * Calculates Roguelite meta-progression rewards (LeetPoints and Dynasty Trust Fund)
 * based on the final GameState of a completed run.
 */
export function calculateSettlementRewards(state: GameState): SettlementRewards {
  const ending = determineEnding(state);
  const totalAssets = (state.cash || 0) + (state.stocks || 0);
  const jobInfo = getJobDisplayInfo(state);
  const pointBreakdown: { label: string; points: number }[] = [];

  let totalPoints = 0;

  // 1. Wealth factor (1 point per $5w assets, capped at 300)
  const wealthPts = Math.min(300, Math.floor(totalAssets / 5));
  if (wealthPts > 0) {
    pointBreakdown.push({ label: `资产积累 ($${totalAssets.toFixed(1)}w)`, points: wealthPts });
    totalPoints += wealthPts;
  }

  // 2. Career / Level Achievement factor
  let levelPts = 0;
  if (state.founder_stage === 'exit' || (state.company_valuation || 0) >= 5000) {
    levelPts = 250;
    pointBreakdown.push({ label: '独角兽 IPO 敲钟退场', points: levelPts });
  } else if ((state.level || '').includes('L8') || (state.level || '').includes('Principal')) {
    levelPts = 200;
    pointBreakdown.push({ label: '受封 L8 Principal 首席架构师', points: levelPts });
  } else if ((state.level || '').includes('L7') || (state.level || '').includes('Senior Staff')) {
    levelPts = 140;
    pointBreakdown.push({ label: '晋升 L7 Senior Staff 资深技术大牛', points: levelPts });
  } else if ((state.level || '').includes('L6') || (state.level || '').includes('Staff') || (state.level || '').includes('MTS')) {
    levelPts = 80;
    pointBreakdown.push({ label: '晋升 L6 Staff 核心骨干', points: levelPts });
  } else if (state.job_type === 'trader' || state.job_type === 'quant') {
    levelPts = 100;
    pointBreakdown.push({ label: '华尔街 Quant/全职操盘手', points: levelPts });
  }
  totalPoints += levelPts;

  // 3. Ending Tone factor
  let tonePts = 50;
  if (ending.tone === 'triumph') {
    tonePts = 150;
    pointBreakdown.push({ label: '登顶 FIRE 财务自由 (胜利勋章)', points: tonePts });
  } else if (ending.tone === 'content') {
    tonePts = 80;
    pointBreakdown.push({ label: '安然退休 · 岁月静好', points: tonePts });
  } else {
    tonePts = 40;
    pointBreakdown.push({ label: '打工抚恤津贴 (重整旗鼓)', points: tonePts });
  }
  totalPoints += tonePts;

  // 4. Lifespan & Resilience factor
  if (state.age >= 38) {
    const agePts = Math.min(100, (state.age - 35) * 8);
    if (agePts > 0) {
      pointBreakdown.push({ label: `硅谷长青奋斗 (${state.age} 岁高龄)`, points: agePts });
      totalPoints += agePts;
    }
  }

  // 5. Total Achievements bonus
  const achievements = getUnlockedAchievements();
  if (achievements.length > 0) {
    const achPts = Math.min(200, achievements.length * 15);
    pointBreakdown.push({ label: `成就图鉴加成 (${achievements.length} 项)`, points: achPts });
    totalPoints += achPts;
  }

  // Calculate Next-Gen Trust Cash (家族信托基金)
  let trustCashEarned = 0;
  if (state.status === 'win' || totalAssets >= 500) {
    // 5% of total wealth, clamped between $10w and $50w
    trustCashEarned = parseFloat(Math.min(50, Math.max(10, totalAssets * 0.05)).toFixed(1));
  } else if (state.status === 'retired' && totalAssets >= 150) {
    trustCashEarned = parseFloat(Math.min(20, Math.max(5, totalAssets * 0.03)).toFixed(1));
  } else if (state.status === 'game_over') {
    // Compassion starter seed fund for next gen
    trustCashEarned = totalAssets >= 20 ? 3.0 : 1.5;
  }

  const ancestorRecord: AncestorRecord = {
    generation: state.generation || 1,
    name: `第 ${state.generation || 1} 代 · ${state.trait_title || '奋斗做题家'}`,
    age: state.age,
    finalNetWorth: parseFloat(totalAssets.toFixed(1)),
    endingTitle: ending.title,
    companyOrRole: jobInfo.companyLabel,
    levelOrStage: jobInfo.levelLabel,
    fireTier: state.fire_tier,
    completedAt: Date.now(),
  };

  return {
    leetPointsEarned: Math.max(50, totalPoints),
    trustCashEarned,
    pointBreakdown,
    ancestorRecord,
  };
}

/**
 * Settles the current game into the global Dynasty progression:
 * records the ancestor into Hall of Fame, deposits points and trust cash,
 * and increments generation.
 */
export function settleDynastyRun(state: GameState): { updatedDynasty: DynastyState; rewards: SettlementRewards } {
  const currentDynasty = getDynastyState();
  const rewards = calculateSettlementRewards(state);

  const newGeneration = (state.generation || currentDynasty.generation || 1) + 1;
  const newLeetPoints = currentDynasty.leet_points + rewards.leetPointsEarned;
  const newTotalRuns = currentDynasty.total_runs + 1;

  // Add ancestor record, keeping top 25 most recent / legendary ancestors
  const newHallOfFame = [rewards.ancestorRecord, ...currentDynasty.ancestor_hall_of_fame].slice(0, 25);

  const updatedDynasty: DynastyState = {
    ...currentDynasty,
    generation: newGeneration,
    leet_points: newLeetPoints,
    total_runs: newTotalRuns,
    dynasty_trust_cash: rewards.trustCashEarned,
    ancestor_hall_of_fame: newHallOfFame,
    last_inheritance_summary: {
      prevGeneration: state.generation || 1,
      pointsEarned: rewards.leetPointsEarned,
      trustCashEarned: rewards.trustCashEarned,
      reason: rewards.ancestorRecord.endingTitle,
    },
  };

  saveDynastyState(updatedDynasty);
  return { updatedDynasty, rewards };
}

/**
 * Purchases/Unlocks a permanent Dynasty Perk using LeetPoints.
 */
export function unlockDynastyPerk(perkId: string): { success: boolean; message: string; updatedDynasty?: DynastyState } {
  const current = getDynastyState();
  const perk = DYNASTY_PERKS.find(p => p.id === perkId);

  if (!perk) {
    return { success: false, message: '未找到该宗族基因' };
  }

  if (current.unlocked_perk_ids.includes(perkId)) {
    return { success: false, message: '该宗族基因已永久解锁！' };
  }

  if (current.leet_points < perk.cost) {
    return { success: false, message: `做题家点数不足！需要 ${perk.cost} 点 (当前持有 ${current.leet_points} 点)` };
  }

  const updated: DynastyState = {
    ...current,
    leet_points: current.leet_points - perk.cost,
    unlocked_perk_ids: [...current.unlocked_perk_ids, perkId],
  };

  saveDynastyState(updated);
  return {
    success: true,
    message: `🎉 成功解锁宗族基因【${perk.name}】！将在所有新开局中永久生效！`,
    updatedDynasty: updated,
  };
}

/**
 * Injects dynasty inheritance (generation, trust fund cash, unlocked perks bonuses)
 * onto a fresh new GameState when starting a new life.
 */
export function applyDynastyToNewGame(baseState: GameState): GameState {
  const dynasty = getDynastyState();
  const unlocked = new Set(dynasty.unlocked_perk_ids);

  let bonusCash = baseState.cash;
  let bonusStocks = baseState.stocks || 0;
  let bonusLeetcode = baseState.leetcode;
  let bonusHealth = baseState.health;
  let bonusNetwork = baseState.network || 10;
  let bonusCharm = baseState.charm;
  let visa = baseState.visa;

  // 1. Trust fund cash from previous generation
  if (dynasty.dynasty_trust_cash > 0) {
    bonusCash += dynasty.dynasty_trust_cash;
  }

  // 2. Active Dynasty Perk Bonuses
  if (unlocked.has('perk_acm_gold_gene')) {
    bonusLeetcode = Math.min(100, bonusLeetcode + 25);
  }
  if (unlocked.has('perk_titanium_liver')) {
    bonusHealth = Math.min(110, bonusHealth + 10);
  }
  if (unlocked.has('perk_sand_hill_uncle')) {
    bonusNetwork = Math.min(100, bonusNetwork + 20);
  }
  if (unlocked.has('perk_compound_interest')) {
    bonusStocks += 3.0;
  }
  if (unlocked.has('perk_stanford_legacy')) {
    bonusCharm = Math.min(25, bonusCharm + 4);
  }
  if (unlocked.has('perk_native_citizen') && baseState.trait_title === '天生美籍') {
    visa = '公民';
  }

  return {
    ...baseState,
    cash: parseFloat(bonusCash.toFixed(2)),
    stocks: parseFloat(bonusStocks.toFixed(2)),
    leetcode: bonusLeetcode,
    health: bonusHealth,
    network: bonusNetwork,
    charm: bonusCharm,
    visa,
    generation: dynasty.generation,
    inherited_cash: dynasty.dynasty_trust_cash,
    active_dynasty_perks: dynasty.unlocked_perk_ids,
  };
}
