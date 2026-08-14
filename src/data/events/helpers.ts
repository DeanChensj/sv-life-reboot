import type { GameState } from '../../types';
import { safeStorage } from '../../utils/safeStorage';
import { STORAGE_KEYS, isOwnedHousing, VISA_STATUS, isPermanentVisa } from '../../constants/gameConstants';
import { gameRandom, gameRandomInt, gamePick, setGameSeed, getGameSeed } from '../../utils/random';

export { gameRandom, gameRandomInt, gamePick, setGameSeed, getGameSeed };

// Shared O1 (extraordinary-ability visa) approval probability, so every event that
// offers O1 uses the same odds keyed on the same predicate as its condition (was
// inconsistent: 0.30/0.35 non-PhD and 0.70/0.75 PhD across different events, and
// ai_research applicants got the low rate in some events but the high rate in others).
export const o1PassProb = (s: GameState): number =>
  (s.is_phd || s.job_type === 'ai_research' || s.leetcode >= 85) ? 0.72 : 0.32;

// Helper to scale job hunt TC based on candidate's existing engineering level (benchmarked to levels.fyi)
export const getLevelScaledTC = (baseL3TC: number, level?: string): number => {
  if (level === 'L8 (Principal)' || level === 'Principal' || level === 'Fellow') return Math.min(220, Math.floor(baseL3TC * 7.2));
  if (level === 'L7 (Senior Staff)' || level === 'Senior Staff' || level === 'L7') return Math.min(120, Math.floor(baseL3TC * 4.5));
  if (level === 'L6 (Staff)' || level === 'Staff' || level === 'MTS') return Math.min(78, Math.floor(baseL3TC * 3.1));
  if (level === 'L5 (Senior)' || level === 'L5') return Math.min(52, Math.floor(baseL3TC * 2.1));
  if (level === 'L4') return Math.min(34, Math.floor(baseL3TC * 1.4));
  if (level === 'Quant') return Math.min(85, Math.floor(baseL3TC * 1.5));
  return Math.min(24, baseL3TC); // L3 or new grad
};

