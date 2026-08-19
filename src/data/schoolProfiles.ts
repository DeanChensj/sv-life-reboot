// -----------------------------------------------------------------------------
// SCHOOL_PROFILES — single source of truth for educational institution profiles.
//
// Background: `school` on GameState is stored as a slug ('cmu', 'ucb',
// 'state', 'cn'). Previously, its display names, labels (undergrad/master/PhD),
// tuition costs, housing names, and admission bonuses were scattered across
// stateTransitions.ts, gameStateSelectors.ts, initialization.ts, and career.ts.
//
// This table consolidates educational institutions into a single table with full
// TypeScript type safety (mirroring COMPANY_PROFILES in companyProfiles.ts).
// -----------------------------------------------------------------------------

export type SchoolSlug = 'cmu' | 'ucb' | 'state' | 'cn';

export interface SchoolProfile {
  slug: SchoolSlug;
  /** Full formal name, e.g. "CMU (卡耐基梅隆)" */
  name: string;
  /** Short tag, e.g. "CS 四大" */
  tag: string;
  /** Display label when attending as undergrad in HUD */
  undergradLabel: string;
  /** Display label when attending as master in HUD */
  masterLabel: string;
  /** Display label when doing PhD lab in HUD */
  phdLabLabel: string;
  /** Timeline milestone name (stateTransitions) */
  timelineName: string;
  /** HUD chip styling className */
  className: string;
  /** Standard 4-year tuition in ten-thousand USD */
  tuition: number;
  /** In-state / subsidized tuition (for citizens/green card holders) */
  inStateTuition?: number;
  /** Initial LeetCode stat bonus upon enrollment */
  leetcodeBonus: number;
  /** Initial Charm stat bonus */
  charmBonus?: number;
  /** Initial Health delta */
  healthDelta?: number;
  /** Default on-campus housing */
  defaultHousing: string;
  /** Description / text for choose_school */
  choiceText: string;
  /** Flavor message upon enrollment */
  enrollMessage: string;
  /** Whether the school counts as CS Top 4 / Top-Tier for Quant/Mafia network */
  isTopTierCS?: boolean;
  /** PhD admission rate bonus */
  phdAdmissionBonus?: number;
}

export const SCHOOL_PROFILES: Record<SchoolSlug, SchoolProfile> = {
  cmu: {
    slug: 'cmu',
    name: 'CMU (卡耐基梅隆)',
    tag: 'CS 四大',
    undergradLabel: 'CMU (CS 四大)',
    masterLabel: 'CMU CS 硕士',
    phdLabLabel: 'CMU 博士实验室',
    timelineName: 'CMU (卡耐基梅隆)',
    className: 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold',
    tuition: 30,
    leetcodeBonus: 5,
    healthDelta: -5,
    defaultHousing: '四大 校内宿舍',
    choiceText: '北美CS四大 (Stanford/MIT/CMU/UCB) (四年总花费 $30w)',
    enrollMessage: '你步入了世界计算机最高学府。',
    isTopTierCS: true,
    phdAdmissionBonus: 0.20,
  },
  ucb: {
    slug: 'ucb',
    name: 'UCB (加州伯克利)',
    tag: '理工强校',
    undergradLabel: 'UCB (加州伯克利)',
    masterLabel: 'UCB CS 硕士',
    phdLabLabel: 'UCB 博士实验室',
    timelineName: 'UCB (加州伯克利)',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold',
    tuition: 18,
    leetcodeBonus: 5,
    defaultHousing: '大U 校内宿舍',
    choiceText: '理工强校大U (如 UIUC/UW/UMich) (四年总花费 $18w)',
    enrollMessage: '你来到了全美顶尖理工强校，准备体验硬核课业。',
    isTopTierCS: true,
    phdAdmissionBonus: 0.10,
  },
  state: {
    slug: 'state',
    name: 'SJSU (圣何塞州立)',
    tag: '加州公立',
    undergradLabel: 'SJSU (加州州立)',
    masterLabel: 'SJSU CS 硕士',
    phdLabLabel: '北美顶尖 AI 实验室',
    timelineName: 'SJSU (圣何塞州立)',
    className: 'text-sky-300 bg-sky-500/10 border-sky-500/20 font-bold',
    tuition: 10,
    inStateTuition: 4,
    leetcodeBonus: 0,
    charmBonus: 2,
    defaultHousing: '美大U 校内宿舍',
    choiceText: '美国普通公立大学 (四年总花费 $10w, 美籍/绿卡含州内补贴只需 $4w)',
    enrollMessage: '你飞往美国，准备开启无忧无虑的本科生活。',
    isTopTierCS: false,
    phdAdmissionBonus: 0,
  },
  cn: {
    slug: 'cn',
    name: '国内重点高校 (985/211)',
    tag: '陆本 985',
    undergradLabel: '国内重点高校',
    masterLabel: '国内硕士/研一',
    phdLabLabel: '国内重点实验室',
    timelineName: '国内高校 / 中外合办大学',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold',
    tuition: 2,
    leetcodeBonus: 0,
    defaultHousing: '国内大学宿舍',
    choiceText: '在国内读本科 / 中外合办大学 (四年总花费 $2w)',
    enrollMessage: '你进入了国内重点高校，打下了扎实的数理基础与算法底子。',
    isTopTierCS: false,
    phdAdmissionBonus: 0,
  },
};

/**
 * Look up a school's profile. Returns undefined for unknown slugs.
 */
export const getSchoolProfile = (school?: string): SchoolProfile | undefined => {
  if (!school) return undefined;
  return (SCHOOL_PROFILES as Record<string, SchoolProfile>)[school];
};

/**
 * Check if the school qualifies as a top-tier CS target for Quant / Mafia referrals.
 */
export const isTopTierCSSchool = (school?: string): boolean => {
  if (!school) return false;
  return !!getSchoolProfile(school)?.isTopTierCS;
};
