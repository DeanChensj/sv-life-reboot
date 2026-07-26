export type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | 'O1 (杰出人才)' | '绿卡';

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
  gc_progress: number; // 绿卡进度
  has_us_degree: boolean;
  school: string;
  is_phd: boolean;
  has_pet: boolean;
  luck: number;
  is_married: boolean;
  win_threshold: number;
  laid_off: boolean;
  job_type?: 'big_tech' | 'startup' | 'ai_research' | 'quant' | 'unemployed' | 'amazon' | 'tiktok' | 'nvidia';
  imageUrl?: string;
  has_housing: boolean;
  parents_helped_house?: boolean;
  housing_name?: string;
  car?: 'none' | 'model_y' | 'porsche' | 'cybertruck';
  status: 'playing' | 'game_over' | 'win';
  message: string;
  ap: number;
  max_ap: number;
}

export interface Choice {
  text: string;
  effect: (state: GameState) => Partial<GameState>;
  nextEventId: string | ((state: GameState) => string);
  condition?: (state: GameState) => boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: Choice[];
}
