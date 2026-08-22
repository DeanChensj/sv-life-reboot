// -----------------------------------------------------------------------------
// LEVEL_PROFILES — single source of truth for the big-tech career ladder.
//
// Background: `level` on GameState is a plain string. Its promotion thresholds
// (impact/leetcode/charm/network/tc) were duplicated across 3-4 places in
// career.ts + helpers.ts and drifted (e.g. L7 needed leetcode>=65 in the
// war-sprint path but >=70 in the standard perf path). Level comparisons were
// scattered `.includes('L6')` / defensive variant lists (`'L6 (Staff)' ||
// 'Staff' || 'MTS'`) — the same smell that produced dead branches in #75.
//
// This table centralizes: rank (for comparison), display label/className,
// life-stage bucket, and the canonical promotion requirements. Non-standard
// titles (MTS/Quant/Founder/国内研发) are folded onto the ladder via
// normalizeLevel(). Mirrors COMPANY_PROFILES / SCHOOL_PROFILES.
// -----------------------------------------------------------------------------
import type { GameState } from '../types';

export type CareerLevel =
  | 'L3'
  | 'L4'
  | 'L5 (Senior)'
  | 'L6 (Staff)'
  | 'L7 (Senior Staff)'
  | 'L8 (Principal)';

/** Full-stat requirement to reach a given level via organic (in-place) promotion. */
export interface PromoReq {
  impact: number;
  leetcode: number;
  charm: number;
  network: number;
  tc: number;
  health: number;
}

export interface LevelProfile {
  /** L3=3 … L8=8. Used for comparisons (kills `.includes('L6')` / variant lists). */
  rank: number;
  /** HUD level-chip label. */
  label: string;
  /** HUD level-chip Tailwind className. */
  className: string;
  /** Life-stage bucket for signature-event routing (helpers). */
  stage: 'entry' | 'senior' | 'staff_plus';
  /** Canonical organic-promotion requirement to reach THIS level; undefined for entry rungs. */
  organicPromoReq?: PromoReq;
  /** Impact-only gate to be placed at THIS level when hopping; undefined below L6. */
  hopImpactGate?: number;
}

// Canonical promotion thresholds (the former "standard perf" set — the value used
// by 2 of the 3 duplicated call sites; the war-sprint path is unified onto these).
export const LEVEL_PROFILES: Record<CareerLevel, LevelProfile> = {
  'L3': {
    rank: 3, label: 'L3', stage: 'entry',
    className: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  },
  'L4': {
    rank: 4, label: 'L4', stage: 'entry',
    className: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  },
  'L5 (Senior)': {
    rank: 5, label: 'L5 (Senior)', stage: 'senior',
    className: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  },
  'L6 (Staff)': {
    rank: 6, label: 'L6 (Staff)', stage: 'staff_plus',
    className: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
    organicPromoReq: { impact: 20, leetcode: 65, charm: 15, network: 25, tc: 30, health: 35 },
    hopImpactGate: 20,
  },
  'L7 (Senior Staff)': {
    rank: 7, label: 'L7 (Senior Staff)', stage: 'staff_plus',
    className: 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/30 shadow-[0_0_8px_rgba(217,70,239,0.25)]',
    organicPromoReq: { impact: 45, leetcode: 70, charm: 16, network: 35, tc: 45, health: 40 },
    hopImpactGate: 45,
  },
  'L8 (Principal)': {
    rank: 8, label: 'L8 (Principal)', stage: 'staff_plus',
    className: 'text-amber-300 bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(251,191,36,0.3)]',
    organicPromoReq: { impact: 80, leetcode: 80, charm: 20, network: 50, tc: 65, health: 45 },
    hopImpactGate: 80,
  },
};

// Variant aliases → canonical ladder rung (no state needed).
const STATIC_ALIAS: Record<string, CareerLevel> = {
  'L3': 'L3', '初级研发': 'L3',
  'L4': 'L4',
  'L5': 'L5 (Senior)', 'L5 (Senior)': 'L5 (Senior)', '资深研发/Tech Lead': 'L5 (Senior)',
  'L6 (Staff)': 'L6 (Staff)', 'Staff': 'L6 (Staff)',
  'L7 (Senior Staff)': 'L7 (Senior Staff)', 'L7': 'L7 (Senior Staff)', 'Senior Staff': 'L7 (Senior Staff)',
  'L8 (Principal)': 'L8 (Principal)', 'Principal': 'L8 (Principal)', 'Fellow': 'L8 (Principal)',
};

/**
 * Fold any level string — including non-standard titles (MTS/Quant/Founder/国内研发)
 * — onto a canonical CareerLevel. Returns null for a true new grad / non-corporate.
 * State-dependent titles (MTS/Quant/Founder) use tc/impact/tenure, mirroring the
 * former `currentLadderRung`.
 */
