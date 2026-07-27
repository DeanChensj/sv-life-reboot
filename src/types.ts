export type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | 'O1 (杰出人才)' | '绿卡' | 'Day 1 CPT' | 'L1 (外派)';
export type RelationshipStatus = 'single' | 'matched' | 'dating' | 'married';

export interface GameState {
  age: number;
  cash: number; // 万美元
  health: number; // 0-100
  leetcode: number; // 0-100
  visa: VisaStatus;
  tc: number; // 万美元
  rent: number; // 万美元
  charm: number; // 颜值 1-10
  max_charm?: number; // 个人遗传魅力上限
  year: number; // 当前年份
  gc_progress: number; // 绿卡排期进度 0-5 年
  has_us_degree: boolean;
  school: string;
  is_phd: boolean;
  has_pet: boolean;
  pet_name?: string;
  luck: number;
  is_married: boolean;
  relationship_status?: RelationshipStatus;
  win_threshold: number;
  laid_off: boolean;
  job_type?: 'big_tech' | 'startup' | 'ai_research' | 'quant' | 'unemployed' | 'amazon' | 'tiktok' | 'nvidia';
  company?: string;
  level?: string;
  last_promo_age?: number;
  h1b_attempts?: number;
  imageUrl?: string;
  has_housing: boolean;
  parents_helped_house?: boolean;
  housing_name?: string;
  car?: 'none' | 'model_y' | 'porsche' | 'cybertruck';
  status: 'playing' | 'game_over' | 'win';
  message: string;
  ap: number;
  max_ap: number;
  trait_title?: string;
  trait_desc?: string;
  cpt_used?: boolean;
  l1_relocated?: boolean;
  mid_year?: boolean;
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