export const generateInitialState = (customSeed?: number): GameState => {
  let savedSeed: { cash: number; charm: number; max_charm: number; luck: number; is_ssr_unlocked?: boolean; seed?: number } | null = null;

  try {
    const stored = safeStorage.getItem(STORAGE_KEYS.INITIAL_SEED);
    if (stored) savedSeed = JSON.parse(stored);
  } catch (e) {
    // Ignore storage errors
  }

  let luck: number, cash: number, charm: number, max_charm: number, is_ssr_unlocked: boolean, seed: number;

  if (savedSeed && customSeed === undefined) {
    luck = savedSeed.luck;
    cash = savedSeed.cash;
    charm = savedSeed.charm;
    max_charm = savedSeed.max_charm;
    is_ssr_unlocked = Boolean(savedSeed.is_ssr_unlocked);
    seed = typeof savedSeed.seed === 'number' ? savedSeed.seed : setGameSeed(Date.now());
    setGameSeed(seed);
  } else {
    seed = customSeed !== undefined
      ? setGameSeed(customSeed)
      : setGameSeed((Date.now() ^ (Math.floor(Math.random() * 2147483647))) >>> 0);

    // 8% random roll for SSR Native US Citizen trait on fresh new game initialization
    is_ssr_unlocked = gameRandom() < 0.08;

    // Generate new using PRNG
    const isRich = gameRandom() < 0.15; // 15% 概率富二代
    if (!isRich) {
      cash = gameRandomInt(8, 12); // 8 - 12 万美元 (中产家庭)
    } else {
      cash = gameRandomInt(25, 50); // 25 - 50 万美元 (富裕家庭)
    }
    charm = gameRandomInt(1, 10); // 颜值 1-10
    max_charm = Math.min(30, Math.max(15, charm + gameRandomInt(8, 14)));
    luck = gameRandomInt(0, 99);

    safeStorage.setItem(STORAGE_KEYS.INITIAL_SEED, JSON.stringify({ cash, charm, max_charm, luck, is_ssr_unlocked, seed }));
  }

  let bgMessage = '';
  // Rich roll produces cash 25-50, so the threshold must be 25, not 60 (which was
  // unreachable — every 富二代 was mislabeled a 小康/普通家庭).
  if (cash >= 25) bgMessage += '你出生在一个富裕的家庭，启动资金充足！';
  else if (cash < 15) bgMessage += '你出生在一个普通家庭，预算非常吃紧。';
  else bgMessage += '你出生在一个小康家庭。';

  if (charm >= 9) bgMessage += ' 顺便一提，你从小就长得像大明星，走到哪里都是焦点。';
  else if (charm <= 3) bgMessage += ' 长相平平无奇，是个实在人。';

  return {
    age: 18,
    cash,
    stocks: 0,
    health: 100,
    leetcode: 10,
    visa: '无',
    tc: 0,
    macro_economy: 'neutral',
    rent: 4,
    charm,
    max_charm,
    year: 2018, // 默认，会被第一步覆盖
    gc_progress: 0,
    has_us_degree: false,
    school: '',
    is_phd: false,
    has_pet: false,
    luck,
    network: 10,
    is_married: false,
    relationship_status: 'single',
    win_threshold: 500, // basic FIRE tier; choose_trait overwrites with the trait-specific goal
    laid_off: false,
    has_housing: false,
    housing_name: '国内老家',
    car: 'none',
    difficulty_title: '普通难度',
    is_ssr_unlocked,
    status: 'playing',
    npcs: {},
    story_flags: {},
    timeline: [],
    history_net_worth: [{ age: 18, year: 2018, netWorth: parseFloat(cash.toFixed(1)), cash: parseFloat(cash.toFixed(1)), stocks: 0 }],
    message: bgMessage,
    seed,
  };
};

// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Weaves in 1-2 random events before year-end settlement.
export const midYearEventRouter = (s: GameState): string => {
  const isWorking = Boolean(s.job_type && s.job_type !== 'unemployed' && !s.laid_off);
  const isBigTech = s.job_type === 'big_tech' || s.job_type === 'amazon' || s.job_type === 'tiktok' || s.job_type === 'nvidia';

  // --- 0. 优先消费长线因果剧情链 (Priority Narrative Arcs) ---
  // 1) Alex 博士剧情链：Series A 创业合伙人/天使邀请
  if (s.story_flags?.met_alex && !s.story_flags?.alex_startup_invited && isWorking && s.age >= 24 && s.year >= (Number(s.story_flags.alex_meet_year || 0) + 1)) {
    return 'alex_startup_series_a';
  }

  // 2) Alex 博士剧情链：OmniAgent 纳斯达克 IPO / 退出回报结算
  if ((s.story_flags?.joined_omniagent || s.story_flags?.angel_invest_omniagent) && !s.story_flags?.alex_ipo_done && s.year >= (Number(s.story_flags.omniagent_start_year || 0) + 3)) {
    return 'alex_omniagent_ipo_exit';
  }

  // 3) Dave 职场宿敌剧情链：掌握证据后的年度考核摊牌大反击
  if (s.story_flags?.has_dave_evidence && !s.story_flags?.dave_defeated && isWorking && s.year >= (Number(s.story_flags.dave_conflict_year || 0) + 1)) {
    return 'dave_retaliation_showdown';
  }

  // 4) Dave 职场宿敌剧情链：多年后的面试桌攻守易形逆转
  if (s.story_flags?.dave_defeated && !s.story_flags?.dave_veto_done && (s.level === 'L6 (Staff)' || s.level === 'L7 (Senior Staff)' || s.level === 'L8 (Principal)' || s.job_type === 'startup_founder') && s.year >= (Number(s.story_flags.dave_defeated_year || 0) + 2)) {
    return 'dave_interview_veto';
  }

  // 5) Sam 极客战友剧情链：Zero-Day 漏洞与黑客项目
  if (s.story_flags?.met_sam && !s.story_flags?.sam_zero_day_done && s.age >= 24 && s.leetcode >= 25 && gameRandom() < 0.35) {
    return 'sam_garage_zero_day';
  }

  // Economy News Broadcasts
  const shiftChance = (s.macro_economy === 'bull' || s.macro_economy === 'bear') ? 0.14 : 0.05;
  if (gameRandom() < shiftChance && !s.season_stage) {
    if (s.macro_economy === 'bull') {
      return gameRandom() < 0.6 ? 'news_neutral_market' : 'news_bear_market_crash';
    } else if (s.macro_economy === 'bear') {
      return gameRandom() < 0.6 ? 'news_neutral_market' : 'news_bull_market_start';
    } else {
      return gameRandom() < 0.5 ? 'news_bull_market_start' : 'news_bear_market_crash';
    }
  }

  // Stage H1 (Spring/Summer: Career & Major Work Events)
  if (s.season_stage === 'h1' || !s.season_stage) {
     if (s.job_type === 'trader') return 'trader_annual_strategy';
     if (s.job_type === 'startup_founder') return 'founder_annual_strategy';
     if (!isWorking) return 'job_hunt';
     if (s.job_type === 'startup') return 'startup_crisis';
     if (s.job_type === 'ai_research') return 'ai_research_crisis';
     if (s.job_type === 'quant') return 'quant_stress';

     const isCorporate = isWorking;

     const workEvents = ['perf_review', 'layoff_rumor', 'rto_wars', 'llm_datacenter_power_outage', 'meta_reorg_manager_left', 'agent_hallucination_prod_disaster'];
     
     // Meta 专属 Tech Lead Manager 卷王挑战
     if (s.company === 'meta') {
       workEvents.push('meta_tlm');
     }

     // Apple 专属 Vision Pro / 空间计算应用开发
     if (s.company === 'apple') {
       workEvents.push('apple_vision_pro_demo');
     }
     
     // 公司专属 PIP 概率区分：亚麻与 Meta 具有高强度末位淘汰 / PIP 指标，皮衣黄 Nvidia 及 Google / Apple 的 PIP 概率极低
     const isHighPipCompany = s.job_type === 'amazon' || s.company === 'amazon' || s.company === 'meta';
     const isLowPipCompany = s.job_type === 'nvidia' || s.company === 'nvidia' || s.company === 'google' || s.company === 'apple';

     if (isHighPipCompany) {
       workEvents.push('friday_pip', 'friday_pip', 'friday_pip', 'layoff_rumor');
     } else if (isLowPipCompany) {
       if (gameRandom() < 0.15) workEvents.push('friday_pip');
     } else {
       workEvents.push('friday_pip');
     }

     if (s.macro_economy === 'bear' && gameRandom() < 0.25) workEvents.push('stock_crash');
     if (s.difficulty_title === '困难难度') workEvents.push('friday_pip', 'layoff_rumor');
     if (s.difficulty_title === '简单难度') workEvents.push('perf_review');
     if ((s.company === 'nvidia' || s.job_type === 'nvidia' || (s.stocks || 0) >= 5) && s.year >= 2023 && gameRandom() < 0.35) {
       workEvents.push('nvidia_stock_surge');
     }
     if (s.year >= 2024 && isCorporate && gameRandom() < 0.25) workEvents.push('ai_disruption_existential');
     if (isCorporate && gameRandom() < 0.25) workEvents.push('influencer_vp_drama');
     if (isCorporate && (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') && gameRandom() < 0.35) workEvents.push('high_level_reorg_domain_loss', 'midlife_management_pivot');
     if (s.visa === 'H1B (工签)' && !s.is_married && s.relationship_status !== 'married') workEvents.push('h1b_rfe_vs_parent_nag');
     if (isCorporate) {
       workEvents.push('friday_p0_outage_crisis', 'empty_promotion_promise', 'multi_timezone_calendar_hell');
     }

     return gamePick(workEvents);
  }

  // Stage H2 (Autumn/Winter: Life, Social, Travel & Lifestyle Events)
  const isCorporate = isWorking && s.job_type !== 'trader' && s.job_type !== 'startup_founder';
  const isFounder = s.job_type === 'startup_founder';
  const isTrader = s.job_type === 'trader';

  const lifeEvents = [
    'pickleball_networking', 'dental_emergency', 'crypto_scam', 
    'boba_inflation', 'xhs_boba', 'biohacking_party', 'tahoe_ski_blizzard', 
    'burning_man_invite', 'rock_climbing_event', 'tennis_networking', 'bay_area_hiking', 'hawaii_vacation', 'bay_area_pop_concert',
    'credit_card_churning', 'napa_wine_tasting', 'costco_gold_bar_frenzy', 'palo_alto_stanford_lecture', 'mac_mini_open_claw_server', 'multi_agent_side_hustle', 'fashion_disaster_hoodie', 'linkedin_cold_outreach_spam',
    'hair_loss_and_slouch', 'social_withdrawal_burnout', 'parents_us_visit', 'boba_opening_frenzy',
    'brentwood_cherry_picking', 'cancun_all_inclusive', 'patagonia_vest_hoodie_uniform', 'costco_weekend_pilgrimage'
  ];

  if (s.charm && s.charm >= 15 && s.job_type !== 'unemployed') {
    lifeEvents.push('rednote_influencer_side_hustle');
  }

  if ((s.charm || 0) >= 22 && !s.is_married && s.relationship_status !== 'married' && s.relationship_status !== 'dating') {
    lifeEvents.push('bay_area_heart_signal');
    if ((s.charm || 0) >= 25) {
      lifeEvents.push('bay_area_heart_signal');
    }
  }

  if (s.car && s.car !== 'none') {
    lifeEvents.push('san_francisco_car_window_smash');
  }

  if (s.car === 'model_y' || s.car === 'cybertruck') {
      lifeEvents.push('tesla_fsd_unsupervised_scare');
  }

  if (isCorporate) {
      lifeEvents.push('overemployed', 'blind_team_tea', 'zoom_camera_off_leetcode', 'team_offsite', 'vibe_coding_craze', 'ai_wrapper_startup', 'ai_agent_startup');
      if (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') {
          lifeEvents.push('ex_1point3acres_expose');
      }
      if (gameRandom() < 0.20) {
        return 'team_offsite';
      }
  }

  if (isFounder) {
      lifeEvents.push(
        'founder_co_founder_drama',
        'founder_vc_term_sheet_ghost',
        'founder_runway_cash_crunch',
        'founder_hacker_house_hackathon'
      );
  }

  if (isTrader) {
      lifeEvents.push(
        'trader_fed_rate_cpi_night',
        'trader_wallstreetbets_short_squeeze',
        'trader_bloomberg_terminal_caffeine'
      );
  }

  if (!s.is_married) {
      lifeEvents.push('ex_wedding_invite');
  }
  
  if (s.relationship_status === 'dating' || s.is_married) {
      lifeEvents.push('ikea_furniture_fight');
  }
  
  if (isBigTech) {
      lifeEvents.push('rsu_vesting_crash');
  }

  if (isPermanentVisa(s.visa) && gameRandom() < 0.25) {
    return 'japan_trip';
  }

  if (s.visa === 'H1B (工签)' && gameRandom() < 0.18) {
    return 'h1b_visa_stamping_crisis';
  }

  if ((s.car === 'porsche' || s.car === 'cybertruck') && gameRandom() < 0.25) {
    return 'luxury_car_meet';
  }

  const isHomeowner = isOwnedHousing(s.housing_name);
  if (isHomeowner && gameRandom() < 0.25) {
    return 'house_warming_party';
  }

  if (s.cash >= 100 && gameRandom() < 0.25) {
    return 'startup_angel_investing';
  }

  if ((s.is_married || s.relationship_status === 'married') && gameRandom() < 0.25) {
    return 'bay_area_dink_vs_kids';
  }

  if (isHomeowner && s.cash >= 30 && gameRandom() < 0.25) {
    return 'property_supplemental_tax_hike';
  }

  if ((s.car === 'porsche' || s.car === 'cybertruck') && gameRandom() < 0.25) {
    return 'luxury_car_vandalism_towing';
  }

  if ((s.cash >= 80 || s.tc >= 45) && gameRandom() < 0.25) {
    return 'irs_tax_audit_crisis';
  }

  if (isHomeowner && s.age >= 32 && gameRandom() < 0.25) {
    return 'property_hoa_special_assessment';
  }

  if (isWorking && s.age >= 35 && s.health <= 60 && gameRandom() < 0.30) {
    return 'health_burnout_warning';
  }

  if (!isPermanentVisa(s.visa) && s.visa !== '无') {
      lifeEvents.push('visa_check');
  }

  if (s.is_married || s.relationship_status === 'married' || s.relationship_status === 'dating') {
      lifeEvents.push('breakup_crisis');
  } else {
      lifeEvents.push('boardgame_dating');
  }

  if (!s.is_married && s.relationship_status !== 'married' && gameRandom() < 0.25) {
      return 'dating_market';
  }

  if (s.car && s.car !== 'none' && gameRandom() < 0.25) return 'car_broken';
  
  return gamePick(lifeEvents) || 'sv_year_end_settlement';
};

// H1 to H2 Event Router: called after resolving an H1 career/work event to transition to an H2 life/social event
export const h1ToH2Router = (s: GameState): string => {
  if (s.laid_off) {
    return (!isPermanentVisa(s.visa) && s.visa !== '无') ? 'layoff_hit' : 'job_hunt';
  }
  if (s.job_type === 'unemployed' && (!isPermanentVisa(s.visa) && s.visa !== '无')) {
    return 'layoff_hit';
  }
  return midYearEventRouter({ ...s, season_stage: 'h2' });
};

// Dynamic Annual Opportunities Pool & Rotation System
export const ANNUAL_OPPORTUNITY_KEYS = [
  'opp_cursor_hunt',
  'opp_treehacks',
  'opp_pilot_license',
  'opp_burning_man',
  'opp_sand_hill_salon',
  'opp_gtc_nvidia',
  'opp_zero_day_bounty',
  'opp_viral_ai_video',
  'opp_foreclosure_deal',
  'opp_yosemite_heal',
  'opp_angel_invest',
  'opp_laguna_seca',
] as const;

export function isOpportunityActiveThisYear(s: GameState, oppKey: string): boolean {
  const primaryIdx = Math.abs(((s.year || 2026) * 5 + (s.age || 25) * 2) % ANNUAL_OPPORTUNITY_KEYS.length);
  const secondaryIdx = (primaryIdx + 5) % ANNUAL_OPPORTUNITY_KEYS.length;

  return oppKey === ANNUAL_OPPORTUNITY_KEYS[primaryIdx] ||
         oppKey === ANNUAL_OPPORTUNITY_KEYS[secondaryIdx];
}

// Checks if the player is still living in a temporary student dorm, lab, overseas home, or ICC bunk
export const isTemporaryOrStudentHousing = (s: GameState): boolean => {
  if (!s.has_housing || !s.housing_name) return true;
  const tempDorms = [
    '四大 校内宿舍',
    '大U 校内宿舍',
    '美大U 校内宿舍',
    '美硕 校外公寓',
    '美国 博士实验室',
    '国内大学宿舍',
    '国内老家',
    '国内 厂区单间',
    '加州湾区老宅',
    'ICC 挂靠合宿单间',
    'ICC 外包合宿单间'
  ];
  return tempDorms.includes(s.housing_name);
};
