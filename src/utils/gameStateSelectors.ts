import type { GameState } from '../types';
import { isOwnedHousing, isPermanentVisa, VISA_STATUS } from '../constants/gameConstants';
import { getCompanyProfile } from '../data/companyProfiles';
import { getSchoolProfile } from '../data/schoolProfiles';
import { LEVEL_PROFILES, normalizeLevel } from '../data/levelProfiles';

export interface JobDisplayInfo {
  companyHeaderLabel: string;
  companyLabel: string;
  companyClassName: string;
  levelHeaderLabel: string;
  levelLabel: string;
  levelClassName: string;
  isUnemployed: boolean;
  isStudent: boolean;
  isDomestic: boolean;
  isTrader: boolean;
  isFounder: boolean;
  tcHeaderLabel: string;
}

export interface VisaDisplayInfo {
  visaLabel: string;
  visaClassName: string;
  gcStation: number;
  isPermanent: boolean;
}

export interface HousingDisplayInfo {
  housingLabel: string;
  carLabel: string | null;
  hasCar: boolean;
  isHomeowner: boolean;
}

/**
 * Role Predicate Helpers:
 * Guarantees semantic role isolation across all events, routers, and annual settlements.
 */
export function isCorporateEmployee(state: GameState): boolean {
  return !state.laid_off &&
         Boolean(state.job_type) &&
         state.job_type !== 'unemployed' &&
         state.job_type !== 'trader' &&
         state.job_type !== 'startup_founder';
}

export function isSelfEmployedOrFounder(state: GameState): boolean {
  return state.job_type === 'startup_founder' || state.job_type === 'trader';
}

export function isUnemployedOrGapYear(state: GameState): boolean {
  return Boolean(state.laid_off || state.job_type === 'unemployed' || !state.job_type);
}

/**
 * Derives standardized job & level display properties from GameState.
 */
