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
  /** Initial Network stat bonus (alumni / local Bay-Area connections) */
  networkBonus?: number;
  /** Initial Health delta (- = grind burnout, + = chill) */
  healthDelta?: number;
  /** Default on-campus housing */
  defaultHousing: string;
  /** Description / text for choose_school */
  choiceText: string;
  /** Flavor message upon enrollment */
  enrollMessage: string;
  /** Whether the school counts as CS Top 4 / Top-Tier for Quant/Mafia network */
  isTopTierCS?: boolean;
}

export const SCHOOL_PROFILES: Record<SchoolSlug, SchoolProfile> = {
  // 算法天花板:最贵、课业最累,但开局算法最强 + 解锁 Quant/校友内推。
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
    leetcodeBonus: 7,
    healthDelta: -8,
    defaultHousing: '四大 校内宿舍',
    choiceText: '北美CS四大 (Stanford/MIT/CMU/UCB)：算法天花板,学费最贵、课业最累 (四年 $30w)',
    enrollMessage: '你步入了世界计算机最高学府,准备迎接魔鬼课业。',
    isTopTierCS: true,
  },
  // 理工强校"大U"档 (UIUC/UW/UMich 等)。注意:slug 历史上叫 'ucb',但这一档代表的是
  // 大 U 州立强校梯队,并非伯克利本校(伯克利属上面的四大档),故显示一律用「大U」。
  ucb: {
    slug: 'ucb',
    name: '理工强校 (UIUC/UW/UMich)',
    tag: '理工强校',
    undergradLabel: '大U (理工强校)',
    masterLabel: '大U CS 硕士',
    phdLabLabel: '大U 博士实验室',
    timelineName: '理工强校大U (UIUC/UW/UMich)',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold',
    tuition: 18,
    leetcodeBonus: 5,
    networkBonus: 3,
    defaultHousing: '大U 校内宿舍',
    choiceText: '理工强校大U (UIUC/UW/UMich)：扎实工科 + 深厚校友网络,性价比之选 (四年 $18w)',
    enrollMessage: '你来到了全美顶尖理工强校,准备体验硬核课业与庞大的校友圈。',
    isTopTierCS: true,
  },
  // 加州公立 (SJSU):地处湾区,人脉/实习地利最好、最轻松,但算法偏弱、无名校门槛。
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
    networkBonus: 4,
    defaultHousing: '美大U 校内宿舍',
    choiceText: '美国普通公立 (SJSU)：地处湾区,人脉与实习地利最佳、生活轻松,但算法偏弱 (四年 $10w,美籍/绿卡 $4w)',
    enrollMessage: '你飞往湾区,准备开启轻松惬意、人脉广布的本科生活。',
    isTopTierCS: false,
  },
  // 国内本科:最省钱、数理算法功底扎实,但无美国学位与人脉(签证/上岸更难)。
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
    leetcodeBonus: 3,
    defaultHousing: '国内大学宿舍',
    choiceText: '国内本科 / 中外合办：数理算法功底扎实、最省钱,但无美国身份与人脉 (四年 $2w)',
    enrollMessage: '你进入了国内重点高校,打下了扎实的数理基础与算法底子。',
    isTopTierCS: false,
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
