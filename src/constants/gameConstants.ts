// Single source of truth for core game constants

export const HOUSING_NAMES = {
  ATHERTON: 'Atherton 顶级豪宅',
  SUNNYVALE: 'Sunnyvale 老破小',
  NORTH_SAN_JOSE: 'North San Jose 联排',
  FREMONT: 'Fremont 学区房',
  CUPERTINO_SHARED: 'Cupertino 2b2b合租',
  SUNNYVALE_1B1B: 'Sunnyvale 1b1b独住',
  MOUNTAIN_VIEW_LUXURY: 'Mountain View 豪华公寓',
  CAR_SLEEPER: '挂壁睡车顶 / 廉价合租',
} as const;

export type HousingName = typeof HOUSING_NAMES[keyof typeof HOUSING_NAMES];

export const OWNED_HOUSING_NAMES: ReadonlySet<string> = new Set([
  HOUSING_NAMES.ATHERTON,
  HOUSING_NAMES.SUNNYVALE,
  HOUSING_NAMES.NORTH_SAN_JOSE,
  HOUSING_NAMES.FREMONT,
]);

export const isOwnedHousing = (name?: string): boolean => {
  return !!name && OWNED_HOUSING_NAMES.has(name);
};

export const VISA_STATUS = {
  NONE: '无',
  F1: 'F1 (学生)',
  OPT: 'OPT (实习)',
  CPT: 'Day 1 CPT',
  H1B: 'H1B (工签)',
  L1: 'L1 (外派)',
  O1: 'O1 (杰出人才)',
  GREEN_CARD: '绿卡',
  CITIZEN: '公民',
} as const;

export type VisaStatusType = typeof VISA_STATUS[keyof typeof VISA_STATUS];

export const PERMANENT_VISAS: ReadonlySet<string> = new Set([
  VISA_STATUS.GREEN_CARD,
  VISA_STATUS.CITIZEN,
]);

export const isPermanentVisa = (visa?: string): boolean => {
  return !!visa && PERMANENT_VISAS.has(visa);
};

export const COMPANY_PRESETS = {
  GOOGLE: 'google',
  META: 'meta',
  APPLE: 'apple',
  AMAZON: 'amazon',
  TIKTOK: 'tiktok',
  NVIDIA: 'nvidia',
  MICROSOFT: 'microsoft',
  CISCO: 'cisco',
  ADOBE: 'adobe',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  TWO_SIGMA: 'two_sigma',
  CITADEL: 'citadel',
  JANE_STREET: 'jane_street',
  ICC: 'icc',
  CN_BIG_TECH: 'cn_big_tech',
} as const;

export const JOB_TYPES = {
  BIG_TECH: 'big_tech',
  STARTUP: 'startup',
  STARTUP_FOUNDER: 'startup_founder',
  TRADER: 'trader',
  QUANT: 'quant',
  AI_RESEARCH: 'ai_research',
  AMAZON: 'amazon',
  TIKTOK: 'tiktok',
  NVIDIA: 'nvidia',
  CN_TECH: 'cn_tech',
  UNEMPLOYED: 'unemployed',
} as const;
