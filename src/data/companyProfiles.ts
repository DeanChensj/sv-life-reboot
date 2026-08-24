// -----------------------------------------------------------------------------
// COMPANY_PROFILES — single source of truth for big-tech employer economics.
//
// Background: `company` on GameState is a plain `string` (it also carries a few
// narrative free-text values like 'OmniAgent AI'), so it cannot be a strict
// union. But every *standard big-tech employer* (job_type:'big_tech' + a
// company slug) used to have its display label / RSU split / year-end health /
// PIP tier / signature event scattered across 5 files as ad-hoc `company === X`
// branches. A new employer that forgot any one of them silently fell into the
// wrong fallback (e.g. Oracle rendered as the generic '硅谷科技大厂').
//
// This table collapses all of that into one entry per company. `BigTechCompany`
// is a closed union and COMPANY_PROFILES is a `Record<BigTechCompany, ...>`, so
// tsc forces every member to have a complete profile — adding an employer is a
// single table entry (plus wiring it into offer generation in career.ts, which
// is intentional new content, never a silent fallback).
// -----------------------------------------------------------------------------

/** Standard big-tech employers stored as company + job_type:'big_tech'. */
export type BigTechCompany =
  | 'google'
  | 'meta'
  | 'apple'
  | 'amazon'
  | 'nvidia'
  | 'tiktok'
  | 'microsoft'
  | 'cisco'
  | 'oracle'
  | 'robinhood';

export interface CompanyProfile {
  /** HUD company-chip label (gameStateSelectors). */
  label: string;
  /** HUD company-chip Tailwind className (gameStateSelectors). */
  className: string;
  /** Timeline "成功入职" hire-message name (stateTransitions). */
  timelineName: string;
  /** Friday-PIP frequency tier in the work-event pool (helpers). */
  pipTier: 'high' | 'low' | 'medium';
  /** Cash/RSU split override for getTCBreakdown; omit = standard 55/45. */
  compSplit?: { base: number; rsu: number };
  /** Year-end health delta (+drain = health loss) + message; omit = 养老大厂 default (+10 WLB). */
  yearEndHealth?: { drain: number; msg: string };
  /** Once-per-game signature work event id (helpers dispatch); omit = none. */
  signatureEvent?: string;
}

export const COMPANY_PROFILES: Record<BigTechCompany, CompanyProfile> = {
  google: {
    label: 'Google',
    className: 'text-blue-400 bg-blue-500/10 border-blue-500/20 font-bold',
    timelineName: 'Google',
    pipTier: 'low',
    signatureEvent: 'google_reorg_limbo',
  },
  meta: {
    label: 'Meta',
    className: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 font-bold',
    timelineName: 'Meta',
    pipTier: 'high',
    compSplit: { base: 0.40, rsu: 0.60 },
    yearEndHealth: { drain: 4, msg: ' 【职场健康】Meta 的 PSC 绩效考评让你小有压力 (健康 -4)。' },
    signatureEvent: 'meta_metaverse_pivot',
  },
  apple: {
    label: 'Apple',
    className: 'text-zinc-300 bg-zinc-700/30 border-zinc-600/40 font-bold',
    timelineName: 'Apple',
    pipTier: 'low',
    signatureEvent: 'apple_secrecy_crackdown',
  },
  amazon: {
    label: 'Amazon',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold',
    timelineName: 'Amazon',
    pipTier: 'high',
    yearEndHealth: { drain: 3, msg: ' 【职场健康】亚麻的 PIP 文化让你不敢懈怠 (健康 -3)。' },
    signatureEvent: 'amazon_six_pager_review',
  },
  nvidia: {
    label: 'Nvidia',
    className: 'text-lime-400 bg-lime-500/10 border-lime-500/20 font-bold',
    timelineName: 'Nvidia',
    pipTier: 'low',
    compSplit: { base: 0.40, rsu: 0.60 },
    yearEndHealth: { drain: 4, msg: ' 【职场健康】英伟达 AI 芯片军备竞赛节奏紧张，让你不敢松懈 (健康 -4)。' },
    signatureEvent: 'nvidia_rsu_moonshot',
  },
  tiktok: {
    label: 'TikTok',
    className: 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold',
    timelineName: 'TikTok',
    pipTier: 'medium',
    compSplit: { base: 0.70, rsu: 0.30 },
    yearEndHealth: { drain: 8, msg: ' 【职场健康】字节的高强度对齐让你略感疲惫 (健康 -8)。' },
    signatureEvent: 'tiktok_us_ban_hearing',
  },
  microsoft: {
    label: 'Microsoft',
    className: 'text-blue-400 bg-blue-500/10 border-blue-500/20 font-bold',
    timelineName: 'Microsoft',
    pipTier: 'medium',
  },
  cisco: {
    label: 'Cisco',
    className: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 font-bold',
    timelineName: 'Cisco',
    pipTier: 'medium',
  },
  oracle: {
    // As a 养老厂 its +10 WLB health and 55/45 comp are standard defaults.
    label: 'Oracle',
    className: 'text-red-300 bg-red-950/40 border-red-600/30 font-bold',
    timelineName: 'Oracle',
    pipTier: 'medium',
    signatureEvent: 'oracle_oci_expansion',
  },
  robinhood: {
    // Fintech / retail-brokerage — the boom-bust archetype. Its total comp is
    // violently macro-bound (see the job_hop_market choice: fat in a bull, gutted
    // in a bear); a bonus-heavy split and mid-high year-end stress reinforce that.
    label: 'Robinhood',
    className: 'text-green-400 bg-green-500/10 border-green-500/20 font-bold',
    timelineName: 'Robinhood',
    pipTier: 'medium',
    compSplit: { base: 0.60, rsu: 0.40 },
    yearEndHealth: { drain: 5, msg: ' 【职场健康】Robinhood 的牛熊生死时速与产品高压节奏消耗了体力 (健康 -5)。' },
    signatureEvent: 'robinhood_meme_stock_frenzy',
  },
};

/**
 * Look up a company's profile. Returns undefined for non-big-tech / narrative
 * company strings (openai, citadel, cn_big_tech, icc, 'OmniAgent AI', …), which
 * are handled by their own job_type-primary branches.
 */
export const getCompanyProfile = (company?: string): CompanyProfile | undefined => {
  if (!company) return undefined;
  return (COMPANY_PROFILES as Record<string, CompanyProfile>)[company];
};
