import type { GameState } from '../types';
import { HOUSING_NAMES, isOwnedHousing } from '../constants/gameConstants';

export type EndingTone = 'triumph' | 'content' | 'tragedy';
export type EndingRarity = 'UR' | 'SSR' | 'SR' | 'R' | 'N';

export interface EndingResult {
  id: string;
  emoji: string;
  title: string;
  subtitle: string; // short status-badge text
  flavor: string; // one-line description
  tone: EndingTone;
  rarity: EndingRarity;
}

const totalAssets = (s: GameState): number => (s.cash || 0) + (s.stocks || 0);

const messageIncludes = (s: GameState, needles: string[]): boolean => {
  const msg = s.message || '';
  return needles.some((n) => msg.includes(n));
};

/**
 * Classifies a finished game into a distinct ending archetype based on the final
 * state. Pure + priority-ordered (first match wins, rarest/most-specific first),
 * and ALWAYS returns a result (no "unknown"). Covers three tones:
 *  - triumph: reached FIRE-level success (status 'win', or 'retired' while wealthy)
 *  - content: lived a full life without the jackpot (status 'retired')
 *  - tragedy: game_over (death / bankruptcy / deportation / startup ruin)
 */
export function determineEnding(s: GameState): EndingResult {
  const assets = totalAssets(s);
  const level = s.level || '';
  const props = s.investment_properties || [];

  // ---------- Tragedy (game_over) ----------
  if (s.status === 'game_over') {
    // Deportation / visa loss — message-driven (the visa/OPT/H1B failure events set a
    // clear message). NOT keyed on visa==='无', since that is also the initial
    // "未赴美" state and the domestic path (which resolves to 海归, not deportation).
    if (messageIncludes(s, ['遣返', '登机', 'SEVIS', '吊销签证', '禁令', '离境', '送中', '入境'])) {
      return {
        id: 'deported', emoji: '🛂', title: '梦碎硅谷 · 黯然离境',
        subtitle: 'STATUS: DEPORTED', tone: 'tragedy', rarity: 'N',
        flavor: '签证的达摩克利斯之剑终究落下，你收拾行囊，告别了这场未竟的美国梦。',
      };
    }
    // Burnout death — checked BEFORE founder ruin so a founder who dies of overwork gets
    // the correct 过劳猝死 card. The middleware sets the "过劳猝死 (Burnout)" message on
    // health<=0, which would flatly contradict a 弹尽粮绝 (startup ruin) card.
    if ((s.health ?? 0) <= 0) {
      return {
        id: 'burnout', emoji: '💀', title: '过劳猝死 · 荣誉社畜',
        subtitle: 'STATUS: BURNOUT', tone: 'tragedy', rarity: 'N',
        flavor: '你用尽最后一丝精力照亮了公司的季度 OKR，却再也没能等到属于自己的那份 RSU 归属。',
      };
    }
    // Founder runway bankruptcy.
    if (s.job_type === 'startup_founder' || messageIncludes(s, ['清算', '关停', '弹尽粮绝', '资金链', '倒闭'])) {
      return {
        id: 'startup_ruin', emoji: '⚰️', title: '创业梦碎 · 弹尽粮绝',
        subtitle: 'STATUS: STARTUP RUIN', tone: 'tragedy', rarity: 'N',
        flavor: '账上现金见底，融资无门，你的独角兽梦想在寒冬中清算离场，背负债务重新出发。',
      };
    }
    // Bankruptcy.
    if (assets <= 0 || (s.cash ?? 0) <= 0) {
      return {
        id: 'bankruptcy', emoji: '📉', title: '资不抵债 · 破产驱逐',
        subtitle: 'STATUS: BANKRUPT', tone: 'tragedy', rarity: 'N',
        flavor: '湾区高昂的物价成了压垮你的最后一根稻草，现金流断裂，你被迫退出了这场游戏。',
      };
    }
    return {
      id: 'game_over_generic', emoji: '🥀', title: '硅谷生存 · 黯然终章',
      subtitle: 'STATUS: TERMINATED', tone: 'tragedy', rarity: 'N',
      flavor: '这一局硅谷人生提前落下了帷幕，但重开的机会永远在你手中。',
    };
  }

  // ---------- Triumph (FIRE-level wealth: status 'win', or 'retired' while wealthy) ----------
  const wealthy = s.status === 'win' || assets >= 500;
  if (wealthy) {
    if (s.founder_stage === 'exit' || (s.company_valuation || 0) >= 6000) {
      return {
        id: 'unicorn_founder', emoji: '🦄', title: '独角兽敲钟 · 硅谷传奇',
        subtitle: 'STATUS: IPO / UNICORN', tone: 'triumph', rarity: 'UR',
        flavor: '你在纳斯达克敲响了那口钟。从沙丘路的一份 BP 到万众瞩目的敲钟人，你改写了自己的命运。',
      };
    }
    if (s.job_type === 'trader' || s.job_type === 'quant') {
      return {
        id: 'wall_street_wolf', emoji: '🐺', title: '华尔街之狼 · 交易封神',
        subtitle: 'STATUS: FIRE (TRADER)', tone: 'triumph', rarity: 'SSR',
        flavor: '在 K 线的血雨腥风里，你凭一手漂亮的仓位管理与铁血纪律，交易出了自己的财务自由。',
      };
    }
    if (s.is_phd && (s.job_type === 'ai_research' || (s.leetcode ?? 0) >= 90)) {
      return {
        id: 'ai_academic', emoji: '🏛️', title: 'AI 学术泰斗 · 顶会封神',
        subtitle: 'STATUS: FIRE (RESEARCH)', tone: 'triumph', rarity: 'SSR',
        flavor: '你的论文被顶会 Oral 反复引用，站上了 AI 浪潮之巅——名利双收，实现了知识分子的理想国。',
      };
    }
    if (level.includes('L8') || level.includes('Principal') || level.includes('Distinguished')) {
      return {
        id: 'tech_totem', emoji: '👑', title: '硅谷技术图腾 · L8 巅峰',
        subtitle: 'STATUS: FIRE (L8+)', tone: 'triumph', rarity: 'SSR',
        flavor: '从 New Grad 到 Principal，你把职级天梯爬到了顶。你的名字成了组里新人口中的传说。',
      };
    }
    if ((s.rental_income || 0) >= 8 || props.length >= 2 || props.includes(HOUSING_NAMES.SUNNYVALE_4PLEX)) {
      return {
        id: 'real_estate_mogul', emoji: '🏘️', title: '湾区大地主 · 躺赢收租',
        subtitle: 'STATUS: FIRE (LANDLORD)', tone: 'triumph', rarity: 'SSR',
        flavor: '你手握一串湾区房产，每月租金自动到账。当同事还在卷 Perf，你已靠被动现金流彻底躺平。',
      };
    }
    if (assets >= 3000 || s.fire_tier === 'dynasty') {
      return {
        id: 'silicon_dynasty', emoji: '🏛️', title: '硅谷百亿巨擘 · 家族传奇',
        subtitle: 'STATUS: FIRE (DYNASTY)', tone: 'triumph', rarity: 'UR',
        flavor: '你的资产突破 $3000w+，建立了家族信托与慈善基金会，成为了硅谷乃至全球科技界的殿堂级传奇。',
      };
    }
    if (s.fire_tier === 'luxury' || assets >= 1500 || (s.housing_name === HOUSING_NAMES.ATHERTON) || (isOwnedHousing(s.housing_name) && assets >= 1000)) {
      return {
        id: 'atherton_lord', emoji: '💎', title: '奢华 FIRE · Atherton 庄园主',
        subtitle: 'STATUS: FIRE (LUXURY)', tone: 'triumph', rarity: 'SSR',
        flavor: '你在 Atherton 拥有了自己的庄园，跨越了硅谷最难跨越的那道阶级门槛，登顶人生赢家。',
      };
    }
    if (s.fire_tier === 'comfortable' || assets >= 800) {
      return {
        id: 'fire_comfortable', emoji: '🏖️', title: '舒适 FIRE · 潇洒人生',
        subtitle: 'STATUS: FIRE (COMFORTABLE)', tone: 'triumph', rarity: 'SSR',
        flavor: '坐拥 $800w+ 充裕资产与优质被动收益，你在湾区过上了有闲有钱的松弛生活，尽享惬意人生。',
      };
    }
    return {
      id: 'fire_basic', emoji: '🔥', title: '财务自由 · 见好就收',
      subtitle: 'STATUS: FIRE ACHIEVED', tone: 'triumph', rarity: 'SR',
      flavor: '你在最好的年纪攒够了底气，潇洒登出内卷。再也不用看 Manager 与排期的脸色，余生自由探索。',
    };
  }

  // ---------- Content (natural life, no jackpot: status 'retired') ----------
  // Intentional domestic slow-life retirement (the cn_work_late 急流勇退 choice).
  if (s.story_flags?.cn_hermit) {
    return {
      id: 'cn_hermit', emoji: '🏯', title: '国内隐居 · 佛系定居',
      subtitle: 'STATUS: SLOW LIFE', tone: 'content', rarity: 'R',
      flavor: '你告别了硅谷与 996 的双重内卷，回到二线城市全款置业养生，把日子过成了自己喜欢的慢节奏。',
    };
  }
  // No US visa at retirement = never emigrated / went home — the domestic-path life.
  if (s.visa === '无') {
    return {
      id: 'homecoming', emoji: '✈️', title: '落叶归根 · 海归人生',
      subtitle: 'STATUS: HOMECOMING', tone: 'content', rarity: 'R',
      flavor: '你终究没有把根扎在硅谷。回到熟悉的土地,用这些年的历练,在故乡书写了另一段人生。',
    };
  }
  const isPermanent = s.visa === '绿卡' || s.visa === '公民';
  if (isPermanent && s.is_married) {
    return {
      id: 'settled_family', emoji: '🪪', title: '上岸 · 平凡的幸福',
      subtitle: 'STATUS: SETTLED', tone: 'content', rarity: 'R',
      flavor: '没有一夜暴富，但你熬过了身份长征，有了绿卡/公民身份和温暖的小家。平凡，却也圆满。',
    };
  }
  if ((s.health ?? 0) >= 80 && assets < 200) {
    return {
      id: 'zen_hermit', emoji: '🧘', title: '佛系隐者 · 身心自在',
      subtitle: 'STATUS: BALANCED', tone: 'content', rarity: 'R',
      flavor: '你没在财富的赛道上狂奔，却守住了健康与内心的松弛。谁说人生只有一种活法？',
    };
  }
  return {
    id: 'middle_class', emoji: '🌴', title: '岁月静好 · 中产退休',
    subtitle: 'STATUS: RETIRED', tone: 'content', rarity: 'R',
    flavor: '你在湾区认认真真过完了打工人的一生。虽未跻身顶层，却也稳稳落地，安然退休。',
  };
}
