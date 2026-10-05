import type { GameState } from '../types';
import { gameRandom } from './random';

/**
 * 动态排期 (Dynamic Visa Bulletin)
 * --------------------------------
 * 把「绿卡排期」从一个隐藏的随机计数器，变成一张玩家看得见、会前进也会倒退、能用策略干预的
 * Visa Bulletin。所有日期都用游戏 `year` 的小数表示（例如 2018.25 ≈ 2018 年 4 月），与 `year`
 * 作为「抽象时代时钟」的设计一致 —— 这里没有任何真实日历年的硬编码。
 *
 * 模型（中国大陆出生 EB-2 / EB-3 表 A）：
 *   - 开局积压：EB-2 落后当前年份 ~6 年，EB-3 ~6.5 年（PD 在 PERM 启动时锁定，PERM+I-140 本身
 *     约耗 2 年，因此 I-140 获批后平均还需等 ~4 年 —— 与旧版「50%/年 +0.5」的期望等待接近，
 *     Monte Carlo 门禁不受冲击）。
 *   - 每年基础前进 0.9 年；牛市递件多 → 慢 (-0.3)，熊市 / 寒冬递件少 + 亲属类溢出 → 快 (+0.4)。
 *   - 随机事件：~8% 「大前进」(+1.5 ~ +2.5 年，对应现实中的名额溢出年)，~12% 「排期倒退」
 *     (-0.5 ~ -1.5 年，对应 retrogression)。EB-3 独立加噪声、独立掷骰，因此会出现 EB-3 反超 EB-2 的
 *     「降级窗口」—— 这正是现实里 EB-2 → EB-3 降级策略的来源。
 *   - cutoff 不会超过当前年份（表 A 最多为 Current），也不会倒退到当前年份 9 年以前。
 */

export const EB_INITIAL_BACKLOG = { eb2: 6.0, eb3: 6.5 } as const;
const MAX_BACKLOG_YEARS = 9;

export type EbCategory = NonNullable<GameState['eb_category']>;
export type VisaBulletin = NonNullable<GameState['visa_bulletin']>;

export const EB_CATEGORY_LABEL: Record<EbCategory, string> = {
  eb1: 'EB-1 / NIW',
  eb2: 'EB-2',
  eb3: 'EB-3',
};

export function initVisaBulletin(year: number): VisaBulletin {
  return { eb2: year - EB_INITIAL_BACKLOG.eb2, eb3: year - EB_INITIAL_BACKLOG.eb3 };
}

/** Current bulletin, lazily initialised for saves that predate the feature. */
export function getVisaBulletin(s: Pick<GameState, 'year' | 'visa_bulletin'>): VisaBulletin {
  const vb = s.visa_bulletin;
  if (vb && typeof vb.eb2 === 'number' && typeof vb.eb3 === 'number' && !isNaN(vb.eb2) && !isNaN(vb.eb3)) return vb;
  return initVisaBulletin(s.year);
}

/** PD for display / queue maths. Legacy saves without one assume PERM filed ~2 years ago. */
export function getPriorityDate(s: Pick<GameState, 'year' | 'priority_date'>): number {
  return typeof s.priority_date === 'number' && !isNaN(s.priority_date) ? s.priority_date : s.year - 2;
}

/** Effective category: explicit field, else PhD / O-1 ride the EB-1/NIW fast lane, else EB-2. */
export function getEbCategory(s: Pick<GameState, 'eb_category' | 'is_phd' | 'visa'>): EbCategory {
  if (s.eb_category) return s.eb_category;
  if (s.is_phd || s.visa === 'O1 (杰出人才)') return 'eb1';
  return 'eb2';
}

/** Format a fractional game year as 「2018年4月」. */
export function formatGameYearMonth(y: number): string {
  const whole = Math.floor(y);
  const month = Math.min(12, Math.max(1, Math.round((y - whole) * 12) + 1));
  return `${whole}年${month}月`;
}

export function formatYearsDelta(delta: number): string {
  const months = Math.round(Math.abs(delta) * 12);
  if (months >= 12) {
    const yrs = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0 ? `${yrs} 年` : `${yrs} 年 ${rem} 个月`;
  }
  return `${months} 个月`;
}

export interface PdQueueInfo {
  category: EbCategory;
  categoryLabel: string;
  priorityDate: number;
  /** Table-A cutoff for the player's category; `null` for the EB-1 fast lane (not bulletin-bound). */
  cutoff: number | null;
  /** Years the cutoff still has to travel to reach the PD (≤ 0 ⇒ current). */
  gapYears: number;
  isCurrent: boolean;
  /** Rough ETA in years assuming ~0.9 yr/yr net advance; 0 when current. */
  etaYears: number;
}

/**
 * Where the player stands in the queue. Returns `null` unless a PD exists (stage ≥ perm start).
 * EB-1 is modelled as a fast lane (no backlog) — `cutoff` is null and `isCurrent` is true.
 */