export function getJobDisplayInfo(state: GameState): JobDisplayInfo {
  const isTrader = state.job_type === 'trader';
  const isFounder = state.job_type === 'startup_founder';
  const isUnemployed = Boolean(state.laid_off || state.job_type === 'unemployed');
  const isStudent = !state.job_type && !isUnemployed;
  const isDomestic = state.company === 'cn_big_tech' || state.job_type === 'cn_tech';

  let companyHeaderLabel = '当前雇主';
  let levelHeaderLabel = '当前职级';
  let tcHeaderLabel = '年薪总包 (TC)';

  // 1. Level Resolution
  let levelLabel = '待业';
  let levelClassName = 'text-purple-300 bg-purple-500/10 border-purple-500/20';

  if (isTrader) {
    companyHeaderLabel = '操盘状态';
    levelHeaderLabel = '主营策略';
    tcHeaderLabel = '年度收益 (TC)';
    levelLabel = '美股指数/期权';
    levelClassName = 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold shadow-[0_0_8px_rgba(16,185,129,0.2)]';
  } else if (isFounder) {
    companyHeaderLabel = '创立企业';
    levelHeaderLabel = '企业阶段';
    const val = state.company_valuation || 180;
    // Label the stage PURELY from the authoritative `founder_stage` (the middleware in
    // stateTransitions.ts syncs it — monotonically up — from valuation every turn). Do NOT
    // re-derive from valuation here with independent thresholds: that let the HUD show e.g.
    // "种子轮" at $500w while the real stage was still pre_seed (needs $600w), a 1-turn
    // display/state desync. founder_stage → label is 1:1 and can never disagree.
    const FOUNDER_STAGE_LABELS: Record<string, string> = {
      pre_seed: '车库 Pre-Seed',
      seed: '种子轮 Seed',
      series_a: 'A轮成长',
      series_b: 'B轮独角兽',
      exit: '准上市',
    };
    const stageName = FOUNDER_STAGE_LABELS[state.founder_stage ?? 'pre_seed'] ?? '车库 Pre-Seed';
    levelLabel = `${stageName} (估值 $${val}w)`;
    levelClassName = 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/30 font-bold shadow-[0_0_8px_rgba(217,70,239,0.2)]';
  } else if (isUnemployed) {
    companyHeaderLabel = state.story_flags?.in_gap_year ? '生活状态' : '当前状态';
    levelHeaderLabel = state.story_flags?.in_gap_year ? '当前重心' : '当前职级';
    levelLabel = state.story_flags?.in_gap_year ? '身心调养与探索' : '待业';
    levelClassName = state.story_flags?.in_gap_year ? 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30 font-bold' : 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold';
  } else if (isStudent) {
    companyHeaderLabel = '就读院校';
    levelHeaderLabel = '在读学位';
    levelLabel = state.is_phd ? '全奖博士' : state.is_master ? '硕士在读' : '本科在读';
    levelClassName = 'text-sky-300 bg-sky-500/10 border-sky-500/20';
  } else if (state.level) {
    levelLabel = state.level;
  } else {
    if (state.job_type === 'ai_research') levelLabel = 'MTS';
    else if (state.job_type === 'cn_tech') levelLabel = '国内研发';
    else if (state.is_phd) levelLabel = 'L4';
    else levelLabel = 'L3';
  }

  if (!isUnemployed && !isStudent && !isTrader && !isFounder) {
    const norm = normalizeLevel(levelLabel, state);
    if (norm && LEVEL_PROFILES[norm]?.className) {
      levelClassName = LEVEL_PROFILES[norm].className;
    } else {
      levelClassName = 'text-purple-300 bg-purple-500/10 border-purple-500/20';
    }

    // 内部转组赛道标注 (team_focus)
    if (state.story_flags?.team_focus === 'ai_core') {
      levelLabel = `${levelLabel} (AI核心)`;
    } else if (state.story_flags?.team_focus === 'wlb_tools') {
      levelLabel = `${levelLabel} (WLB工具)`;
    }
  }

  // 2. Company Resolution
  let companyLabel = '科技公司';
  let companyClassName = 'text-zinc-300 bg-zinc-800/60 border-zinc-700 font-semibold';

  if (isTrader) {
    companyLabel = '全职 Day Trader';
    companyClassName = 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold shadow-[0_0_8px_rgba(245,158,11,0.25)]';
  } else if (isFounder) {
    companyLabel = 'AI/科技 Startup';
    companyClassName = 'text-purple-300 bg-purple-500/15 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.25)] font-bold';
  } else if (isUnemployed) {
    companyLabel = (state.story_flags?.in_gap_year || !state.laid_off) ? '慢生活 Gap Year' : '待业求职中';
    companyClassName = (state.story_flags?.in_gap_year || !state.laid_off) ? 'text-teal-300 bg-teal-500/15 border-teal-500/30 font-bold' : 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold';
  } else if (isDomestic) {
    companyLabel = '国内互联网大厂';
    companyClassName = 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold';
  } else if (state.company === 'icc') {
    companyLabel = 'ICC 外包 (挂靠)';
    companyClassName = 'text-amber-400 bg-amber-950/40 border-amber-600/30 font-bold';
  } else if (state.job_type === 'ai_research' || state.company === 'openai' || state.company === 'anthropic') {
    companyLabel = state.company === 'anthropic' ? 'Anthropic' : state.company === 'openai' ? 'OpenAI' : '前沿 AI 实验室';
    companyClassName = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold';
  } else if (getCompanyProfile(state.company)) {
    // Standard big-tech employers (google/meta/…/oracle/robinhood) — single lookup.
    const profile = getCompanyProfile(state.company)!;
    companyLabel = profile.label;
    companyClassName = profile.className;
  } else if (state.job_type === 'startup' || state.company === 'startup') {
    companyLabel = 'AI 初创公司';
    companyClassName = 'text-purple-300 bg-purple-500/10 border-purple-500/20 font-bold';
  } else if (state.job_type === 'big_tech') {
    companyLabel = '硅谷科技大厂';
    companyClassName = 'text-purple-300 bg-purple-500/10 border-purple-500/20 font-bold';
  } else if (!state.job_type) {
    const profile = getSchoolProfile(state.school);
    companyLabel = profile?.undergradLabel || ((state.school === 'cn' || !state.has_us_degree) ? '国内重点高校' : '北美高校');
    companyClassName = profile?.className || 'text-sky-300 bg-sky-500/10 border-sky-500/20 font-bold';
  }

  return {
    companyHeaderLabel,
    companyLabel,
    companyClassName,
    levelHeaderLabel,
    levelLabel,
    levelClassName,
    isUnemployed,
    isStudent,
    isDomestic,
    isTrader,
    isFounder,
    tcHeaderLabel,
  };
}

