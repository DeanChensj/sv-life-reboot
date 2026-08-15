import type { VisaStatusType, HousingName } from './constants/gameConstants';

export type VisaStatus = VisaStatusType;
export type { HousingName };
export type RelationshipStatus = 'single' | 'matched' | 'dating' | 'married';

export interface NPCState {
  name: string;
  role: 'mentor' | 'manager' | 'co_founder' | 'founder' | 'friend';
  affinity: number; // 好感度/信任度 0-100
  status: 'active' | 'departed' | 'nemesis' | 'ally'; // 活跃/离职/宿敌/坚实盟友
  company?: string;
  note?: string;
}

export interface TimelineRecord {
  id?: string;
  age: number;
  year: number;
  title: string;
  description?: string;
  category: 'education' | 'career' | 'wealth' | 'real_estate' | 'immigration' | 'relation' | 'story' | 'milestone';
  icon?: string;
  statHighlight?: string;
}

export interface StoryFlags {
  met_alex?: boolean;
  alex_meet_year?: number;
  alex_startup_invited?: boolean;
  joined_omniagent?: boolean;
  angel_invest_omniagent?: boolean;
  alex_ipo_done?: boolean;
  omniagent_start_year?: number;
  has_dave_evidence?: boolean;
  dave_conflict_year?: number;
  dave_defeated?: boolean;
  dave_defeated_year?: number;
  dave_veto_done?: boolean;
  met_sam?: boolean;
  sam_zero_day_done?: boolean;
  in_gap_year?: boolean;
  milestone_100w?: boolean;
  milestone_300w?: boolean;
  milestone_500w?: boolean;
  milestone_800w?: boolean;
  [key: string]: unknown;
}

export interface GameState {
  age: number;
  cash: number; // 万美元
  stocks?: number; // 股票持仓 (万美元)
  health: number; // 0-100
  leetcode: number; // 0-100
  visa: VisaStatus;
  tc: number; // 万美元
  max_tc?: number; // 历史最高年薪总包 (峰值 TC, 不受裁员归零影响)
  rent: number; // 万美元
  charm: number; // 颜值 1-10
  max_charm?: number; // 个人遗传魅力上限
  year: number; // 当前年份
  gc_progress: number; // 绿卡排期进度 0-5 年
  is_new_job?: boolean; // Flag to indicate a job hop happened
  is_ssr_unlocked?: boolean; // 8% random roll for SSR Native US Citizen trait
  gc_stage?: 'not_started' | 'perm_processing' | 'perm_audit' | 'i140_processing' | 'i140_rfe' | 'i140_approved' | 'waiting_pd' | 'i485_pending' | 'approved';
  has_us_degree: boolean;
  school: string;
  is_phd: boolean;
  is_master?: boolean;
  last_beauty_year?: number;
  season_stage?: 'h1' | 'h2';
  has_pet: boolean;
  has_cat?: boolean;
  has_dog?: boolean;
  pet_name?: string;
  luck: number;
  network: number; // 人脉/关系网 0-100
  is_married: boolean;
  relationship_status?: RelationshipStatus;
  partner_type?: 'engineer' | 'artist' | 'vc' | 'founder' | 'random';
  has_child?: boolean;
  win_threshold: number;
  has_reached_initial_fire?: boolean; // 是否已达成过初始阶段 FIRE 目标
  fire_tier?: 'basic' | 'comfortable' | 'luxury' | 'dynasty'; // 阶梯 FIRE 等级
  laid_off: boolean;
  job_type?: 'big_tech' | 'startup' | 'ai_research' | 'quant' | 'unemployed' | 'amazon' | 'tiktok' | 'nvidia' | 'trader' | 'startup_founder' | 'cn_tech';
  company?: string;
  level?: string;
  job_start_age?: number;
  last_promo_age?: number;
  h1b_attempts?: number;
  imageUrl?: string;
  has_housing: boolean;
  parents_helped_house?: boolean;
  housing_name?: string;
  rental_income?: number; // 房产出租被动现金流 (万美元/年)
  investment_properties?: string[]; // 投资房产清单
  has_adu_rented?: boolean; // 是否已出租自住房次卧/ADU
  car?: 'none' | 'model_y' | 'porsche' | 'cybertruck';
  status: 'playing' | 'game_over' | 'win' | 'retired'; // retired = 自然终老/寿命结算 (neutral ending)
  message: string;
  trait_title?: string;
  trait_desc?: string;
  cpt_used?: boolean;
  l1_relocated?: boolean;
  mid_year?: boolean;
  difficulty_title?: string;
  startup_tenure?: number; // 初创公司入职年限 (前2年不办PERM)
  founder_stage?: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'exit';
  company_valuation?: number; // 公司估值 (万美元)
  macro_economy?: 'bull' | 'bear' | 'neutral'; // 宏观经济周期
  transferred_to_ai?: boolean; // 是否已内部转岗至前沿大模型组
  last_limited_opp_year?: number; // 记录上一次参与湾区限时机会的年份 (防同一年度重复点击)
  npcs?: Record<string, NPCState>; // 具名长线 NPC 关系网
  hop_applied_count?: number; // 当年投递面试的目标公司总数
  hop_offers?: string[]; // 当年斩获的社招 Offer 列表 (['google', 'meta', etc.])
  story_flags?: StoryFlags; // 跨多回合长线因果伏笔追踪器
  timeline?: TimelineRecord[]; // 历年生涯大事记
  history_net_worth?: { age: number; year: number; netWorth: number; cash: number; stocks: number }[]; // 资产历年走势
  seed?: number; // 可复现的 PRNG 随机数种子
}

export interface Choice {
  text: string;
  costBadge?: string;
  reqBadge?: string;
  effect: (state: GameState) => Partial<GameState>;
  nextEventId: string | ((state: GameState) => string);
  condition?: (state: GameState) => boolean;
  hideIfUnavailable?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  choices: Choice[];
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  category: 'ending' | 'milestone' | 'wealth' | 'fun';
  description: string;
  hint: string;
  unlockedAt?: string;
}

