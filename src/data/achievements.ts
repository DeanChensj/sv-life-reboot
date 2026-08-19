import type { Achievement, GameState } from '../types';
import { safeStorage } from '../utils/safeStorage';
import { STORAGE_KEYS, isPermanentVisa } from '../constants/gameConstants';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ai_unicorn_founder',
    title: 'AI 独角兽创始人',
    icon: 'rocket',
    category: 'ending',
    description: '成功创办 AI Agent 科技公司，公司顺利在纳斯达克 IPO 敲钟！',
    hint: '暗号：从事 AI 研究，并在后期财富积累达到 $400w 以上。'
  },
  {
    id: 'crypto_whale',
    title: 'Web3 加密货币巨鲸',
    icon: 'coin',
    category: 'wealth',
    description: '在加密货币牛市中抄底成功，收获了数百万美金的巨额暴利！',
    hint: '暗号：遭遇 Crypto 币圈事件时触发暴利突破。'
  },
  {
    id: 'vancouver_l1_chill',
    title: '温哥华 L1 养老仙人',
    icon: 'mountain',
    category: 'ending',
    description: '避开 H1B 签证内卷危机，外派温哥华分公司，过上了 WLB 的神仙生活！',
    hint: '暗号：H1B 三年未中签危机时，选择外派 Vancouver L1 签证。'
  },
  {
    id: 'bay_area_landlord',
    title: '湾区大地主',
    icon: 'house',
    category: 'wealth',
    description: '在湾区手握 Atherton/Sunnyvale/Fremont 等多套房产，靠收租即可财务自由！',
    hint: '暗号：拥有自住房或投资房，且产生被动租金收益。'
  },
  {
    id: 'passive_cashflow_king',
    title: '现金流之王 (躺平收租)',
    icon: 'crown',
    category: 'wealth',
    description: '购置 Sunnyvale 4-Plex 公寓楼或多套投资房，年租金被动现金流达到 $10w+/年！',
    hint: '暗号：年房产出租被动净现金流达到 $10.0w/年以上。'
  },
  {
    id: 'boba_power_couple',
    title: '湾区神仙眷侣',
    icon: 'heart',
    category: 'fun',
    description: '在 CMB 约会相亲中遇到大厂双职工对象，两人合并资产极速 FIRE！',
    hint: '暗号：在相亲市场（CMB）成功结婚脱单。'
  },
  {
    id: 'leetcode_master',
    title: '力扣千题刷题仙人',
    icon: 'zap',
    category: 'milestone',
    description: 'LeetCode 刷题数达到 100 满分！在硅谷面试市场上神挡杀神！',
    hint: '暗号：将 LeetCode 属性提升至 100 满分。'
  },
  {
    id: 'nvidia_nasdaq_god',
    title: '黑色皮衣挂机战神',
    icon: 'cpu',
    category: 'wealth',
    description: '入职 Nvidia，凭 AI 芯片风口股票暴涨直接极速通关！',
    hint: '暗号：成功入职英伟达 (Nvidia)。'
  },
  {
    id: 'icu_resurrection',
    title: 'ICU 战神重生',
    icon: 'activity',
    category: 'fun',
    description: '经历 996 ICU 警示后成功调养复元，最终实现 FIRE！',
    hint: '暗号：健康度曾低于 30 但最终成功通关 FIRE。'
  },
  {
    id: 'stanford_professor',
    title: '斯坦福名誉教授',
    icon: 'award',
    category: 'ending',
    description: '全奖直博/PhD 博士毕业留校任教，培养了半个硅谷的 AI 大佬！',
    hint: '暗号：拥有 PhD 博士学位并成功通关。'
  },
  {
    id: 'rich_family_fire',
    title: '钞能力极速通关',
    icon: 'crown',
    category: 'ending',
    description: '凭【家里有矿】初始首付资金，在 35 岁前极速完成 FIRE！',
    hint: '暗号：选择【家里有矿】角色并通关。'
  },
  {
    id: 'day_trader_god',
    title: '纳斯达克全职操盘战神',
    icon: 'trending-up',
    category: 'ending',
    description: '凭借绿卡自由身与 50 万美金本金全职操盘，在美股期权中大赚并成功 FIRE！',
    hint: '暗号：持绿卡且现金 >= $50w 开启全职 Day Trader 操盘并通关。'
  },
  {
    id: 'no_gc_fire',
    title: 'H1B 枷锁舞者',
    icon: 'lock',
    category: 'ending',
    description: '在没有拿到绿卡的情况下，顶着身份压力硬核实现了硅谷财务自由！',
    hint: '暗号：通关 FIRE 时身份仍不是绿卡。'
  },
  {
    id: 'wall_street_wolf',
    title: '华尔街之狼',
    icon: 'wolf',
    category: 'wealth',
    description: '重仓期权或 Crypto 实现了不可思议的一夜暴富。',
    hint: '暗号：在股市极高风险操作中获利'
  },
  {
    id: 'l7_senior_staff_architect',
    title: '硅谷资深架构师 (L7)',
    icon: 'award',
    category: 'milestone',
    description: '打破职场终极天堑，在硅谷科技巨头晋升为统领核心技术战略的 L7 Senior Staff 资深工程师！',
    hint: '暗号：职级晋升至 L7 (Senior Staff)。'
  },
  {
    id: 'l8_principal_architect',
    title: '硅谷首席架构师 (L8)',
    icon: 'crown',
    category: 'milestone',
    description: '登顶全球软件工程巅峰，受封全公司仅有数位的 L8 Principal 首席架构师/技术院士！',
    hint: '暗号：职级晋升至 L8 (Principal)。'
  },
  {
    id: 'wsb_leek',
    title: '终极韭菜',
    icon: 'leek',
    category: 'fun',
    description: '炒末日期权或土狗币血本无归，成为华尔街绿油油的韭菜。',
    hint: '暗号：在股市极高风险操作中亏光本金'
  }
];

