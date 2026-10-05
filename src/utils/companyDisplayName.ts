import { getCompanyProfile } from '../data/companyProfiles';

// Human-readable names for company keys that have no CompanyProfile entry. Keys that are not
// listed here and not profiled fall through to a humanised form of the key (never a raw
// `toUpperCase()` → 'CN_BIG_TECH' / 'STARTUP' in the HUD or timeline).
const LEGACY_COMPANY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  cn_big_tech: '国内一线互联网大厂',
  icc: 'ICC 外包公司',
  startup: '硅谷初创公司',
  stealth_startup: 'Stealth 初创公司',
  star_startup: '明星独角兽初创',
};

const DEFAULT_COMPANY_FALLBACK = '硅谷科技企业';

/**
 * Display name for a `GameState.company` key.
 *  1. CompanyProfile.timelineName (google → 'Google');
 *  2. legacy keys without a profile (cn_big_tech → '国内一线互联网大厂');
 *  3. keys that already carry display text ('OmniAgent AI', 'AI/科技 Startup') pass through;
 *  4. any other snake_case key is humanised ('some_new_co' → 'Some New Co').
 * An empty key returns `fallback`.
 */
export const getCompanyDisplayName = (company?: string, fallback: string = DEFAULT_COMPANY_FALLBACK): string => {
  if (!company) return fallback;
  const profiled = getCompanyProfile(company)?.timelineName;
  if (profiled) return profiled;
  const legacy = LEGACY_COMPANY_NAMES[company];
  if (legacy) return legacy;
  if (!/^[a-z0-9_]+$/.test(company)) return company;
  return company
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};
