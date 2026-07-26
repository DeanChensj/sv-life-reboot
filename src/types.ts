export type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | 'O1 (杰出人才)' | '绿卡' | 'Day 1 CPT' | 'L1 (外派)';

export interface GameState {
  age: number;
  cash: number; // 万美元
  health: number; // 0-100
  leetcode: number; // 0-100
  visa: VisaStatus;
  tc: number; // 万美元
  rent: number; // 万美元
  charm: number; // 颜值 1-10 (隐藏)
  year: number; // 当前年份
  gc_progress: number; // 绿卡进度 0-100
  has_us_degree: boolean;
  school: string;
  is_phd: boolean;
  has_pet: boolean;
  luck: number;
  is_married: boolean;
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
  choices: Choice[];
}