export function getUnlockedAchievements(): string[] {
  try {
    const saved = safeStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export function unlockAchievement(id: string): boolean {
  try {
    const unlocked = getUnlockedAchievements();
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      safeStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(unlocked));
      return true; // Newly unlocked!
    }
  } catch (e) {}
  return false;
}

export function checkAndUnlockAchievements(state: GameState): string[] {
  const newlyUnlocked: string[] = [];
  const msg = state.message || '';

  if (((state.job_type === 'ai_research' || state.job_type === 'startup_founder' || state.story_flags?.alex_ipo_done || state.founder_stage === 'exit') && state.status === 'win')) {
    if (unlockAchievement('ai_unicorn_founder')) newlyUnlocked.push('ai_unicorn_founder');
  }

  // Gate on a durable flag set in the winning effect. (Was `currentEventId ===
  // 'crypto_scam' && msg.includes(...)`, but by the time achievements are checked
  // currentEventId has advanced to the destination event →永远不触发.)
  if (state.story_flags?.crypto_whale_win) {
    if (unlockAchievement('crypto_whale')) newlyUnlocked.push('crypto_whale');
  }

  if (state.visa === 'L1 (外派)' || state.l1_relocated) {
    if (unlockAchievement('vancouver_l1_chill')) newlyUnlocked.push('vancouver_l1_chill');
  }

  // Landlord achievements require ACTUAL passive rental income, matching their
  // hint text — not merely owning a house / having high net worth (bay_area_landlord)
  // or merely owning the 4-Plex while it sits vacant (passive_cashflow_king).
  if (state.has_housing || (state.rental_income || 0) > 0 || (state.investment_properties || []).length > 0) {
    if ((state.rental_income || 0) >= 2.0 && state.has_housing) {
      if (unlockAchievement('bay_area_landlord')) newlyUnlocked.push('bay_area_landlord');
    }
    if ((state.rental_income || 0) >= 10.0) {
      if (unlockAchievement('passive_cashflow_king')) newlyUnlocked.push('passive_cashflow_king');
    }
  }

  // "大厂双职工" couple: married to a fellow big-tech engineer (structural check,
  // not a fragile substring match on the current message / event id).
  if (state.is_married && state.partner_type === 'engineer') {
    if (unlockAchievement('boba_power_couple')) newlyUnlocked.push('boba_power_couple');
  }

  if (state.leetcode >= 100) {
    if (unlockAchievement('leetcode_master')) newlyUnlocked.push('leetcode_master');
  }

  // Win via the AI-chip stock surge — not merely being hired at Nvidia.
  if (state.company === 'nvidia' && state.status === 'win') {
    if (unlockAchievement('nvidia_nasdaq_god')) newlyUnlocked.push('nvidia_nasdaq_god');
  }

  // Won while still in poor health. State-based only — the old msg.includes('猝死')
  // false-fired on the health-positive「养生防猝死储备」message (carried over into a win).
  if (state.health < 30 && state.status === 'win') {
    if (unlockAchievement('icu_resurrection')) newlyUnlocked.push('icu_resurrection');
  }

  if (state.is_phd && state.status === 'win') {
    if (unlockAchievement('stanford_professor')) newlyUnlocked.push('stanford_professor');
  }

  if (state.status === 'win' && (state.trait_title === '家里有矿' || state.parents_helped_house)) {
    if (unlockAchievement('rich_family_fire')) newlyUnlocked.push('rich_family_fire');
  }

  if (state.job_type === 'trader' && state.status === 'win') {
    if (unlockAchievement('day_trader_god')) newlyUnlocked.push('day_trader_god');
  }

  if (state.status === 'win' && !isPermanentVisa(state.visa)) {
    if (unlockAchievement('no_gc_fire')) newlyUnlocked.push('no_gc_fire');
  }

  if ((state.level || '').startsWith('L7 ')) {
    if (unlockAchievement('l7_senior_staff_architect')) newlyUnlocked.push('l7_senior_staff_architect');
  }

  if ((state.level || '').startsWith('L8 ')) {
    if (unlockAchievement('l8_principal_architect')) newlyUnlocked.push('l8_principal_architect');
  }

  // Gate on durable flags set in the gamble's win/loss effects. (Was
  // `currentEventId === 'stock_market_annual_gamble' && msg.includes(...)`, but
  // currentEventId has already advanced by the time achievements are checked, so
  // these three were permanently unobtainable.)
  if (state.story_flags?.wsb_wolf_win) {
    if (unlockAchievement('wall_street_wolf')) newlyUnlocked.push('wall_street_wolf');
  }

  if (state.story_flags?.wsb_leek) {
    if (unlockAchievement('wsb_leek')) newlyUnlocked.push('wsb_leek');
  }

  return newlyUnlocked;
}