export const normalizeLevel = (level?: string, s?: GameState): CareerLevel | null => {
  if (!level || level === '待业') return null;
  if (STATIC_ALIAS[level]) return STATIC_ALIAS[level];
  const impact = s?.impact ?? 0;
  const tc = s?.tc ?? 0;
  if (level === 'MTS' || level === 'Quant') {
    return (tc >= 60 || impact >= 20) ? 'L6 (Staff)' : 'L5 (Senior)';
  }
  if (level === 'CEO & Founder' || level === 'CTO & Co-Founder') {
    return impact >= 45 ? 'L7 (Senior Staff)' : impact >= 20 ? 'L6 (Staff)' : 'L5 (Senior)';
  }
  if (level === '国内研发') {
    const tenure = s ? (s.age - (s.job_start_age || s.age)) : 0;
    return tenure >= 2 ? 'L4' : 'L3';
  }
  return null;
};

/** Numeric rank of a level (0 for unknown / non-ladder). */
export const getLevelRank = (level?: string, s?: GameState): number => {
  const c = normalizeLevel(level, s);
  return c ? LEVEL_PROFILES[c].rank : 0;
};

/** L6 Staff or above (kills `level.includes('L6') || ...` checks). */
export const isStaffPlus = (level?: string, s?: GameState): boolean => getLevelRank(level, s) >= 6;

/** Canonical organic-promotion requirement to reach `target`. */
export const getOrganicPromoReq = (target: CareerLevel): PromoReq | undefined => LEVEL_PROFILES[target].organicPromoReq;

/** Impact-only hop gate to be placed at `target` (0 below L6). */
export const getHopImpactGate = (target: CareerLevel): number => LEVEL_PROFILES[target].hopImpactGate ?? 0;

/**
 * Whether `s` meets the canonical stat bar to be promoted to `target`.
 * - Always checks impact / leetcode / charm / network (the unified stat bar).
 * - `sprint`: the war-sprint gamble path — relaxed, skips the tc + health gates
 *   (its cost is the -15 health hit + capped random roll, not the prerequisites).
 * - default: standard perf path — also requires tc + health.
 * Level tenure (yearsInGrade) and the probabilistic roll stay with the caller.
 */
export const meetsOrganicPromo = (
  s: Pick<GameState, 'impact' | 'leetcode' | 'charm' | 'network' | 'tc' | 'health'>,
  target: CareerLevel,
  opts?: { sprint?: boolean },
): boolean => {
  const r = LEVEL_PROFILES[target].organicPromoReq;
  if (!r) return false;
  const statBar =
    (s.impact || 0) >= r.impact &&
    s.leetcode >= r.leetcode &&
    (s.charm || 10) >= r.charm &&
    (s.network || 10) >= r.network;
  if (opts?.sprint) return statBar;
  return statBar && s.tc >= r.tc && s.health >= r.health;
};

/**
 * 升职受阻诊断:当一次晋升尝试没能兑现时,对比当前状态与下一职级的 organicPromoReq,
 * 给出「卡在哪」的可行动反馈(跨组影响力 Impact / 算法深度 / 高层人脉与 Leadership 背书 /
 * 向上管理与沟通)。让玩家像读牛熊指标一样,读懂升职信号后主动补短板。
 * - 仅覆盖 Staff+ (L5→L6→L7→L8) 这段「隐形门槛」——L3/L4 的失败文案本就已明示算法门槛。
 * - 硬指标全达标但仍未升,则说明是资历/名额(Quota)问题,给出对应提示。
 * 返回空串表示当前职级不适用(交给调用方回退到通用文案)。
 */
export const promoBlockerHint = (s: GameState): string => {
  const cur = normalizeLevel(s.level, s);
  if (!cur) return '';
  const nextMap: Partial<Record<CareerLevel, CareerLevel>> = {
    'L5 (Senior)': 'L6 (Staff)',
    'L6 (Staff)': 'L7 (Senior Staff)',
    'L7 (Senior Staff)': 'L8 (Principal)',
  };
  const target = nextMap[cur];
  if (!target) return '';
  const r = getOrganicPromoReq(target);
  if (!r) return '';
  const gaps: string[] = [];
  if ((s.impact || 0) < r.impact) gaps.push(`跨组影响力 Impact 不足 (${Math.round(s.impact || 0)}/${r.impact})`);
  if ((s.leetcode || 0) < r.leetcode) gaps.push(`算法/技术深度不够 (${s.leetcode || 0}/${r.leetcode})`);
  if ((s.network || 10) < r.network) gaps.push(`高层人脉与 Leadership 背书不足 (${s.network || 10}/${r.network})`);
  if ((s.charm || 10) < r.charm) gaps.push(`向上管理与团队沟通欠佳 (${s.charm || 10}/${r.charm})`);
  if (gaps.length > 0) {
    return `【晋升诊断】冲击 ${target} 受阻 —— ${gaps.slice(0, 2).join('；')}。针对性补齐后再冲!`;
  }
  const yig = s.age - (s.last_promo_age ?? (s.age - 1));
  if (yig < 2) return `【晋升诊断】冲击 ${target} 硬指标已达标,但本级资历尚浅 (需满 2 年),稳一稳明年冲!`;
  return `【晋升诊断】冲击 ${target} 各项硬指标均已达标,惜败于本年度晋升名额 (Quota) 竞争,明年再冲!`;
};
