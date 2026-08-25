// Single source of truth for core game constants

export const STORAGE_KEYS = {
  GAME_SAVE: 'sv_life_game_save',
  GAME_SAVE_BACKUP: 'sv_life_game_save.bak',
  INITIAL_SEED: 'sv_life_initial_seed',
  WELCOME_SEEN: 'sv_life_welcome_seen',
  SOUND_MUTED: 'sv_sound_muted',
  ACHIEVEMENTS: 'sv_life_achievements',
} as const;

export const HOUSING_NAMES = {
  ATHERTON: 'Atherton 顶级豪宅',
  SUNNYVALE: 'Sunnyvale 老破小',
  NORTH_SAN_JOSE: 'North San Jose 联排',
  FREMONT: 'Fremont 学区房',
  FREMONT_10_DISTRICT: 'Fremont 10分学区房',
  SUNNYVALE_4PLEX: 'Sunnyvale 4-Plex 公寓楼',
  SAN_JOSE_LUXURY: 'San Jose 高级公寓',
  CUPERTINO_SHARED: 'Cupertino 2b2b合租',
  SUNNYVALE_1B1B: 'Sunnyvale 1b1b独住',
  MOUNTAIN_VIEW_LUXURY: 'Mountain View 豪华公寓',
  LIVING_ROOM_SCREEN: '客厅屏风隔间',
  TESLA_ROOF: '特斯拉 睡车顶',
  NORMAL_SHARED: '普通合租单间',
  BAY_AREA_OLD_HOUSE: '加州湾区老宅',
  CMU_DORM: '四大 校内宿舍',
  UCB_DORM: '大U 校内宿舍',
  STATE_DORM: '美大U 校内宿舍',
  CN_DORM: '国内大学宿舍',
  US_PHD_LAB: '美国 博士实验室',
  US_MASTER_APT: '美硕 校外公寓',
  CN_FACTORY_ROOM: '国内 厂区单间',
} as const;

export type HousingName = typeof HOUSING_NAMES[keyof typeof HOUSING_NAMES];

export const OWNED_HOUSING_NAMES: ReadonlySet<string> = new Set([
  HOUSING_NAMES.ATHERTON,
  HOUSING_NAMES.SUNNYVALE,
  HOUSING_NAMES.NORTH_SAN_JOSE,
  HOUSING_NAMES.FREMONT,
  HOUSING_NAMES.FREMONT_10_DISTRICT,
]);

export const isOwnedHousing = (name?: string): boolean => {
  return Boolean(name && OWNED_HOUSING_NAMES.has(name));
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
  return Boolean(visa && PERMANENT_VISAS.has(visa));
};

// Single source of truth for the "sell stocks to cover a cash shortfall" math.
// Two layers call it: the year-end settlement (to build its own flavored message
// and net-worth history BEFORE returning) and the post-effect middleware (the
// general invariant net for one-off purchases). Both keep their own message copy;
// only the arithmetic lives here so it can't drift between the two.
export const liquidateStocksToCover = (
  cash: number,
  stocks: number,
): { cash: number; stocks: number; sold: number } => {
  if (cash >= 0 || stocks <= 0) return { cash, stocks, sold: 0 };
  const sold = Math.min(stocks, Math.abs(cash));
  return { cash: cash + sold, stocks: stocks - sold, sold };
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
  ORACLE: 'oracle',
  ROBINHOOD: 'robinhood',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  ICC: 'icc',
  CN_BIG_TECH: 'cn_big_tech',
} as const;

// job_type = career CATEGORY only. Specific big-tech employers live in
// COMPANY_PRESETS and are stored as company + job_type:'big_tech'
// (amazon/tiktok/nvidia are companies, NOT job_types).
export const JOB_TYPES = {
  BIG_TECH: 'big_tech',
  STARTUP: 'startup',
  STARTUP_FOUNDER: 'startup_founder',
  TRADER: 'trader',
  AI_RESEARCH: 'ai_research',
  CN_TECH: 'cn_tech',
  UNEMPLOYED: 'unemployed',
} as const;