/**
 * Derives standardized visa & green card station progress info from GameState.
 */
export function getVisaDisplayInfo(state: GameState): VisaDisplayInfo {
  const isPermanent = state.visa === '公民' || state.visa === '绿卡';

  let gcStation = 0;
  if (isPermanent) {
    gcStation = 5;
  } else {
    const stage = state.gc_stage || 'not_started';
    const prog = state.gc_progress || 0;
    if (stage === 'i485_pending' || stage === 'approved' || prog >= 4.5) gcStation = 5;
    else if (stage === 'waiting_pd' || prog >= 3.5) gcStation = 4;
    else if (stage === 'i140_processing' || stage === 'i140_rfe' || stage === 'i140_approved' || prog >= 2) gcStation = 3;
    else if (stage === 'perm_audit' || prog >= 1.5) gcStation = 2;
    else if (stage === 'perm_processing' || prog > 0) gcStation = 1;
    else gcStation = 0;
  }

  let visaLabel: string = state.visa || '无';
  let visaClassName: string = 'text-amber-400 bg-amber-400/10 border-amber-400/20 font-semibold';

  if (state.visa === '公民') {
    visaLabel = (state.trait_title === '原生美籍' || state.story_flags?.ssr_citizen) ? '美籍公民 (SSR)' : '美国公民';
    visaClassName = 'text-blue-300 bg-blue-500/15 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.25)] font-bold';
  } else if (state.visa === '绿卡') {
    visaLabel = '美国绿卡';
    visaClassName = 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.25)] font-bold';
  } else if (state.gc_stage === 'i485_pending') {
    visaLabel = 'I-485 Pending';
    visaClassName = 'text-teal-300 bg-teal-500/15 border-teal-500/30 font-bold';
  } else if (state.visa === 'O1 (杰出人才)') {
    visaLabel = 'O-1 (杰出人才)';
    visaClassName = 'text-purple-300 bg-purple-500/15 border-purple-500/30 font-bold';
  } else if (state.visa === 'L1 (外派)') {
    visaLabel = 'L-1 (跨国外派)';
    visaClassName = 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30 font-bold';
  } else if (state.visa === 'Day 1 CPT') {
    visaLabel = 'Day 1 CPT';
    visaClassName = 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold';
  } else if (state.visa === 'H1B (工签)') {
    const isLocked = ['i140_approved', 'waiting_pd'].includes(state.gc_stage || '');
    visaLabel = isLocked ? 'H-1B (已锁PD)' : 'H-1B (工作签证)';
    visaClassName = 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold';
  } else if (state.visa === 'OPT (实习)') {
    const attempts = state.h1b_attempts || 0;
    if (attempts === 0) {
      visaLabel = 'OPT (第1年)';
    } else if (attempts === 1) {
      visaLabel = 'STEM OPT (第2年)';
    } else if (attempts === 2) {
      visaLabel = 'STEM OPT (第3年)';
    } else {
      visaLabel = 'STEM OPT (延期)';
    }
    visaClassName = 'text-amber-400 bg-amber-400/10 border-amber-400/20 font-semibold';
  } else if (state.visa === 'F1 (学生)') {
    visaLabel = state.is_phd ? 'F-1 (博士在读)' : state.is_master ? 'F-1 (硕士在读)' : 'F-1 (在读学生)';
    visaClassName = 'text-sky-300 bg-sky-500/10 border-sky-500/20 font-semibold';
  } else if (!state.visa || state.visa === '无') {
    visaLabel = state.job_type === 'cn_tech' ? '国内在职' : (state.has_us_degree ? '待定身份' : '未赴美');
    visaClassName = 'text-zinc-400 bg-zinc-800/60 border-zinc-700 font-medium';
  }

  return {
    visaLabel,
    visaClassName,
    gcStation,
    isPermanent,
  };
}

/**
 * Derives housing and vehicle display info.
 */