export function getPdQueueInfo(s: GameState): PdQueueInfo | null {
  const stage = s.gc_stage || 'not_started';
  if (stage === 'not_started' || stage === 'approved' || s.visa === '绿卡' || s.visa === '公民') return null;
  const category = getEbCategory(s);
  const priorityDate = getPriorityDate(s);
  if (category === 'eb1') {
    return { category, categoryLabel: EB_CATEGORY_LABEL.eb1, priorityDate, cutoff: null, gapYears: 0, isCurrent: true, etaYears: 0 };
  }
  const vb = getVisaBulletin(s);
  const cutoff = category === 'eb3' ? vb.eb3 : vb.eb2;
  const gapYears = priorityDate - cutoff;
  return {
    category,
    categoryLabel: EB_CATEGORY_LABEL[category],
    priorityDate,
    cutoff,
    gapYears,
    isCurrent: gapYears <= 0,
    etaYears: gapYears <= 0 ? 0 : gapYears / 0.9,
  };
}

/** True when the bulletin has reached the player's PD (or they're on the EB-1 fast lane). */
export function isPdCurrent(s: GameState): boolean {
  const info = getPdQueueInfo(s);
  return !!info && info.isCurrent;
}

/** Minimum lead (years) one table must have over the other before a downgrade/upgrade is worth it. */
export const EB_SWITCH_LEAD_YEARS = 0.5;

/**
 * Whether the `pd_waiting_strategy` panel has at least one real lever for this player
 * (EB-2→EB-3 downgrade window, EB-3→EB-2 switch-back, or an NIW/EB-1A self-petition).
 * Used by the router so the panel never shows up with only the "keep waiting" option.
 */
export function hasPdStrategyLever(s: GameState): boolean {
  const info = getPdQueueInfo(s);
  if (!info || info.category === 'eb1') return false;
  const vb = getVisaBulletin(s);
  const downgrade = info.category === 'eb2' && vb.eb3 >= vb.eb2 + EB_SWITCH_LEAD_YEARS && s.cash >= 0.8;
  const upgradeBack = info.category === 'eb3' && vb.eb2 >= vb.eb3 + EB_SWITCH_LEAD_YEARS && s.cash >= 0.5;
  const niw = s.cash >= 1.5 && ((s.impact || 0) >= 20 || !!s.is_phd);
  return downgrade || upgradeBack || niw;
}

export interface BulletinStep {
  next: VisaBulletin;
  /** Per-category movement in years (positive = forward). */
  delta: { eb2: number; eb3: number };
  /** Short 【前置标签】 note for the settlement log — only the notable events, '' on a routine year. */
  note: string;
}

/**
 * Advance the bulletin by one game year. Deterministic under the seeded `gameRandom`.
 * `economy` is the macro regime for the year being settled.
 */
export function advanceVisaBulletin(
  s: Pick<GameState, 'year' | 'visa_bulletin'>,
  economy: 'bull' | 'bear' | 'neutral' | undefined,
): BulletinStep {
  const cur = getVisaBulletin(s);
  const macroAdj = economy === 'bull' ? -0.3 : economy === 'bear' ? 0.4 : 0;

  const roll = (noise: number): { move: number; kind: 'jump' | 'retro' | 'normal' } => {
    const r = gameRandom();
    if (r < 0.08) return { move: 1.5 + gameRandom() * 1.0, kind: 'jump' };
    if (r < 0.20) return { move: -(0.5 + gameRandom() * 1.0), kind: 'retro' };
    return { move: 0.9 + macroAdj + (gameRandom() * 2 - 1) * noise, kind: 'normal' };
  };

  const eb2Roll = roll(0.3);
  const eb3Roll = roll(0.6);

  const floor = s.year - MAX_BACKLOG_YEARS;
  const clamp = (v: number) => Math.min(s.year, Math.max(floor, v));
  const next: VisaBulletin = {
    eb2: parseFloat(clamp(cur.eb2 + eb2Roll.move).toFixed(2)),
    eb3: parseFloat(clamp(cur.eb3 + eb3Roll.move).toFixed(2)),
  };
  const delta = { eb2: parseFloat((next.eb2 - cur.eb2).toFixed(2)), eb3: parseFloat((next.eb3 - cur.eb3).toFixed(2)) };

  let note = '';
  if (eb2Roll.kind === 'jump') note = ` 【排期大前进】国务院释放大量未用名额，EB-2 表 A 一口气前进 ${formatYearsDelta(delta.eb2)}！`;
  else if (eb2Roll.kind === 'retro') note = ` 【排期倒退】递件量激增、名额告罄，EB-2 表 A 倒退 ${formatYearsDelta(delta.eb2)}，论坛哀鸿遍野。`;
  if (eb3Roll.kind === 'jump' && next.eb3 > next.eb2 + 0.5) note += ` 【EB-3 反超】EB-3 表 A 大幅前进并反超 EB-2，律师群里开始讨论「降级」。`;

  return { next, delta, note };
}

/** gc_progress gauge (3 → 4.4) while waiting on the bulletin, so the HUD bar still creeps. */
export function pdWaitGauge(gapYears: number): number {
  const nominalGap = 4;
  const ratio = Math.max(0, Math.min(1, 1 - gapYears / nominalGap));
  return parseFloat((3 + 1.4 * ratio).toFixed(1));
}