export function getHousingDisplayInfo(state: GameState): HousingDisplayInfo {
  const isHomeowner = isOwnedHousing(state.housing_name);
  const housingLabel = state.housing_name || (state.has_housing ? '湾区自购房产' : '国内老家 / 未购房');

  const hasCar = Boolean(state.car && state.car !== 'none');
  const carLabel = state.car === 'porsche'
    ? '保时捷 911'
    : state.car === 'cybertruck'
      ? 'Tesla Cybertruck'
      : state.car === 'model_y'
        ? 'Tesla Model Y'
        : null;

  return {
    housingLabel,
    carLabel,
    hasCar,
    isHomeowner,
  };
}

export interface TCBreakdown {
  preTaxTC: number;
  preTaxBase: number;
  preTaxRSU: number;
  postTaxBase: number;
  postTaxRSU: number;
  taxRate: number;
  taxAmount: number;
  rsuTaxAmount: number;
}

/**
 * Pure calculation of annual TC Cash / RSU breakdown and taxes.
 * Standardizes compensation split across Big Tech, Meta/NVDA, TikTok, Startups, and Traders.
 */
export function getTCBreakdown(state: GameState): TCBreakdown {
  const preTaxTC = state.tc > 0 && !state.laid_off && state.job_type !== 'unemployed' ? state.tc : 0;
  
  if (preTaxTC <= 0) {
    return {
      preTaxTC: 0,
      preTaxBase: 0,
      preTaxRSU: 0,
      postTaxBase: 0,
      postTaxRSU: 0,
      taxRate: 0.25,
      taxAmount: 0,
      rsuTaxAmount: 0,
    };
  }

  let baseRatio = 0.55;
  let rsuRatio = 0.45;

  // 1. High Cash / Bonus based roles: Trader, Domestic Tech, ICC
  if (state.job_type === 'trader') {
    baseRatio = 0.85;
    rsuRatio = 0.15;
  } else if (state.job_type === 'cn_tech' || state.company === 'cn_big_tech' || state.company === 'icc') {
    baseRatio = 1.0;
    rsuRatio = 0.0;
  }
  // 2. Employer-specific split from the company table (Meta/Nvidia 40/60, TikTok 70/30, …)
  else if (getCompanyProfile(state.company)?.compSplit) {
    const split = getCompanyProfile(state.company)!.compSplit!;
    baseRatio = split.base;
    rsuRatio = split.rsu;
  }
  // 3. High Equity Tech: AI Research labs (same 40/60 as Meta/Nvidia)
  else if (state.job_type === 'ai_research') {
    baseRatio = 0.40;
    rsuRatio = 0.60;
  }
  // 4. Early Stage Startup & Founders
  else if (state.job_type === 'startup') {
    baseRatio = 0.50;
    rsuRatio = 0.50;
  } else if (state.job_type === 'startup_founder') {
    baseRatio = 0.35;
    rsuRatio = 0.65;
  }
  // 5. Standard Big Tech (Google, Apple, Microsoft, Amazon, Cisco, Adobe, etc.)
  else {
    baseRatio = 0.55;
    rsuRatio = 0.45;
  }

  const preTaxBase = parseFloat((preTaxTC * baseRatio).toFixed(2));
  const preTaxRSU = parseFloat((preTaxTC * rsuRatio).toFixed(2));
  // Progressive effective rate (fed + CA + FICA) by TC band — was a flat 25%,
  // which under-taxed everyone (esp. high earners) vs the realistic ~30-38%.
  const taxRate = preTaxTC >= 60 ? 0.36 : preTaxTC >= 30 ? 0.32 : 0.28;
  const taxAmount = parseFloat((preTaxBase * taxRate).toFixed(2));
  const postTaxBase = parseFloat((preTaxBase * (1 - taxRate)).toFixed(2));
  const rsuTaxAmount = parseFloat((preTaxRSU * taxRate).toFixed(2));
  const postTaxRSU = parseFloat((preTaxRSU * (1 - taxRate)).toFixed(2));

  return {
    preTaxTC,
    preTaxBase,
    preTaxRSU,
    postTaxBase,
    postTaxRSU,
    taxRate,
    taxAmount,
    rsuTaxAmount,
  };
}
