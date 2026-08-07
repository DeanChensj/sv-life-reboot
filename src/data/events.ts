import type { GameState, GameEvent } from '../types';
import { safeStorage } from '../utils/safeStorage';

// Initial State

// Helper to scale job hunt TC based on candidate's existing engineering level
const getLevelScaledTC = (baseTC: number, level?: string): number => {
  if (level === 'L8 (Principal)' || level === 'Principal' || level === 'Fellow') return Math.floor(baseTC * 3.6);
  if (level === 'L7 (Senior Staff)' || level === 'Senior Staff' || level === 'L7') return Math.floor(baseTC * 2.7);
  if (level === 'L6 (Staff)' || level === 'Staff' || level === 'MTS') return Math.floor(baseTC * 2.0);
  if (level === 'L5 (Senior)' || level === 'L5') return Math.floor(baseTC * 1.55);
  if (level === 'L4') return Math.floor(baseTC * 1.25);
  if (level === 'Quant') return Math.floor(baseTC * 1.8);
  return baseTC; // L3 or new grad
};

export const generateInitialState = (): GameState => {
  let savedSeed: { cash: number; charm: number; max_charm: number; luck: number; is_ssr_unlocked?: boolean } | null = null;

  try {
    const stored = safeStorage.getItem('sv_life_initial_seed');
    if (stored) savedSeed = JSON.parse(stored);
  } catch (e) {
    // Ignore storage errors
  }

  let luck: number, cash: number, charm: number, max_charm: number, is_ssr_unlocked: boolean;

  if (savedSeed) {
    luck = savedSeed.luck;
    cash = savedSeed.cash;
    charm = savedSeed.charm;
    max_charm = savedSeed.max_charm;
    is_ssr_unlocked = !!savedSeed.is_ssr_unlocked;
  } else {
    // 8% random roll for SSR Native US Citizen trait on fresh new game initialization
    is_ssr_unlocked = Math.random() < 0.08;

    // Generate new if no seed
    const isRich = Math.random() < 0.15; // 15% 概率富二代
    if (!isRich) {
      cash = Math.floor(Math.random() * 5) + 8; // 8 - 12 万美元 (中产家庭)
    } else {
      cash = Math.floor(Math.random() * 25) + 25; // 25 - 50 万美元 (富裕家庭)
    }
    charm = Math.floor(Math.random() * 10) + 1; // 颜值 1-10
    max_charm = Math.min(30, Math.max(15, charm + Math.floor(Math.random() * 6) + 8));
    luck = Math.floor(Math.random() * 100);

    safeStorage.setItem('sv_life_initial_seed', JSON.stringify({ cash, charm, max_charm, luck, is_ssr_unlocked }));
  }

  const ap = 3;
  
  let bgMessage = '';
  if (cash > 60) bgMessage += '你出生在一个富裕的家庭，启动资金充足！';
  else if (cash < 20) bgMessage += '你出生在一个普通家庭，预算非常吃紧。';
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
    win_threshold: 1000,
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
    message: bgMessage
  };
};

// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Weaves in 1-2 random events before year-end settlement.
// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Weaves in 1-2 random events before year-end settlement.
export const midYearEventRouter = (s: GameState): string => {
  const isWorking = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
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
  if (s.story_flags?.met_sam && !s.story_flags?.sam_zero_day_done && s.age >= 24 && s.leetcode >= 25 && Math.random() < 0.35) {
    return 'sam_garage_zero_day';
  }

  // Economy News Broadcasts
  const shiftChance = (s.macro_economy === 'bull' || s.macro_economy === 'bear') ? 0.14 : 0.05;
  if (Math.random() < shiftChance && !s.season_stage) {
    if (s.macro_economy === 'bull') {
      return Math.random() < 0.6 ? 'news_neutral_market' : 'news_bear_market_crash';
    } else if (s.macro_economy === 'bear') {
      return Math.random() < 0.6 ? 'news_neutral_market' : 'news_bull_market_start';
    } else {
      return Math.random() < 0.5 ? 'news_bull_market_start' : 'news_bear_market_crash';
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
       if (Math.random() < 0.15) workEvents.push('friday_pip');
     } else {
       workEvents.push('friday_pip');
     }

     if (s.macro_economy === 'bear' && Math.random() < 0.25) workEvents.push('stock_crash');
     if (s.difficulty_title === '困难难度') workEvents.push('friday_pip', 'layoff_rumor');
     if (s.difficulty_title === '简单难度') workEvents.push('perf_review');
     if ((s.company === 'nvidia' || s.job_type === 'nvidia' || (s.stocks || 0) >= 5) && s.year >= 2023 && Math.random() < 0.35) {
       workEvents.push('nvidia_stock_surge');
     }
     if (s.year >= 2024 && isWorking && Math.random() < 0.25) workEvents.push('ai_disruption_existential');
     if (isWorking && Math.random() < 0.25) workEvents.push('influencer_vp_drama');
     if (isWorking && (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') && Math.random() < 0.35) workEvents.push('high_level_reorg_domain_loss', 'midlife_management_pivot');
     if (s.visa === 'H1B (工签)' && !s.is_married && s.relationship_status !== 'married') workEvents.push('h1b_rfe_vs_parent_nag');

     return workEvents[Math.floor(Math.random() * workEvents.length)];
  }

  // Stage H2 (Autumn/Winter: Life, Social, Travel & Lifestyle Events)
  const lifeEvents = [
    'pickleball_networking', 'dental_emergency', 'crypto_scam', 
    'boba_inflation', 'xhs_boba', 'ai_wrapper_startup', 'biohacking_party', 'tahoe_ski_blizzard', 
    'burning_man_invite', 'rock_climbing_event', 'tennis_networking', 'bay_area_hiking', 'hawaii_vacation', 'bay_area_pop_concert',
    'credit_card_churning', 'vibe_coding_craze', 'ai_agent_startup', 'napa_wine_tasting', 'costco_gold_bar_frenzy', 'palo_alto_stanford_lecture', 'mac_mini_open_claw_server', 'multi_agent_side_hustle', 'fashion_disaster_hoodie', 'linkedin_cold_outreach_spam',
    'hair_loss_and_slouch', 'social_withdrawal_burnout', 'parents_us_visit', 'boba_opening_frenzy'
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

  if (isWorking) {
      lifeEvents.push('overemployed', 'blind_team_tea', 'zoom_camera_off_leetcode', 'team_offsite');
      if (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') {
          lifeEvents.push('ex_1point3acres_expose');
      }
  }

  if (isWorking && Math.random() < 0.20) {
    return 'team_offsite';
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

  if ((s.visa === '绿卡' || s.visa === '公民') && Math.random() < 0.25) {
    return 'japan_trip';
  }

  if (s.visa === 'H1B (工签)' && Math.random() < 0.18) {
    return 'h1b_visa_stamping_crisis';
  }

  if ((s.car === 'porsche' || s.car === 'cybertruck') && Math.random() < 0.25) {
    return 'luxury_car_meet';
  }

  const isHomeowner = s.has_housing && !!s.housing_name && ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(s.housing_name);
  if (s.has_housing && Math.random() < 0.25) {
    return 'house_warming_party';
  }

  if (s.cash >= 100 && Math.random() < 0.25) {
    return 'startup_angel_investing';
  }

  if ((s.is_married || s.relationship_status === 'married') && Math.random() < 0.25) {
    return 'bay_area_dink_vs_kids';
  }

  if (isHomeowner && s.cash >= 30 && Math.random() < 0.25) {
    return 'property_supplemental_tax_hike';
  }

  if ((s.car === 'porsche' || s.car === 'cybertruck') && Math.random() < 0.25) {
    return 'luxury_car_vandalism_towing';
  }

  if ((s.cash >= 80 || s.tc >= 45) && Math.random() < 0.25) {
    return 'irs_tax_audit_crisis';
  }

  if (isHomeowner && s.age >= 32 && Math.random() < 0.25) {
    return 'property_hoa_special_assessment';
  }

  if (isWorking && s.age >= 35 && s.health <= 60 && Math.random() < 0.30) {
    return 'health_burnout_warning';
  }

  if (s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') {
      lifeEvents.push('visa_check');
  }

  if (s.is_married || s.relationship_status === 'married' || s.relationship_status === 'dating') {
      lifeEvents.push('breakup_crisis');
  } else {
      lifeEvents.push('boardgame_dating');
  }

  if (!s.is_married && s.relationship_status !== 'married' && Math.random() < 0.25) {
      return 'dating_market';
  }

  if (s.car && s.car !== 'none' && Math.random() < 0.25) return 'car_broken';
  
  return lifeEvents[Math.floor(Math.random() * lifeEvents.length)] || 'sv_year_end_settlement';
};

// H1 to H2 Event Router: called after resolving an H1 career/work event to transition to an H2 life/social event
export const h1ToH2Router = (s: GameState): string => {
  if (s.laid_off || s.job_type === 'unemployed') {
    return (s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') ? 'layoff_hit' : 'job_hunt';
  }
  return midYearEventRouter({ ...s, season_stage: 'h2' });
};

// Events Engine
export const events: Record<string, GameEvent> = {

  'choose_trait': {
    id: 'choose_trait',
    title: '重新投胎 (选择天赋)',
    description: '在转生到硅谷之前，上帝给了你一次选择天赋的机会。每个天赋都有独特的加成，也伴随着相应的代价。',
    choices: [
      {
        text: '【隐藏款 SSR·原生美籍】湾区二代，生在终点线！持有美国护照，自带 $15w 留学专款，终身免除 H1B 抽签与 PERM 排期。',
        reqBadge: '8% 概率开局刷出',
        hideIfUnavailable: true,
        condition: (s) => !!s.is_ssr_unlocked,
        effect: (s) => ({
          trait_title: '原生美籍',
          visa: '公民',
          gc_progress: 5,
          gc_stage: 'approved',
          cash: Math.max(15, (s.cash || 0)),
          network: 25,
          charm: Math.min((s.max_charm || 25), s.charm + 6),
          win_threshold: 400,
          housing_name: '加州湾区老宅'
        }),
        nextEventId: 'choose_year',
      },
      {
        text: '【卷王之王】天生做题家，算法天赋极高，拥有极强的抗压耐受力，大厂内卷与跳槽如鱼得水。',
        effect: (s) => ({ trait_title: '卷王之王', leetcode: s.leetcode + 35, health: Math.max(90, s.health - 8), network: 15, win_threshold: 380 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【湾区海王】精通高端局社交，人脉广且极善拿捏人心，但社交开销高昂且不善算法。',
        effect: (s) => ({ trait_title: '湾区海王', max_charm: (s.max_charm || 25) + 5, charm: Math.min((s.max_charm || 25) + 5, s.charm + 8), network: 20, cash: Math.max(0.5, s.cash - 1.5), leetcode: Math.max(0, s.leetcode - 10), win_threshold: 400 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【家里有矿】家里直接在湾区给你准备了买房首付，人脉背景深厚。',
        effect: (s) => ({ trait_title: '家里有矿', cash: s.cash + 70, network: 25, leetcode: Math.max(0, s.leetcode - 15), health: s.health - 15, win_threshold: 450 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【天选之子】玄学护体，总能在关键时刻化险为夷，气运爆发。',
        effect: (s) => ({ trait_title: '天选之子', luck: Math.min(99, Math.max(s.luck + 18, 52)), network: 20, leetcode: s.leetcode + 8, charm: s.charm + 5, win_threshold: 400 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【小镇做题家】毫无波澜的普通面板，纯凭实力打拼。',
        effect: (s) => ({ trait_title: '小镇做题家', network: 10, win_threshold: 360 }),
        nextEventId: 'choose_year',
      }
    ]
  },
  'choose_year': {
    id: 'choose_year',
    title: '选择游戏难度',
    description: '宏观周期决定了个人命运。请选择你的游戏难度：',
    choices: [
      {
        text: '【简单难度 (宽松周期)】硅谷黄金时代，Headcount 充沛，升职加薪顺水推舟。',
        effect: (_s) => ({ year: 2014, difficulty_title: '简单难度', luck: (_s.luck || 20) + 10 }),
        nextEventId: 'choose_school',
      },
      {
        text: '【普通难度 (周期交替)】经历经济周期起伏，放水狂欢与裁员潮交替 (标准体验)。',
        effect: (_s) => ({ year: 2018, difficulty_title: '普通难度' }),
        nextEventId: 'choose_school',
      },
      {
        text: '【困难难度 (地狱 AI 狂潮)】AI 颠覆性内卷，大厂 HC 极度锁死，职场高压挑战！',
        effect: (_s) => ({ year: 2019, difficulty_title: '困难难度' }),
        nextEventId: 'choose_school',
      }
    ]
  },
  'choose_school': {
    id: 'choose_school',
    title: '第一步：人生十字路口',
    description: '恭喜你高中毕业！拿着家里的启动资金，你现在面临择校 Choice 的选择：',
    choices: [
      {
        text: '北美CS四大 (Stanford/MIT/CMU/UCB) (四年总开销 30 万美元)',
        condition: (s) => s.cash >= 30,
        effect: (s) => ({ cash: Math.max(0, s.cash - 30), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'cmu', age: s.age, leetcode: s.leetcode + 5, health: Math.max(0, s.health - 5), housing_name: '四大 校内宿舍', message: '你步入了世界计算机最高学府。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '理工强校大U (如 UIUC/UW/UMich) (四年总开销 25 万美元)',
        condition: (s) => s.cash >= 25,
        effect: (s) => ({ cash: Math.max(0, s.cash - 25), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age, leetcode: s.leetcode + 5, housing_name: '大U 校内宿舍', message: '你来到了全美顶尖理工强校，准备体验硬核课业。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '美国普通公立大学 (四年总开销 15 万美元, 美籍/绿卡含州内补贴只需 5 万)',
        condition: (s) => s.cash >= ((s.visa === '公民' || s.visa === '绿卡') ? 5 : 15),
        effect: (s) => {
          const cost = (s.visa === '公民' || s.visa === '绿卡') ? 5 : 15;
          return { cash: Math.max(0, s.cash - cost), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'state', age: s.age, charm: s.charm + 2, housing_name: '美大U 校内宿舍', message: '你飞往美国，准备开启无忧无虑的本科生活。' };
        },
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '在国内读本科 / 中外合办大学 (四年总开销 2 万美元)',
        effect: (s) => ({ cash: Math.max(0, s.cash - 2), housing_name: '国内大学宿舍' }),
        nextEventId: 'cn_college_grad',
      }
    ]
  },
  'cn_college_grad': {
    id: 'cn_college_grad',
    title: '大学前期：百团大战与多维探索',
    description: '进入了国内大学，开学百团大战，各种社团、比赛与创业社招新。你打算如何安排这最初的两年？',
    choices: [
      {
        text: '【ACM 算法集训】加入 ACM 集训队 (死磕算法与硬核代码)',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 15, age: s.age + 2, message: '天天在机房死磕图论与动态规划，算法能力大幅提升！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【金融创投比赛】参加全国大学生商业创投挑战赛',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 6), luck: Math.min(99, s.luck + 4), age: s.age + 2, message: '商业计划书打动了校外评委，拿到了创业鼓励金与名企实习推荐！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【文娱自媒体】担任社团主唱 / 运营大学生活 VLOG',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), cash: s.cash + 0.8, health: Math.min(100, s.health + 5), age: s.age + 2, message: '你的网游/校园 VLOG 在 B站和小红书小火，涨粉数千并吸引了不少粉丝打赏！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【学生会外联】加入学生会与外联部 (锻炼人际社交与组织能力)',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: s.health - 5, age: s.age + 2, message: '你在学生会拉赞助混得风生水起，结识了一圈活跃朋友。两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【大厂暑期实习】抢先投递并斩获国内一线互联网大厂实习',
        effect: (s) => ({ cash: s.cash + 2, leetcode: s.leetcode + 8, health: s.health - 8, age: s.age + 2, message: '在厂里体验了硬核工程落地，提前积累了实战经验。两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      }
    ]
  },

  // 陆本随机校园事件
  'cn_dorm_game': {
    id: 'cn_dorm_game',
    title: '【校园突发】寝室通宵开黑与辅导员突查',
    description: '大二下学期，寝室四人组通宵开黑打游戏正酣，突然门外响起了辅导员查寝的敲门声！',
    choices: [
      {
        text: '迅速关灯藏起电脑，假装在背四六级单词',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '无惊无险！辅导员夸赞你们宿舍学习氛围浓厚，安然度过查寝！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '硬刚：“我们这是在做计算机图形学与网络抓包实训！”',
        effect: (s) => {
          const pass = s.leetcode >= 20 || Math.random() < 0.5;
          return pass
            ? { charm: Math.min(25, s.charm + 4), message: '你的专业术语把辅导员说蒙了，居然逃过一劫还顺手完成了抓包实验！' }
            : { health: s.health - 10, message: '辅导员根本不信你的鬼话，寝室被通报批评，扣除当月奖学金评定资格。' };
        },
        nextEventId: 'cn_college_year3',
      }
    ]
  },
  'cn_acm_contest': {
    id: 'cn_acm_contest',
    title: '【校园突发】ACM 区域赛遭遇死锁 Bug',
    description: '代表学校参加程序设计竞赛，比赛倒计时 15 分钟，核心题目评测机突然返回 TLE！同队的算法怪才 Sam 正满头大汗狂敲键盘！',
    choices: [
      {
        text: '冷静打印 Code，用笔手写推导复杂度 (与 Sam 并肩死磕)',
        effect: (s) => ({
          leetcode: s.leetcode + 8,
          npcs: {
            ...(s.npcs || {}),
            sam: { name: '极客 Sam', role: 'co_founder', affinity: 90, status: 'ally', note: '硬核黑客与全栈极客，ACM 战友' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            met_sam: true
          },
          message: '你抓出了隐藏的 $O(N^2)$ 死循环！修改后封榜前压线 AC，拿到了银牌！Sam 拍着你肩膀说：“哥们，以后一起搞大项目！”'
        }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '狂换算法！重写线段树数据结构',
        effect: (s) => {
          const win = Math.random() < 0.45 + (s.leetcode / 200);
          return win
            ? {
                leetcode: s.leetcode + 12,
                cash: s.cash + 0.5,
                npcs: {
                  ...(s.npcs || {}),
                  sam: { name: '极客 Sam', role: 'co_founder', affinity: 95, status: 'ally', note: '硬核黑客与全栈极客，ACM 战友' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  met_sam: true
                },
                message: '【逆天改命】最后一分钟提交绿色 Accepted！全队欢呼，拿下了比赛奖金！Sam 视你为生死战友！'
              }
            : { health: s.health - 10, message: '心态太急写出了越界段错误 (SIGSEGV)，遗憾与奖牌失之交臂。' };
        },
        nextEventId: 'cn_college_year3',
      }
    ]
  },
  'cn_business_competition': {
    id: 'cn_business_competition',
    title: '【校园突发】“挑战杯”创投大赛终极答辩',
    description: '作为创投项目负责人，你在“挑战杯”全国决赛答辩环节面对 VC 评委对商业变现路径的犀利连环追问！',
    choices: [
      {
        text: '用详实的财报模型与用户 LTV 数据沉着应对',
        effect: (s) => ({ cash: s.cash + 1.2, charm: Math.min(25, s.charm + 6), message: ' 斩获金奖！评委大赞你的商业逻辑极具实战价值，当场颁发了 $1.2w 比赛项目奖金！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '临场发挥讲述情怀故事，拉满现场演讲感染力',
        effect: (s) => ({ charm: Math.min(25, s.charm + 5), luck: Math.min(99, s.luck + 5), message: '全场响起热烈掌声！拿下了最佳台风奖，并在场外结识了多位投资界大咖！' }),
        nextEventId: 'cn_college_year3',
      }
    ]
  },
  'cn_campus_romance': {
    id: 'cn_campus_romance',
    title: '【校园突发】图书馆占座与偶遇甜妹/帅哥',
    description: '期末考试周，你在图书馆帮隔壁桌同系学妹/学长解答了一道高数难题，对方微笑着递给你一杯冰拿铁...',
    choices: [
      {
        text: '顺水推舟互加微信，约对方周末去逛街看电影',
        effect: (s) => ({ charm: Math.min(25, s.charm + 6), health: Math.min(100, s.health + 10), relationship_status: 'dating', message: '极速脱单！你们聊得无比投机，顺理成章确立了热恋关系 (Dating)！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '高冷解答：“这道题用拉格朗日中值定理即可，不必客气”',
        effect: (s) => ({ leetcode: s.leetcode + 5, charm: Math.min(25, s.charm + 2), message: '你保持了高冷做题家的尊严！虽然错过了恋爱，但对方直呼你是“解题考霸”！' }),
        nextEventId: 'cn_college_year3',
      }
    ]
  },

  'cn_college_year3': {
    id: 'cn_college_year3',
    title: '大三抉择：保研、秋招与留学',
    description: '大三了，周围人都在考研、秋招、准备出国或直接创业。你的室友托福连挂三次，气氛格外紧张。',
    choices: [
      {
        text: '【出国留学备战】报班死磕托福/GRE (准备申请美国 CS 硕士)',
        effect: (s) => ({ cash: Math.max(0, s.cash - 2), health: s.health - 10, age: s.age + 2, message: '付出了巨大汗水，终于考出了满意的托福/GRE 分数，顺利完成大三大四学业！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【提前批次秋招】冲击国内大厂提前批开发岗 Offer',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 10, age: s.age + 2, message: '凭着扎实的算法手撕，提前斩获了国内大厂的 SSP 保底 Offer！顺利从本科毕业！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【金融咨询实习】投递顶级外企咨询与券商行研实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(25, s.charm + 6), health: s.health - 8, age: s.age + 2, message: '获得了极佳的金融行研锻炼，简历含金量大增！顺利从本科毕业！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【佛系寝室养生】佛系对待学业，每天在寝室打黑神话悟空',
        effect: (s) => ({ health: Math.min(100, s.health + 10), leetcode: Math.max(0, s.leetcode - 5), age: s.age + 2, message: '虽然精神很愉悦，放慢了备战脚步，但最终还是顺利混到了本科毕业！' }),
        nextEventId: 'cn_undergrad_grad',
      }
    ]
  },
  'us_undergrad_grad': {
    id: 'us_undergrad_grad',
    title: '走出象牙塔：何去何从',
    description: '四年过去了，你顺利从美国大学毕业，目前持有 OPT。现在是找工作还是继续深造？',
    imageUrl: 'images/stanford_graduation.jpg',
    choices: [
      {
        text: '申请北美顶尖 PhD (录取率低, 需 LeetCode >= 50)',
        condition: (s) => s.leetcode >= 50,
        effect: (s) => {
          const pass = Math.random() < (0.20 + (s.school === 'cmu' ? 0.20 : 0) + (s.leetcode >= 80 ? 0.15 : 0));
          return pass 
            ? { cash: s.cash + 2, age: s.age + 1, is_phd: true, housing_name: '美国 博士实验室', message: '大喜讯！你战胜了数千名申请者，斩获北美顶级 CS 全奖 PhD Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, message: '今年 CS 顶校 PhD 全奖录取率极低，你的推荐信被审稿人刷了，惨遭拒信。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'job_hunt',
      },

      {
        text: '直接找工作 (开始受苦)',
        effect: (s) => s.year === 2020 
          ? { message: '疫情爆发！各大公司全面冻结招聘，应届生找工作异常艰难！你被迫留在学校延长毕业一年。', health: s.health - 10, year: s.year + 1, age: s.age + 1 }
          : { visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', leetcode: s.leetcode + 10, message: '你开始了漫漫求职路...' },
        nextEventId: (s) => s.visa === 'F1 (学生)' ? 'us_undergrad_grad' : 'job_hunt',
      },
      {
        text: '申请大U硕士 (刷题进厂预备役 / 避避风头)',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({ cash: s.cash - 10, age: s.age, message: '你决定去读个硕士提升一下学历。' }),
        nextEventId: 'us_master_year1',
      }
    ]
  },
  'cn_undergrad_grad': {
    id: 'cn_undergrad_grad',
    title: '走出象牙塔：何去何从',
    description: '四年过去了，你在国内大学打下了坚实的代码基础。接下来去哪里？',
    choices: [
      {
        text: '全奖直博美国 (录取率地狱级, 需 LeetCode >= 50)',
        condition: (s) => s.leetcode >= 50,
        effect: (s) => {
          const pass = Math.random() < (0.18 + (s.leetcode >= 80 ? 0.20 : 0));
          return pass
            ? { cash: s.cash + 2, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', age: s.age + 1, is_phd: true, housing_name: '美国 博士实验室', message: '奇迹！凭着陆本顶尖算法功底，你跨海斩获了美国 CS 全奖直博 Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, message: '美国顶尖博士项目全墨！因为没有美本强推被卡，只能转投国内大厂或申请水硕。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'cn_work',
      },

      {
        text: '申请美国 CS 硕士 (自筹资金 / 积蓄 $5w 即可申请)',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({ cash: s.cash - 5, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', school: 'state', has_us_degree: true, age: s.age, is_master: true, housing_name: '美硕 校外公寓' }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '申请美国 CS 硕士 (无抵押留学贷款 + 校内 TA 助教，需评估算法/背景)',
        reqBadge: '需算法/GPA评估',
        effect: (s) => {
          const loanPass = (s.leetcode >= 18) || (Math.random() < 0.40 + (s.luck / 200));
          if (loanPass) {
            return { 
              cash: Math.max(0, s.cash - 2), 
              visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', 
              school: 'state',
              has_us_degree: true,
              age: s.age, 
              is_master: true,
              housing_name: '美硕 校外公寓', 
              message: ' 申请成功！凭借扎实的本科算法基础与良好的背景，你成功获得了无抵押留学贷款与校内 TA 助教资格！' 
            };
          } else {
            return { 
              health: s.health - 10, 
              message: ' 申请被拒！银行与校方审核认为你的本科 GPA/算法基础不足，无抵押贷款被驳回！你只能选择在国内打工攒钱或自筹资金。' 
            };
          }
        },
        nextEventId: (s: GameState) => (s.message || '').includes('申请成功') ? 'us_master_year1' : 'cn_undergrad_grad',
      },
      {
        text: '在国内大厂打工攒钱 (积累工作经验)',
        effect: (s) => ({
          cash: s.cash + 8,
          health: Math.max(30, s.health - 12),
          tc: 8,
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '国内研发',
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '无',
          laid_off: false,
          age: s.age + 1,
          housing_name: '国内 厂区单间',
          message: '你入职了国内一线互联网大厂，开启了打工攒钱与积累硬核算法经验的职场生涯。'
        }),
        nextEventId: 'cn_work',
      }
    ]
  },
  'us_undergrad_year1': {
    id: 'us_undergrad_year1',
    title: '初入北美：文化冲击与多元探索',
    description: '刚来北美，你对一切都很新奇。你决定怎么度过最初的两年？',
    choices: [
      {
        text: '【硬核刷题】泡在图书馆死磕 GPA 和算法',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 5, age: s.age + 2, message: '每天和电脑作伴，代码实力突飞猛进！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【量化金融】加入校内量化/学生投资俱乐部 (Quant & Trading Club)',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 5), health: s.health - 3, age: s.age + 2, message: '在模拟盘实盘操作中大获全胜，赚到了第一笔金融交易收益！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【竞技体育】加入校队竞技体育 (网球/抱石/橄榄球)',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(25, s.charm + 5), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '高强度体育训练拉满！体能与气场全面大爆发！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【文娱社团】组建校园摇滚乐队举办草坪音乐节',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: Math.min(100, s.health + 5), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '你在音乐节上作为主唱震撼全场，成为了校园里的风云人物！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【兄弟会社交】加入兄弟会/姐妹会 (Frat Party 社交局)',
        condition: (s) => s.cash >= 2,
        effect: (s) => ({ cash: s.cash - 2, charm: Math.min(25, s.charm + 8), health: s.health - 10, age: s.age + 2, message: '每周 Party，在啤酒乒乓桌上认识了一堆富二代与校友朋友。两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      }
    ]
  },

  // 北美大学随机事件
  'college_hackathon_boom': {
    id: 'college_hackathon_boom',
    title: '【校园突发】全美 Hackathon AI 助手爆发',
    description: '校园阶段，你组队参加全美大学黑客松。主评委是 Stanford 博士、AI 开源先锋 Alex 师兄，以及大厂总监 Dave。比赛倒计时 2 小时，你们的项目因为并发逻辑出现卡顿！',
    choices: [
      {
        text: '紧急接入 Claude/Cursor 重新优化 Agent 调度层 (硬核技术攻坚)',
        effect: (s) => ({
          leetcode: s.leetcode + 12,
          cash: s.cash + 1.5,
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'mentor', affinity: 85, status: 'ally', note: '黑客松伯乐，Stanford AI 先锋' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            met_alex: true,
            alex_meet_year: s.year
          },
          message: '【逆天夺冠】你们的 AI Agent 演示震撼全场，主评委 Alex 博士对你的技术架构赞不绝口，主动加你微信/LinkedIn 并颁发了 $1.5w 冠军奖金！'
        }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      },
      {
        text: '砍掉复杂并发功能，专注于写精致的前端 Demo 与 PPT 演示',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 5),
          cash: s.cash + 0.5,
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 65, status: 'active', note: '大厂总监，极度看重汇报与PPT' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            met_dave: true,
            dave_meet_year: s.year
          },
          message: '【最佳人气奖】大厂总监 Dave 对你的产品汇报与 PPT 演示极为满意，夸赞你具备“大厂管理层潜质”，现场给你发了名片！'
        }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      }
    ]
  },
  'college_gpa_crisis': {
    id: 'college_gpa_crisis',
    title: '【校园突发】地狱级 Hard 课 (Curves 打分)',
    description: '教授出了地狱级期末试题，全班平均分只有 35 分！曲线打分决定你的 GPA 生死。',
    choices: [
      {
        text: '通宵翻阅经典教材，用反证法完美解答压轴题',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 8, message: '教授被你的硬核推导折服，期末单科拿到 A+！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      },
      {
        text: '找学霸室友通宵抱大腿，共同解出作业与例题',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), health: s.health + 2, message: '成功靠团队协作渡过难关，保住了 3.8+ 的优异 GPA！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      }
    ]
  },
  'college_business_pitch': {
    id: 'college_business_pitch',
    title: '【校园突发】校内商业 Pitch 创投大赛',
    description: '在校园创投大赛上，你面对几位来自硅谷沙丘路 (Sand Hill Road) VC 的合伙人展示商业模型推介！',
    choices: [
      {
        text: '用严谨的财务模型与用户增长曲线征服投资人',
        effect: (s) => ({ cash: s.cash + 2, charm: Math.min(25, s.charm + 5), message: ' 拿到种子轮支票！VC 现场为你开出了 $2w 创业启动扶持资金！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      },
      {
        text: '讲出动人的愿景故事，拉满现场演示舞台感染力',
        effect: (s) => ({ charm: Math.min(25, s.charm + 6), luck: Math.min(99, s.luck + 5), message: '全场爆发出欢呼！虽然没要投资，但结识了一圈顶级投资圈高管人脉！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      }
    ]
  },
  'college_spring_gala': {
    id: 'college_spring_gala',
    title: '【校园突发】春季草坪音乐节与后台偶遇',
    description: '春季草坪音乐节盛大开启！作为音乐节吉他手演完后，你在后台擦汗时遇到了一位赞赏你琴技的心动同学...',
    choices: [
      {
        text: '主动邀请对方去饮品店喝 Boba 奶茶交流音乐',
        effect: (s) => ({ charm: Math.min(25, s.charm + 6), health: Math.min(100, s.health + 10), relationship_status: 'dating', message: '恋爱甜度拉满！你们越聊越投机，顺理成章确立了热恋关系 (Dating)！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      },
      {
        text: '礼貌道谢：“谢谢夸奖，我还要去机房调代码”',
        effect: (s) => ({ leetcode: s.leetcode + 5, charm: Math.min(25, s.charm + 2), message: '高冷风范！你潇洒地背起吉他走向机房，成为了传说中的冷酷吉他手！' }),
        nextEventId: (s: GameState) => ((s.housing_name || '').includes('美硕') || s.is_master) ? 'us_master_grad' : 'us_undergrad_year3',
      }
    ]
  },

  'us_undergrad_year3': {
    id: 'us_undergrad_year3',
    title: '高年级冲刺：Intern 与求职季',
    description: '转眼到了大三和大四，周围的中国同学都在疯狂准备 Summer Intern 与全职 Offer。你打算怎么办？',
    choices: [
      {
        text: '【大厂实习冲刺】海投 500 份简历，疯狂刷 LeetCode 冲大厂',
        effect: (s) => ({ leetcode: s.leetcode + 12, health: s.health - 10, age: s.age + 2, message: '你拿到了硅谷大厂的暑期实习 Offer，顺利完成了大三与大四学业！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【华尔街金融实习】冲击纽约投资银行/量化基金 Quant 实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(25, s.charm + 5), health: s.health - 10, age: s.age + 2, message: '成功斩获纽约名企实习！年薪高昂，顺利完成大学最后两年！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【前沿学术科研】跟教授进 AI 实验室做 Research (冲全奖 PhD)',
        effect: (s) => ({ leetcode: s.leetcode + 10, charm: Math.min(25, s.charm + 4), health: s.health - 8, age: s.age + 2, is_phd: true, message: '你拿到了顶尖教授的强力推荐信，具备了申请顶尖 PhD 的资本！顺利毕业！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【校友人脉内推】去硅谷大厂 Career Fair 活动混脸熟要内推',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: s.cash - 1, charm: Math.min(25, s.charm + 8), age: s.age + 2, message: '你加了几十位大厂校友，拿到不少内推机会，顺利拿到学位！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【佛系阳光青春】适度放松，在加州阳光下享受最后的大学青春',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: Math.min(25, s.charm + 5), age: s.age + 2, message: '虽然没有实习经历，但你度过了人生中最无忧无虑的高年级时光！' }),
        nextEventId: 'us_undergrad_grad',
      }
    ]
  },
  'us_master_year1': {
    id: 'us_master_year1',
    title: '美硕生活：内卷倒计时',
    description: '时间紧迫！美硕只有短短一年半到两年。你一边要应付繁重的课业，一边又要准备残酷的秋招。',
    choices: [
      {
        text: '【加急刷题进厂】选择 1.5 年加急项目，翘课刷题 (23岁毕业)',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 12, age: s.age + 1, message: 'GPA 擦边过，但你闭着眼睛都能手撕红黑树与动态规划，1.5年顺利美硕毕业！' }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '【华尔街量化方向】选择 2 年标准项目，准备 Quant/风控与投资面试 (24岁毕业)',
        effect: (s) => ({ cash: s.cash + 2.5, leetcode: s.leetcode + 8, charm: Math.min(25, s.charm + 4), age: s.age + 2, message: '在 Quant 笔试与数学思维面试中顺利过关，2年学制美硕顺利毕业！' }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '【完美学术绩点】选择 1.5 年加急项目，疯狂赶 Due 保 4.0 GPA (23岁毕业)',
        effect: (s) => ({ leetcode: s.leetcode + 6, health: s.health - 8, charm: Math.min(25, s.charm + 3), age: s.age + 1, message: '你拿到了 4.0 的完美绩点！展现了极其严谨的学业能力，1.5年美硕顺利毕业！' }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '【校友人脉内推】选择 2 年标准项目，去硅谷大厂活动混脸熟要内推 (24岁毕业)',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: s.cash - 1, charm: Math.min(25, s.charm + 10), age: s.age + 2, message: '你加了 50 个大厂学长学姐的 LinkedIn，拿到了不少直通面试机会，2年美硕顺利毕业！' }),
        nextEventId: 'us_master_grad',
      }
    ]
  },
  'us_master_grad': {
    id: 'us_master_grad',
    title: '硕士毕业',
    description: '你拿到了硕士学位，OPT 已经激活。现在必须在三个月内找到工作，否则就要被送中了。',
    imageUrl: 'images/stanford_graduation.jpg',
    choices: [

      {
        text: '海投简历，疯狂刷题',
        effect: (s) => ({ visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', health: s.health - 10, leetcode: s.leetcode + 12 }),
        nextEventId: 'job_hunt',
      },
      {
        text: '找ICC挂靠 (保底策略)',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', cash: s.cash - 1, tc: 6, company: 'icc', job_type: 'startup', laid_off: false, message: '你找了一家印裔 ICC 外包公司挂靠，拿着微薄薪水并等待 Client 派遣。' }),
        nextEventId: 'icc_work',
      },
      {
        text: '加入一家刚成立的 AI 初创公司 (高风险高回报)',
        condition: (s) => s.year >= 2023,
        effect: (s) => {
          const win = Math.random() < 0.08;
          return win 
            ? { tc: 25, health: s.health - 20, cash: s.cash + 100, job_type: 'startup', laid_off: false, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', message: '天选之子！你盲狙的公司获得核心突破并由资本巨额注资，你分到了高额股票！' }
            : { tc: 0, health: s.health - 30, laid_off: true, job_type: 'unemployed', visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'OPT (实习)', message: '公司烧光了投资人的钱，不到半年就倒闭了。期权变成了废纸，你只能连夜更新简历。' };
        },
        nextEventId: (s: GameState) => {
          if (s.laid_off) return 'job_hunt';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      }
    ]
  },
  'job_hunt': {
    id: 'job_hunt',
    title: '湾区求职季',
    description: '你迎来了惨烈的面试季。不同年份的市场难度天差地别...',
    choices: [
      {
        text: '靠 CS四大 校友黑手党内推，空降大厂',
        condition: (s) => s.school === 'cmu',
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const mafiaTargets = [
            { company: 'google', name: 'Google (Infra 核心架构组)', tcBoost: 28, healthDrain: 8, desc: 'CMU 核心校友直接将你内推进山景城 Googleplex 基础设施组！享受顶尖 WLB 与美味食堂。' },
            { company: 'meta', name: 'Meta (AI 算法与分布式系统)', tcBoost: 35, healthDrain: 16, desc: 'CMU 校友总监将你拉入 Menlo Park Meta 核心组，拿到顶格包裹但面临高压节奏！' },
            { company: 'apple', name: 'Apple (Apple Park 架构团队)', tcBoost: 30, healthDrain: 6, desc: 'CMU 校友学长内推你直通 Apple Park 架构团队，拥有极高稳定性与顶尖硬件生态！' },
            { company: 'uber', name: 'Uber (核心调度与分布式架构)', tcBoost: 32, healthDrain: 12, desc: '凭借 CMU 分布式系统金字招牌，校友学姐直接将你带入旧金山 Uber 核心团队！' }
          ];
          const chosen = mafiaTargets[Math.floor(Math.random() * mafiaTargets.length)];
          return { 
            health: Math.max(0, s.health - chosen.healthDrain), 
            tc: getLevelScaledTC(chosen.tcBoost, lvl), 
            laid_off: false, 
            cash: s.cash + 8, 
            company: chosen.company, 
            job_type: 'big_tech', 
            level: lvl, 
            message: chosen.desc 
          };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '跟着 理工大U 教授去搞 Web3/AI 创业',
        condition: (s) => s.school === 'ucb' && s.cash >= 5,
        effect: (s) => ({ cash: s.cash - 5, laid_off: false, message: '你加入了教授的局，虽然没拿到大厂包裹，但感觉马上就要改变世界了。' }),
        nextEventId: 'startup_work',
      },
      {
        text: '【强力人脉 Referral】凭借学长学姐/熟人总监直通大厂面试',
        reqBadge: '需广阔人脉关系',
        condition: (s) => (s.network || 0) >= 25,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const referralPool = [
            { company: 'google', name: 'Google', baseTc: s.year >= 2023 ? 32 : 28, healthDelta: 6, desc: '凭借强大人脉网络 (Referral)，熟人总监推荐你免除简历初筛无缝上岸 Google，享受顶尖 WLB！' },
            { company: 'meta', name: 'Meta', baseTc: s.year >= 2023 ? 38 : 34, healthDelta: -10, desc: '在熟人 Tech Lead 的强力背书下，你直接拿下 Menlo Park Meta 核心组高额总包，但面临高强度挑战！' },
            { company: 'apple', name: 'Apple', baseTc: s.year >= 2023 ? 34 : 30, healthDelta: 4, desc: '库比蒂诺 Apple 资深总监开绿灯，将你内推至 Apple Park 核心工程团队，发展平稳且福利丰厚！' },
            { company: 'microsoft', name: 'Microsoft', baseTc: s.year >= 2023 ? 30 : 26, healthDelta: 8, desc: '微软云与 AI 部门熟人校友直接拉你入组，作息极度规律，生活质量拉满！' }
          ];
          const chosen = referralPool[Math.floor(Math.random() * referralPool.length)];
          return {
            tc: getLevelScaledTC(chosen.baseTc, lvl),
            laid_off: false,
            cash: s.cash + 6,
            company: chosen.company,
            job_type: 'big_tech',
            level: lvl,
            health: Math.min(100, Math.max(0, s.health + chosen.healthDelta)),
            network: Math.min(100, (s.network || 0) + 5),
            message: chosen.desc
          };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '通过兄弟会/姐妹会/校友会内推，加入当地中型养老公司',
        condition: (s) => s.school === 'state',
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const stateCompanies = [
            { company: 'apple', name: 'Apple 运维开发团队' },
            { company: 'cisco', name: 'Cisco 思科网络研发部' },
            { company: 'adobe', name: 'Adobe 圣何塞总部' }
          ];
          const comp = stateCompanies[Math.floor(Math.random() * stateCompanies.length)];
          return { 
            tc: getLevelScaledTC(16, lvl), 
            laid_off: false, 
            company: comp.company, 
            health: s.health + 10, 
            charm: s.charm + 2, 
            job_type: 'big_tech', 
            level: lvl, 
            message: `加入当地校友扎堆的 ${comp.name}！工作轻松，每天下午 4 点下班去冲浪，生活十分惬意。` 
          };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },

      {
        text: '面试 FLAG 大厂 (Google/Apple 等养老厂)',
        effect: (s) => {
          let req = 50;
          if (s.macro_economy === 'bull') req = 30;
          else if (s.macro_economy === 'bear') req = 75;
          else if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30; // 疫情放水期
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const baseTc = s.year >= 2023 ? 30 : 26;
          const targetComp = Math.random() < 0.5 ? 'google' : 'apple';
          const compName = targetComp === 'google' ? 'Google' : 'Apple';
          return s.leetcode >= req 
            ? { tc: getLevelScaledTC(baseTc, lvl), laid_off: false, cash: s.cash + 5, health: s.health - 5, company: targetComp, job_type: 'big_tech', level: lvl, message: `上岸！当前市场环境要求LeetCode>${req}，你顺利通过面试入职 ${compName}。` }
            : { health: s.health - 10, message: `面试被挂了！当前市场环境要求LeetCode>${req}。` };
        },
        nextEventId: (s: GameState) => {
          let req = 50;
          if (s.macro_economy === 'bull') req = 30;
          else if (s.macro_economy === 'bear') req = 75;
          else if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30;
          if (s.leetcode < req) return 'job_hunt_fail';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Meta (传说中的卷王之王) - (需要 LeetCode >= 60)',
        condition: (s) => s.leetcode >= 60,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          return { tc: getLevelScaledTC(38, lvl), laid_off: false, health: s.health - 10, cash: s.cash + 10, company: 'meta', job_type: 'big_tech', level: lvl, message: '你成功卷入了 Meta！虽然给的钱多，但是压力山大。' };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '面试普通 Startup',
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          return { tc: getLevelScaledTC(18, lvl), laid_off: false, health: s.health - 2, company: 'startup', job_type: 'startup', level: lvl, message: '你加入了一家 Early Stage 的初创公司，虽然工资低，但老板给你画了巨大的大饼。' };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },

      {
        text: '加入 TikTok (传说中的拿命换钱) - (需要 LeetCode >= 45)',
        condition: (s) => s.leetcode >= 45,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const baseTc = s.year >= 2023 ? 40 : 30;
          return { tc: getLevelScaledTC(baseTc, lvl), laid_off: false, health: s.health - 10, cash: s.cash + 15, company: 'tiktok', job_type: 'tiktok', level: lvl, message: '你成功入职了字节跳动！虽然期权是废纸且中美跨时区开会到凌晨 2 点，但现金包裹极其雄厚！' };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Amazon (门槛较低，但入职即签生死状) - (需要 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          return { tc: getLevelScaledTC(24, lvl), laid_off: false, health: s.health - 5, cash: s.cash + 5, company: 'amazon', job_type: 'amazon', level: lvl, message: '你通过了亚麻的面试！体验到了真正的 Frugality，没有免费食堂且随时可能被 PIP。' };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Nvidia (需要系统底层经验 / LeetCode >= 55)',
        condition: (s) => s.leetcode >= 55,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          // Base TC is calibrated ($28w normal, $36w in AI Bull Market with high RSU share)
          const isBull = s.macro_economy === 'bull' || s.year >= 2023;
          const baseTc = isBull ? 36 : 28;
          return {
            tc: getLevelScaledTC(baseTc, lvl),
            laid_off: false,
            health: s.health - 5,
            cash: s.cash + 5,
            company: 'nvidia',
            job_type: 'nvidia',
            level: lvl,
            message: isBull 
              ? '赶上 AI 芯片大风口！皮衣黄刀法精准，你拿到了高 RSU 股票占比的英伟达芯片团队包裹 ($36w 基准)！' 
              : '你加入了英伟达芯片团队，拿到了 $28w 基础薪资包裹，等待下一轮 AI 牛市风口的到来！'
          };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '挑战顶级量化基金 (Quant) (地狱门槛: 仅限 CS四大 或 PhD)',
        reqBadge: '仅限 CS四大/PhD',
        condition: (s) => (s.school === 'cmu' || s.is_phd),
        effect: (s) => {
          const econBonus = s.macro_economy === 'bull' ? 0.15 : s.macro_economy === 'bear' ? -0.15 : 0;
          let winRate = 0.15 + econBonus;
          if (s.leetcode >= 75) winRate += 0.30;
          else if (s.leetcode >= 60) winRate += 0.15;
          if (s.school === 'cmu' && s.is_phd) winRate += 0.20;
          winRate += (s.luck / 100) * 0.10;

          const pass = Math.random() < winRate;
          const lvl = s.level ? s.level : 'Quant';
          return pass 
            ? { tc: getLevelScaledTC(42, lvl), laid_off: false, cash: s.cash + 10, health: s.health - 15, job_type: 'quant', level: 'Quant', message: '凭顶尖四大名校与 PhD 学术背景！你击败了众多竞争者，拿下了顶级 Quant Fund 42w+ 包裹 Offer！' }
            : { health: s.health - 12, message: '量化基金的随机微积分与高频对冲数学题太烧脑了，你的简历或面经遗憾落选...' };
        },
        nextEventId: (s: GameState) => {
          if (s.tc < 40) return 'job_hunt';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      }
    ]
  },
  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '求职受挫',
    description: '由于迟迟找不到理想工作，你面临着现实的压力...',
    choices: [
      {
        text: '【身份保障无视遣返】在湾区全职闭关刷题再战 (无身份倒计时压力)',
        condition: (s) => s.visa === '公民' || s.visa === '绿卡' || s.gc_stage === 'i485_pending',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1),
          leetcode: Math.min(100, s.leetcode + 25),
          health: Math.max(0, s.health - 5),
          message: '手握绿卡/EAD Combo 身份毫无遣返压力！你在家闭关狂刷算法题，准备下一轮招聘季再战！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '去墨西哥 Tijuana 闯关重签签证 (高风险 Visa Run) - 消耗 $1w',
        condition: (s) => s.cash >= 1 && (s.visa === 'OPT (实习)' || s.visa === 'H1B (工签)'),
        effect: (s) => {
          const win = Math.random() > 0.15; // 85% success
          return win
            ? { cash: s.cash - 1, health: s.health - 15, leetcode: s.leetcode + 5, message: '心惊胆战地越过美墨边境，你奇迹般地拿到了新的签证 Stamp！争取到了宝贵的留美时间！' }
            : { status: 'game_over', message: '在边境小黑屋被海关查出挂靠历史，直接吊销签证并被 5 年禁令限制入境！' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'job_hunt',
      },
      {
        text: '不卷了！回大理/清迈做数字游民躺平',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({ 
          status: 'win', 
          imageUrl: 'images/dali_relax.jpg', 
          message: '你带着几万美元的积蓄去了大理。每天喝咖啡、看苍山洱海。虽然彻底脱离了硅谷的内卷，但你找到内心的平静！(大理躺平结局)' 
        }),
        nextEventId: 'end',
      },
      {
        text: '放弃求职 / 离开硅谷',
        effect: (s) => {
          const reason = (s.visa === '公民' || s.visa === '绿卡') 
            ? '对硅谷内卷与就业市场彻底失望，你选择带上积蓄离开了加州湾区。' 
            : ((s.visa === 'F1 (学生)' || s.visa === '无') 
                ? 'OPT到期未能上岸，你最终遗憾登上了回国的航班。' 
                : 'H1B 60天失业期满未能找到新工作，你最终遗憾登上了回国的航班。');
          return { status: 'game_over', message: reason };
        },
        nextEventId: 'end',
      },
      {
        text: '再读一个水硕维持身份 (Day 1 CPT) - (消耗 $5w)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)' && s.cash >= 5,
        effect: (s) => ({ visa: 'Day 1 CPT', cpt_used: true, cash: s.cash - 5, age: s.age + 1, leetcode: Math.min(100, s.leetcode + 25), message: '你在读 Day 1 CPT 水硕期间狂刷 250 道 Hard 题，算法功力大增！准备重回战场！' }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'choose_housing': {
    id: 'choose_housing',
    title: '湾区租房',
    description: '恭喜你拿到 Offer 开启职场生涯！现在你需要在湾区租房。房租会作为你每年的固定开销。',
    choices: [
      {
        text: '豪华 1b1b (每年 4 万美元): 环境好，心情愉悦',
        effect: (s) => ({ rent: 4, charm: s.charm + 1, health: s.health + 10, has_housing: true, housing_name: 'San Jose 高级公寓', message: '你租下了带有池高级公寓，生活质量极高，相亲市场竞争力上升。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比高',
        effect: (s) => ({ rent: 2, has_housing: true, housing_name: 'Cupertino 2b2b合租', message: '你和朋友合租，偶尔会因为抢厕所和洗碗吵架，但省下了不少钱。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      },
      {
        text: '挂壁大客厅 (每年 1 万美元): 终极省钱',
        effect: (s) => ({ rent: 1, charm: s.charm - 2, health: s.health - 15, has_housing: true, housing_name: '客厅屏风隔间', message: '你睡在客厅，用帘子隔开。每天被室友做饭吵醒，毫无隐私，连相亲都不敢带人回家。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      }
    ]
  },
'big_tech_work': {
    id: 'big_tech_work',
    title: '开启打工生涯',
    description: '你正式开启了职场生涯，成为了光荣的湾区码农。接下来要面临第一道坎：H1B 抽签。',
    imageUrl: 'images/h1b_lottery_win.jpg',
    choices: [
      {
        text: '老老实实祈祷 H1B 中签 (免费)',
        effect: (s) => {
          const winRate = 0.25 + (s.luck / 100) * 0.4; // 幸运值越高越容易中签 (25% - 65%)
          const win = Math.random() < winRate;
          return win 
            ? { visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'H1B (工签)', h1b_attempts: 1, cash: s.cash, imageUrl: 'images/h1b_lottery_win.jpg', message: '人品爆发，第一年 H1B 就成功中签！顺利解决在美工签身份！' }
            : { h1b_attempts: 1, cash: s.cash, health: s.health - 5, message: '第一年 H1B 没抽中！已自动激活 STEM OPT 延期，继续在大厂奋斗并可在年底迎来后续抽签！' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '砸 $8w 现金找顶级律所申办 O1 杰出人才签证 (需现金 >= $8w, 限 PhD/AI研究员/硬核算法背景)',
        reqBadge: '现金>=8w+超凡背景',
        condition: (s) => (s.is_phd || s.job_type === 'ai_research' || s.job_type === 'quant' || s.leetcode >= 85) && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const passProb = (s.is_phd || s.job_type === 'ai_research') ? 0.75 : 0.35;
          const win = Math.random() < passProb;
          return win
            ? { visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'O1 (杰出人才)', cash: s.cash - 8, message: '凭硬核的学术论文与顶会引用，律所成功帮你拿下了 O1 杰出人才签证！彻底摆脱了抽签大坑！' }
            : { cash: s.cash - 8, health: Math.max(0, s.health - 15), message: '移民局以“缺乏行业顶尖影响力与独创贡献”退回了你的 O1 申请！$8w 律师费彻底打了水漂。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【钞能力直接上岸】出资申办 EB-5 投资移民绿卡 (花费 $80w 现金)',
        reqBadge: '现金>=80w',
        condition: (s) => s.cash >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - 80, message: '凭家里雄厚的资金实力，直接出资 $80w 办妥了新法 EB-5 投资移民绿卡，跳过一切工签抽签直接上岸！' }),
        nextEventId: 'post_green_card',
      },
      {
        text: '和美国公民闪婚拿绿卡 (高风险)',
        effect: (s) => {
          const fake = Math.random() > 0.7; // 30% fake marriage caught
          return fake
            ? { status: 'game_over', message: '移民局家访时发现你们是商婚，你被当场遣返回国并终身禁入美国，游戏结束！' }
            : { visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash, message: '你通过婚姻顺利拿到了绿卡，直接跨过了最大的槛！' }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'post_green_card',
      }
    ]
  },
  'h1b_fallback_options': {
    id: 'h1b_fallback_options',
    title: 'H1B 拯救绝境对策',
    description: '抽签未能中签，但你还有最后自救机会，请选择你的拯救路线：',
    choices: [
      {
        text: '【婚姻绿卡自救】与伴侣领证结婚，递交 I-130/I-485 婚姻绿卡',
        condition: (s) => (s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married || (s.charm || 10) >= 15) && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const hasRealPartner = s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married;
          const win = hasRealPartner || Math.random() < 0.75;
          return win
            ? { visa: '绿卡', gc_progress: 5, gc_stage: 'approved', is_married: true, relationship_status: 'married', message: '【婚姻绿卡获批】在身份绝境中，伴侣坚定地与你领证结婚并递交了 I-130/I-485 双递交申请，顺利拿下婚姻绿卡，彻底解决留美身份！' }
            : { status: 'game_over', message: '移民局严肃调查判定为虚假婚姻，你被当场遣返回国并终身禁入美国，游戏结束！' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'post_green_card',
      },
      {
        text: '【杰出人才自救】申办 O1 签证 (花费 w 律师费)',
        reqBadge: '需PhD或硬核算法背景',
        condition: (s) => (s.is_phd || s.leetcode >= 85 || s.job_type === 'ai_research') && s.cash >= 5 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const passProb = s.is_phd ? 0.75 : 0.30;
          const win = Math.random() < passProb;
          return win
            ? { visa: 'O1 (杰出人才)', cash: s.cash - 5, health: Math.max(0, s.health - 5), message: '凭硬核论文与行业大牛推荐信，移民局批复了你的 O1 杰出人才签证！成功自救！' }
            : { cash: s.cash - 5, health: Math.max(0, s.health - 15), message: 'O1 申请惨遭 RFE 拒绝，这一自救路线彻底失败。' };
        },
        nextEventId: (s) => s.visa === 'O1 (杰出人才)' ? 'sv_daily_life' : 'h1b_fallback_options',
      },
      {
        text: '【钞能力投资自救】全额出资申办 EB-5 投资移民绿卡 (花费 w)',
        reqBadge: '现金>=80w',
        condition: (s) => s.cash >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - 80, message: '凭雄厚资金实力，全额出资 w 办妥了新法 EB-5 投资移民绿卡！彻底甩开所有身份枷锁！' }),
        nextEventId: 'post_green_card',
      },
      {
        text: '申请 Relocate 到温哥华 Office 办 L1 签证 (曲线救国)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: 'L1 (外派)', l1_relocated: true, message: '你外派加拿大一年后凭 L1 签证顺利调回湾区总部！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '紧急挂靠 Day 1 CPT 水硕 (花费 .5w)',
        condition: (s) => s.cash >= 1.5 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: 'Day 1 CPT', cash: s.cash - 1.5, cpt_used: true, message: '白天写代码，晚上做作业，你凭 Day 1 CPT 成功维持了合法工作身份！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【绿卡/公民身份】已有绿卡或公民身份，直接跳过抽签困境',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({ message: '你拥有绿卡/公民身份，完全不受抽签限制，继续专注于工作与生活！' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'sv_daily_life': {
    id: 'sv_daily_life',
    title: '湾区日常 (行动面板)',
    description: '又是新的一年。每年湾区都会涌现出不同的限时行业机遇，合理分配你的精力吧！',
    choices: [
      // 1. 【今年限时机会】 (每年限参与 1 次，不消耗年度重心)
      {
        text: '【限时机会】 Stanford 师兄/师姐拉你组队冲 AI Hackathon ($0.5w)',
        condition: (s) => s.cash >= 0.5 && (s.year % 6 === 0 || s.year % 6 === 3) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const win = Math.random() < (0.10 + s.leetcode / 800);
          return win
            ? { last_limited_opp_year: s.year, cash: s.cash + 8, leetcode: s.leetcode + 10, charm: Math.min(25, (s.charm || 10) + 3), message: '【Hackathon 夺冠】比赛通宵 48 小时！你们的 Demo 拿下了全场总冠军！硅谷顶级天使投资人现场开出 $30w 支票支持团队继续研发，作为核心开发你分到了 $8w！' }
            : { last_limited_opp_year: s.year, cash: s.cash - 0.5, health: Math.max(0, s.health - 15), leetcode: s.leetcode + 8, message: '【Hackathon 陪跑】连续通宵两天喝了 8 罐红牛，虽然Demo演示时服务器崩了没拿奖，但你结识了一群大牛。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 抢购 NVIDIA GTC 大会 VIP 门票进场见皮衣黄 ($1.5w)',
        condition: (s) => s.cash >= 1.5 && (s.year % 6 === 1) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.5,
          charm: Math.min(25, (s.charm || 10) + 6),
          luck: Math.min(99, (s.luck || 20) + 15),
          message: '【参加 GTC】你在 GTC 大会前排拿到了黄仁勋签名的黑色皮衣同款折扇！玄学气运值大增，接下来的投资和求职将获得强运加持！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 火人节 (Burning Man) 极客大迁徙与灵性放空 ($1.2w)',
        condition: (s) => s.cash >= 1.2 && (s.year % 6 === 2) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.2,
          health: Math.min(100, s.health + 8),
          charm: Math.min(25, (s.charm || 10) + 4),
          luck: Math.min(99, (s.luck || 20) + 8),
          message: '【火人节洗礼】你在黑石城沙漠参加了 Burning Man，虽然风沙与昼夜狂欢有些耗费体力，但灵性觉醒彻底清空了精神内耗，并结识了一批硅谷前沿极客！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 抢注爆火 AI Agent 域名并发布顶流测评视频 ($0.8w)',
        condition: (s) => s.cash >= 0.8 && (s.year % 6 === 4) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const winRate = 0.40 + ((s.charm || 10) / 50) + ((s.luck || 20) / 500);
          const isViral = Math.random() < Math.min(0.85, winRate);
          return isViral
            ? {
                last_limited_opp_year: s.year,
                cash: s.cash + 3.5,
                health: Math.max(0, s.health - 5),
                charm: Math.min(25, (s.charm || 10) + 4),
                message: '【测评爆火】你连续肝夜剪出的 AI Agent 深度评测视频在 YouTube 和小红书大爆！收割了 $4.3w 广告赞助 (净赚 $3.5w)！'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 0.8,
                health: Math.max(0, s.health - 5),
                charm: Math.min(25, (s.charm || 10) + 2),
                message: '【流量平平】视频遭遇了平台算法限流，虽然熬夜没能回本，但积累了宝贵的自媒体剪辑与运营经验。'
              };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 提交大厂云系统 Zero-Day 漏洞获取 Bug Bounty 赏金 (需 LeetCode >= 35)',
        condition: (s) => s.leetcode >= 35 && (s.year % 6 === 5) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const success = Math.random() < 0.25;
          return success
            ? { last_limited_opp_year: s.year, cash: s.cash + 8, leetcode: s.leetcode + 5, message: '【提交漏洞】安全部门确认了你提交的高危提权漏洞！向你的账户汇入了 $8w 漏洞赏金！' }
            : { last_limited_opp_year: s.year, health: Math.max(0, s.health - 10), message: '【提交漏洞】安全团队回应称这是“预期设计 (Works as Intended)”，白白研究了三天。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 考取 Palo Alto 机场固定翼私人飞行员执照 (PPL) ($2.5w)',
        condition: (s) => s.cash >= 2.5 && (s.year % 5 === 2) && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 2.5,
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 6),
          message: '【考取飞行执照】你成功通过 FAA 单飞考核拿到了私人飞行员执照！周末开着塞斯纳俯瞰金门大桥，在湾区社交圈名声大噪！'
        }),
        nextEventId: 'sv_daily_life',
      },

      // 2. 【情境定制动态专属】 (根据公司、婚姻、财富阶层动态生成)
      {
        text: '【大厂战时冲刺】主动认领 S-Level 核心架构重构，硬抗高压冲刺顶格 Perf',
        condition: (s) => (s.company === 'meta' || s.job_type === 'tiktok' || s.job_type === 'nvidia' || s.company === 'amazon' || s.job_type === 'amazon') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        hideIfUnavailable: true,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 8 : 14;
          const winRate = 0.38 + (s.leetcode / 250) + ((s.charm || 10) * 0.01) + (isKingOfRoll ? 0.15 : 0);
          const pass = Math.random() < Math.min(0.85, winRate);

          if (pass) {
            if (curLevel === 'L3' && yearsInGrade >= 1) {
              if (Math.random() < 0.65 || isKingOfRoll) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 4.0, level: 'L4', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】卷王之王神功大成！你凭借硬核架构交付拿下 Top Perf 破格晋升至 L4！' : '【战时冲刺成功】你带领组员重构了核心服务！拿下顶级 Top Perf 并直接破格晋升至 L4！总包调升 +$4.0w！' };
              }
            }
            if (curLevel === 'L4' && yearsInGrade >= 1 && s.leetcode >= 45) {
              if (Math.random() < 0.45 || isKingOfRoll) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(12, drain + 2)), tc: s.tc + 6.5, level: 'L5 (Senior)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】抗下千亿流量重构！卷王底蕴爆发，全票通过晋升委员会晋级 L5 Senior！' : '【战时冲刺成功】扛下千亿流量大促！顺利通过升职委员会，正式晋升为 L5 Senior！总包调升 +$6.5w！' };
              }
            }
            if ((curLevel === 'L5 (Senior)' || curLevel === 'L5') && yearsInGrade >= 1 && s.leetcode >= 60 && (s.charm || 10) >= 12 && (s.network || 10) >= 20) {
              const promoChance = 0.15 + ((s.charm || 10) * 0.008) + ((s.network || 10) * 0.006) + (isKingOfRoll ? 0.10 : 0);
              if (Math.random() < Math.min(0.40, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(16, drain + 5)), tc: s.tc + 12.0, level: 'L6 (Staff)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】突破天堑！凭借硬核架构与强大人脉资源，破格晋升为 L6 Staff 架构师！' : '【战时冲刺成功】你拉拢跨组部门资源并主导架构落地，顺利晋升为 L6 Staff 架构师！总包大幅调升 +$12w！' };
              }
            }
            if ((curLevel === 'L6 (Staff)' || curLevel === 'Staff' || curLevel === 'MTS') && yearsInGrade >= 2 && s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35) {
              const promoChance = 0.16 + ((s.charm || 10) * 0.005) + ((s.network || 10) * 0.004) + (isKingOfRoll ? 0.08 : 0);
              if (Math.random() < Math.min(0.33, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(20, drain + 9)), tc: s.tc + 20.0, level: 'L7 (Senior Staff)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】统帅战略基建！在 VP 盟友背书与跨部门拉拢中，全票通过晋升为 L7 Senior Staff 资深架构师！' : '【战时冲刺成功】你凭借雄厚的高管人脉与战略领导力重塑公司架构，正式晋升为 L7 Senior Staff 资深架构师！总包调升 +$20w！' };
              }
            }
            if ((curLevel === 'L7 (Senior Staff)' || curLevel === 'Senior Staff' || curLevel === 'L7') && yearsInGrade >= 2 && s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50) {
              const promoChance = 0.11 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.002) + (isKingOfRoll ? 0.05 : 0);
              if (Math.random() < Math.min(0.20, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(25, drain + 14)), tc: s.tc + 35.0, level: 'L8 (Principal)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】封神之路！获董事会联合推举与行业泰斗声望，破格登顶 L8 Principal 首席架构师/技术院士！' : '【战时冲刺成功】你在董事会闭门会议中赢得一致赞誉，登顶全公司屈指可数的 L8 Principal 首席架构师！总包暴涨 +$35w！' };
              }
            }
            return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 3.0, message: '【战时冲刺成功】虽然你的技术与人脉指标已全部达标，但由于今年部门 Headcount Quota 紧张，升职名额顺延至明年，仅拿下了 Top Perf 顶格绩效大包 (+3.0w TC)。' };
          }
          return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 1.0, message: '【高压内卷苦战】虽然抗住了高强度 Oncall，但因为大厂组织架构调整，功劳被大领导收割，只拿到了普调。' };
        },
        nextEventId: (s) => {
          const msg = s.message || '';
          if (s.level === 'L8 (Principal)' && msg.includes('晋升')) return 'l8_principal_celebration';
          if (s.level === 'L7 (Senior Staff)' && msg.includes('晋升')) return 'l7_senior_staff_celebration';
          if (s.level === 'L6 (Staff)' && msg.includes('晋升')) return 'l6_staff_celebration';
          if (msg.includes('晋升')) return 'promo_celebration';
          return midYearEventRouter(s);
        },
      },
      {
        text: '【大厂 WLB 漫步】享受充裕生活平衡，申请内部 Transfer 探索前沿大模型组',
        condition: (s) => (s.company === 'google' || s.company === 'apple' || s.job_type === 'big_tech') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && !s.transferred_to_ai,
        hideIfUnavailable: true,
        effect: (s) => {
          const pass = s.leetcode >= 30 || Math.random() < 0.6;
          return pass
            ? { mid_year: true, season_stage: 'h1', transferred_to_ai: true, health: Math.min(100, s.health + 10), leetcode: s.leetcode + 4, tc: s.tc + 1.5, message: '【成功转岗】顺利 Transfer 到了前沿 AI 研发组！既拥有神仙级的 WLB 作息，又接触到了顶尖行业架构！' }
            : { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 10), message: '【安稳养老】原组 Manager 极力挽留，你继续享受着下午 5 点准时下班的惬意大厂时光。' };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【前沿 AI 团队攻坚】主导大模型低延迟推理架构落地，兼顾神仙级 WLB',
        condition: (s) => (s.company === 'google' || s.company === 'apple' || s.job_type === 'big_tech') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && !!s.transferred_to_ai,
        hideIfUnavailable: true,
        effect: (s) => {
          const pass = s.leetcode >= 40 || Math.random() < 0.7;
          return pass
            ? { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 8), leetcode: s.leetcode + 3, cash: s.cash + 1.0, message: '【AI 架构落地】你负责的低延迟推理架构性能翻倍，获得组内一致好评，工作与生活达到完美平衡！' }
            : { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 10), message: '【惬意养老】AI 组内节奏舒适，你在按部就班维护系统的同时，每天喝下午茶写技术博客。' };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【初创生死发版】通宵配合 VC 尽调与产品上线，为公司千万级融资做技术背书',
        condition: (s) => s.job_type === 'startup' && !s.laid_off,
        hideIfUnavailable: true,
        effect: (s) => {
          const winRate = 0.20 + (s.leetcode / 400) + ((s.luck || 20) / 400);
          const win = Math.random() < Math.min(0.65, winRate);
          return win
            ? { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), cash: s.cash + 5, stocks: (s.stocks || 0) + 10, message: '【融资大捷】公司顺利拿下 A 轮千万美金融资！你的期权估值大涨并分到了 $5w 现金绩效奖金！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), leetcode: s.leetcode + 5, message: '【技术硬仗】一人干完了三人的全栈活，虽然融资推迟，但全套云原生与 Agent 架构让你技术实力全面蜕变。' };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【家庭生活：Napa 酒庄度假】带伴侣前往 Napa 谷品酒度假，优化家庭双职工理财',
        condition: (s) => s.relationship_status === 'married' || s.is_married || s.relationship_status === 'dating',
        hideIfUnavailable: true,
        effect: (s) => {
          const isMarriedNow = s.relationship_status === 'married' || s.is_married;
          return {
            mid_year: true, season_stage: 'h1',
            health: Math.min(100, s.health + 10),
            cash: isMarriedNow ? s.cash + 1.5 : Math.max(0, s.cash - 0.5),
            charm: Math.min(25, (s.charm || 10) + 2),
            message: isMarriedNow 
              ? '【家庭甜度与财富双收】打卡 Napa 米其林与酒庄，夫妻双方合理规划了家庭 401k 与 Backdoor Roth IRA，家庭净资产稳健增长！'
              : '【浪漫热恋周末】在 Napa 阳光与葡萄藤下度过了浪漫周末，两人感情迅速升温，职场疲惫一扫而空！'
          };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【沙丘路私享会】受邀参加 Sand Hill Road 闭门华人天使投资人沙龙 ($1.0w)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 200 && s.cash >= 1.0,
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: s.cash - 1.0,
          charm: Math.min(25, (s.charm || 10) + 3),
          luck: Math.min(99, (s.luck || 20) + 6),
          message: '【拓展顶层人脉】在沙丘路红木私宅里结识了数位顶级 VC 合伙人与独角兽创始人，手握核心行业内幕与优质天使跟投名额！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【湾区省钱作战】打卡大华 99 特价便当与 CostCo 拼单，极限降低生活能耗',
        condition: (s) => s.cash < 15 && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: s.cash + 0.8,
          health: Math.min(100, s.health + 3),
          message: '【极简挂壁大作战】凭借 CostCo 烤鸡与超市特价便当，今年成功省下 $0.8w 生活开支，磨砺了坚韧的极简生存心态！'
        }),
        nextEventId: midYearEventRouter,
      },

      // 3. 【常规年度重心】 (点击后进入年中/年底结算)
      {
        text: '【年度重心：疯狂内卷】拼命加班冲 Perf，争取加薪与升职',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !s.laid_off,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 8 : 14;
          
          const baseWinRate = 0.15 + (s.leetcode / 300) + ((s.charm || 10) * 0.015) + ((s.network || 10) * 0.01) + (isKingOfRoll ? 0.15 : 0);
          const pass = Math.random() < Math.min(0.78, baseWinRate);

          if (curLevel === 'L3') {
            if (s.leetcode < 25) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 0.5, message: 'Manager 指出你的代码产出与算法基础还不够扎实，建议多提升技术硬实力。' };
            if (yearsInGrade >= 1 && pass && (Math.random() < 0.50 || isKingOfRoll)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 3.5, level: 'L4', last_promo_age: s.age, message: isKingOfRoll ? '【卷王破格晋升】做题家底蕴彻底释放，你的 Perf 拿下顶格 EE 绩效破格晋升至 L4！' : '恭喜！你的 Perf 拿下 EE 绩效，成功晋升至 L4 工程师！总包调薪 +$3.5w！' };
          } else if (curLevel === 'L4') {
            if (s.leetcode < 45) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 1.0, message: '晋升委员会认为你的技术深度还不到 Senior 级别。' };
            if (yearsInGrade >= 1 && pass && (Math.random() < 0.35 || isKingOfRoll)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 6.0, level: 'L5 (Senior)', last_promo_age: s.age, message: '轰动全组！你顺利通过升职委员会评审，正式晋升为 L5 Senior！总包调薪 +$6.0w！' };
          } else if (curLevel === 'L5 (Senior)' || curLevel === 'L5') {
            const promoChance = 0.10 + ((s.charm || 10) * 0.006) + ((s.network || 10) * 0.005) + (isKingOfRoll ? 0.08 : 0);
            if (s.leetcode >= 60 && (s.charm || 10) >= 12 && (s.network || 10) >= 20 && s.health >= 35 && s.tc >= 30 && pass && Math.random() < Math.min(0.28, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(15, drain + 6)), tc: s.tc + 12.0, level: 'L6 (Staff)', last_promo_age: s.age, message: '奇迹登顶！你结合架构产出与组间领导影响力，成功晋升为 L6 Staff 架构师！总包调升 +$12w！' };
          } else if (curLevel === 'L6 (Staff)' || curLevel === 'Staff' || curLevel === 'MTS') {
            const promoChance = 0.13 + ((s.charm || 10) * 0.004) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.06 : 0);
            if (s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35 && s.health >= 40 && s.tc >= 45 && yearsInGrade >= 2 && pass && Math.random() < Math.min(0.26, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(20, drain + 10)), tc: s.tc + 20.0, level: 'L7 (Senior Staff)', last_promo_age: s.age, message: '战略突围！凭借高层 VP Sponsor 与跨部门整合能力，全票通过晋升为 L7 Senior Staff 资深架构师！总包狂飙 +$20w！' };
          } else if (curLevel === 'L7 (Senior Staff)' || curLevel === 'Senior Staff' || curLevel === 'L7') {
            const promoChance = 0.10 + ((s.charm || 10) * 0.002) + ((s.network || 10) * 0.002) + (isKingOfRoll ? 0.04 : 0);
            if (s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50 && s.health >= 45 && s.tc >= 65 && yearsInGrade >= 2 && pass && Math.random() < Math.min(0.16, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.max(25, drain + 14)), tc: s.tc + 35.0, level: 'L8 (Principal)', last_promo_age: s.age, message: '硅谷封神！凭借全公司顶级声望与董事会强力支持，获聘为全公司屈指可数的 L8 Principal 首席架构师！总包调升 +$35w！' };
          }
          const meritBonus = Math.random() < 0.35 ? 2.0 : 1.0;
          return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + meritBonus, message: isKingOfRoll ? `【卷王日常高产】你高质高效交付了核心模块，拿到了项目奖金 (+${meritBonus}w TC)！` : `你拼命熬夜写代码，拿到了项目奖金 (+${meritBonus}w TC)！Manager：“今年部门升职 Quota 紧张，你的指标已入库，明年一定为你申请！”` };
        },
        nextEventId: (s) => {
          const msg = s.message || '';
          if (s.level === 'L8 (Principal)' && msg.includes('晋升')) return 'l8_principal_celebration';
          if (s.level === 'L7 (Senior Staff)' && msg.includes('晋升')) return 'l7_senior_staff_celebration';
          if (s.level === 'L6 (Staff)' && msg.includes('晋升')) return 'l6_staff_celebration';
          if (msg.includes('晋升')) return 'promo_celebration';
          return midYearEventRouter(s);
        },
      },
      {
        text: '【年度重心：闭关修炼】死磕算法与系统设计，开启湾区跳槽季 (进入多厂 Offer 抉择)',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (s) => {
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 6 : 12;
          const leetBonus = isKingOfRoll ? 20 : 15;
          if (s.leetcode < 40) {
            return {
              mid_year: true,
              season_stage: 'h1',
              health: Math.max(0, s.health - drain),
              leetcode: s.leetcode + leetBonus,
              message: isKingOfRoll 
                ? `【卷王疯狂刷题】闭关苦修算法与架构，狂刷 200 题算法真经 (算法 +${leetBonus})！虽然做题储备大涨，但当前 LeetCode 尚未达大厂面试标准，明年蓄力必能乱杀！` 
                : `你闭关苦练算法与系统架构，做题储备突飞猛进 (算法 +${leetBonus})！但当前算法储备还需沉淀，建议明年蓄力冲击硅谷大厂！`
            };
          }
          return {
            mid_year: true,
            season_stage: 'h1',
            health: Math.max(0, s.health - drain),
            leetcode: s.leetcode + (isKingOfRoll ? 12 : 8),
            message: '【斩获多轮 Onsite 面试】经过一整年的闭关刷题与系统设计复盘，你成功通过了多家科技公司的前置轮筛选，正式进入最终 Offer 抉择！'
          };
        },
        nextEventId: (s: GameState) => (s.leetcode >= 40 ? 'job_hop_market' : midYearEventRouter(s)),
      },
      {
        text: '【年度重心：拓展副业】经营小红书与独立开发',
        condition: (s) => true,
        effect: (s) => {
          if (s.leetcode >= 40 && Math.random() < (0.05 + (s.luck || 20) / 500)) {
            return { mid_year: true, season_stage: 'h1', cash: s.cash + 35, leetcode: s.leetcode + 5, health: Math.max(0, s.health - 15), message: '你做出的套壳 AI 产品在 Product Hunt 上登顶了！有资本用 50 万美元收购了你的项目！' };
          }
          let winRate = (s.charm || 10) >= 12 ? 0.9 : ((s.charm || 10) >= 7 ? 0.6 : 0.2);
          if (Math.random() < winRate) {
            if ((s.charm || 10) >= 20 && Math.random() < 0.05) return { mid_year: true, season_stage: 'h1', cash: s.cash + 48, charm: Math.min(25, (s.charm || 10) + 5), health: Math.max(0, s.health - 10), message: '极小概率的奇迹！你的小红书粉丝突破 100 万！获得了大牌广告代言费！' };
            return { mid_year: true, season_stage: 'h1', cash: s.cash + 8, charm: Math.min(25, (s.charm || 10) + 2), health: Math.max(0, s.health - 15), message: '接到了几笔软广赞助，涨了不少粉，但非常疲惫。' };
          }
          return { mid_year: true, season_stage: 'h1', cash: Math.max(0, s.cash - 2), health: Math.max(0, s.health - 20), message: '独立开发没人用，小红书没人看，倒贴钱还心累。' };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【年度重心：投资理财】研究美股财报与大盘，寻找重仓暴富机会 (需现金 >= $15w)',
        condition: (s) => s.cash >= 15 && s.job_type !== 'trader',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 15),
          message: '今年你花了大把时间盯盘、听财报电话会，试图在股市中加速财务自由！'
        }),
        nextEventId: 'stock_market_annual_gamble',
      },
      {
        text: '【年度重心：活跃社交】参加派对聚会，扩充人脉与寻觅良缘',
        condition: (s) => true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 10),
          charm: Math.min(25, (s.charm || 10) + 3),
          message: '你把今年的精力都花在了社交上，颜值打扮都有所提升。'
        }),
        nextEventId: (s) => !s.is_married ? 'dating_market' : midYearEventRouter(s),
      },
      {
        text: '【离职全职 Day Trader】凭 $50w 本金与美籍/绿卡自由身全职操盘 (需美籍/绿卡 + 现金>=50w)',
        reqBadge: '需美籍/绿卡+现金>=50w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民') && s.cash >= 50,
        effect: (_s) => ({
          job_type: 'trader',
          company: '全职 Day Trader',
          level: '全职 Trader',
          tc: 0,
          laid_off: false,
          message: '你正式递交了离职辞呈！凭借 $50w 初始本金与美籍/绿卡自由身，开启了全职 Day Trader 操盘人生！'
        }),
        nextEventId: 'trader_annual_strategy',
      },
      {
        text: '【离职全职 AI/科技创业】拒绝大厂打工，前往 Sand Hill Road (沙丘路) 寻找 VC 融资 (需美籍/绿卡/O1 或 现金>=45w办理O1创业工签)',
        reqBadge: '需美籍/绿卡/O1或现金>=45w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民' || s.visa === 'O1 (杰出人才)') || s.cash >= 45,
        effect: (s) => {
          const needsO1 = s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)';
          return {
            job_type: 'startup_founder',
            company: 'AI/科技 Startup',
            level: 'CEO & Founder',
            tc: 10,
            founder_stage: 'seed',
            company_valuation: 800,
            laid_off: false,
            cash: needsO1 ? s.cash - 5 : s.cash,
            visa: needsO1 ? 'O1 (杰出人才)' : s.visa,
            message: needsO1
              ? '你拒绝了稳健的大厂打工路，花 $5w 律师费办妥了 O1-A 创业杰出人才工签，在 San Mateo 租下一间 Garage，开启了全职 Founder 创业之旅！'
              : '你拒绝了稳健的大厂打工路，凭自由身份在 San Mateo 租下一间 Garage，开启了全职 Founder 创业之旅！'
          };
        },
        nextEventId: 'founder_annual_strategy',
      },
      {
        text: '【年度重心：佛系躺平】宅家打游戏养生，不管世事',
        condition: (_s) => true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 18),
          leetcode: Math.max(0, s.leetcode - 8),
          message: '这一年你彻底躺平摸鱼，除了完成最低限度工作外就是打黑神话悟空。身体逐渐恢复了生机，但由于长期不写硬核代码，你的算法手感与面试反应明显下滑！'
        }),
        nextEventId: midYearEventRouter,
      }
    ]
  },
  'stock_market_annual_gamble': {
    id: 'stock_market_annual_gamble',
    title: '资产配置：股票市场操作',
    description: '你可以自由配置你的现金和股票仓位。注意：股票资产在年终结算时会受到宏观大盘（牛市/熊市）的剧烈影响，而现金则不受波动影响。',
    choices: [
      {
        text: '【买入股票】把闲置现金投资大盘 (买入 $10w)',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({
          cash: s.cash - 10,
          stocks: (s.stocks || 0) + 10,
          message: '你成功将 $10w 现金转入股票账户。'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【大举加仓】将大部分闲置现金转入股市 (买入 $50w)',
        condition: (s) => s.cash >= 50,
        effect: (s) => ({
          cash: s.cash - 50,
          stocks: (s.stocks || 0) + 50,
          message: '你大手笔加仓，将 $50w 现金买入股票！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【卖出套现】从股市中套现部分资金 (卖出 $10w)',
        condition: (s) => (s.stocks || 0) >= 10,
        effect: (s) => ({
          cash: s.cash + 10,
          stocks: (s.stocks || 0) - 10,
          message: '你成功卖出了 $10w 股票，落袋为安。'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【清仓股票】一键清仓所有股票，转回现金 (全部卖出)',
        condition: (s) => (s.stocks || 0) > 0,
        effect: (s) => ({
          cash: s.cash + (s.stocks || 0),
          stocks: 0,
          message: '你清空了所有股票仓位，目前全现金持有，防守反击！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【梭哈期权】拼了！用小额现金炒 0DTE 末日期权 (投入 $5w)',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const hit = Math.random() < (0.08 + s.luck / 500); // 8% base chance
          if (hit) {
            return {
              cash: s.cash + 20, // Turn 5w into 25w (+$20w net cash)
              charm: Math.max(0, s.charm - 2),
              message: '【暴富奇迹！】你赌对了非农数据日的末日期权，一夜之间 $5w 变成了 $25w！截图发在群里被尊称为华尔街之狼，但也有不少人觉得你是个疯狂赌徒敬而远之。'
            };
          } else {
            return {
              cash: s.cash - 5, // Lose all
              health: Math.max(0, s.health - 12),
              message: '【血本无归】期权在归零那刻一文不值...你的 $5w 投资瞬间蒸发。你痛苦地删掉了交易软件。'
            };
          }
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '按兵不动：维持目前的仓位组合进入年终结算',
        effect: (s) => ({
          message: '你决定什么都不做，做时间的朋友，静静等待跨年的钟声。'
        }),
        nextEventId: midYearEventRouter,
      }
    ]
  },
  'sv_year_end_settlement': {
    id: 'sv_year_end_settlement',
    title: '年底结算',
    description: '今年的精力已耗尽，系统正在为你结算工资、扣除房租，并计算绿卡排期...',
    choices: [
      {
        text: '结算并迎接新的一年',
        effect: (s) => {
           let newStartupTenure = s.startup_tenure || 0;
           if (!s.laid_off && s.job_type === 'startup') {
             newStartupTenure += 1;
           } else {
             newStartupTenure = 0;
           }

           let nextGc = s.gc_progress || 0;
           let nextStage = s.gc_stage || 'not_started';

           const isHomeowner = ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(s.housing_name || '');
           const housingExpense = s.rent !== undefined 
             ? s.rent 
             : (isHomeowner ? (s.housing_name === 'Atherton 顶级豪宅' ? 5.0 : 2.0) : 4.0);
           const carExpense = s.car === 'porsche' ? 2.5 : s.car === 'cybertruck' ? 2.0 : s.car === 'model_y' ? 1.0 : 0.3;
           const livingExpense = 3.0;
           const petExpense = s.has_pet ? 0.3 : 0;
           const totalExpense = housingExpense + carExpense + livingExpense + petExpense;

           let newEconomy = s.macro_economy || 'neutral';
           let economyMsg = '';
           
           // Stock market fluctuation
           let currentStocks = s.stocks || 0;
           let stockFluctuation = 0;
           if (currentStocks > 0) {
             const stockMultiplier = newEconomy === 'bull' ? 1.25 : newEconomy === 'bear' ? 0.75 : 1.05;
             const newStocksVal = currentStocks * stockMultiplier;
             stockFluctuation = newStocksVal - currentStocks;
             currentStocks = newStocksVal;
           }
           
           // Income split (50% base cash, 50% RSU stocks for tech workers)
           let preTaxBase = 0;
           let preTaxRSU = 0;
           
           if (!s.laid_off && s.job_type !== 'unemployed' && s.tc > 0) {
             if (s.job_type === 'trader' || s.job_type === 'startup_founder' || s.job_type === 'quant' || s.job_type === 'big_tech') {
               preTaxBase = s.tc; // 交易员、创始人、Quant、养老厂(big_tech) 全现金
             } else if (s.job_type === 'startup') {
               preTaxBase = s.tc * 0.5;
               preTaxRSU = s.tc * 0.5; // startup 股权/期权 50/50
             } else if (s.job_type === 'tiktok') {
               preTaxBase = s.tc * 0.7;
               preTaxRSU = s.tc * 0.3; // 字节现金多
             } else if (s.company === 'meta' || s.job_type === 'nvidia') {
               preTaxBase = s.tc * 0.4;
               preTaxRSU = s.tc * 0.6; // Meta/NVDA 股票多
             } else {
               preTaxBase = s.tc * 0.5;
               preTaxRSU = s.tc * 0.5; // 其他大厂 50/50 (如 Amazon)
             }
           }
           
           const rsuMsg = (currentStocks > 0 || preTaxRSU > 0) 
             ? (newEconomy === 'bull' ? ' (牛市加持股票资产增值 1.25x)' : newEconomy === 'bear' ? ' (熊市打击股票资产缩水 0.75x)' : '')
             : '';
             
           const postTaxBase = preTaxBase * 0.75; 
           const postTaxRSU = preTaxRSU * 0.75;
           
           currentStocks += postTaxRSU; // Vested RSUs go to stock account
           
           const rentalIncome = s.rental_income || 0;
            const rentalMsg = rentalIncome > 0 ? ` 【房产被动现金流】名下出租房产/ADU 带来净租金收益 +$${rentalIncome.toFixed(1)}w！` : '';
            const netIncome = postTaxBase + rentalIncome - totalExpense;
           let finalCash = s.cash + netIncome;
           let autoStockSellMsg = '';

           if (finalCash < 0 && currentStocks > 0) {
             const deficit = Math.abs(finalCash);
             const sellAmt = Math.min(currentStocks, deficit);
             currentStocks -= sellAmt;
             finalCash += sellAmt;
             if (sellAmt > 0) {
               autoStockSellMsg = ` 【股票自动变现】因现金流不足结清账单，系统已自动卖出 $${sellAmt.toFixed(1)}w 股票持仓抵扣房租与生活支出！`;
             }
           }

           let healthDrain = 0;
           let companyMsg = '';
           if (!s.laid_off && s.job_type !== 'unemployed') {
             if (s.job_type === 'tiktok') { healthDrain = 8; companyMsg = ' 字节的高强度对齐让你略感疲惫 (健康 -8)。'; }
             else if (s.job_type === 'quant') { healthDrain = 6; companyMsg = ' 高频交易的紧绷节奏消耗了体力 (健康 -6)。'; }
             else if (s.company === 'meta') { healthDrain = 4; companyMsg = ' Meta 的 PSC 绩效考评让你小有压力 (健康 -4)。'; }
             else if (s.job_type === 'amazon') { healthDrain = 3; companyMsg = ' 亚麻的 PIP 文化让你不敢懈怠 (健康 -3)。'; }
             else if (s.job_type === 'startup') { healthDrain = 3; companyMsg = ' 创业公司的发版节奏让你心力小耗 (健康 -3)。'; }
             else if (s.job_type === 'startup_founder') { healthDrain = 4; companyMsg = ' 创业找融资与管理团队的压力让你略感身心紧绷 (健康 -4)。'; }
             else if (s.job_type === 'big_tech') { healthDrain = -10; companyMsg = ' 养老大厂的神仙 WLB 让你充分养精蓄锐 (健康 +10)。'; }
             else if (s.job_type === 'cn_tech' || s.company === 'cn_big_tech') { healthDrain = 6; companyMsg = ' 国内大厂的高强度业务开发消耗了精力 (健康 -6)。'; }
             else { healthDrain = -6; companyMsg = ' 充沛的带薪年假与规律作息让你的体力得到恢复 (健康 +6)。'; }
           } else {
             healthDrain = -15;
             companyMsg = ' 充沛的休息与离职休假让你的身心彻底康复大复活 (健康 +15)。';
           }
           
           let petHealthBoost = 0;
           let petMsg = '';
           if (s.has_pet) {
             petHealthBoost = 2;
             petMsg = ` 【宠物陪伴】家里的${s.pet_name || '宠物'}每天治愈着你的心神 (健康 +2，宠物抚养支出 -$0.3w)。`;
           }

           let newHealth = Math.min(100, Math.max(0, s.health - healthDrain + petHealthBoost));
           let gcMsg = '';

           if (s.visa === '绿卡' || s.visa === '公民' || s.gc_progress >= 5) {
             nextGc = 5;
             nextStage = 'approved';
             gcMsg = s.visa === '公民' ? ' 【公民身份】你已是美国公民，工作生活不受任何排期与抽签约束。' : ' 【绿卡身份】你已持有美国绿卡，工作生活不受约束。';
           } else if (s.visa === 'H1B (工签)' || s.visa === 'O1 (杰出人才)' || s.visa === 'L1 (外派)' || s.visa === 'Day 1 CPT') {
              const isO1 = s.visa === 'O1 (杰出人才)';
              const isPhd = s.is_phd;
              const isBigTech = s.job_type === 'big_tech' || s.job_type === 'amazon' || s.job_type === 'tiktok' || s.job_type === 'nvidia';

              if (!s.job_type || s.job_type === 'unemployed' || s.laid_off) {
                 if (nextStage === 'perm_processing' || nextStage === 'perm_audit' || nextStage === 'i140_processing' || nextStage === 'i140_rfe') {
                    nextStage = 'not_started';
                    nextGc = 0;
                    gcMsg = ' 【绿卡中断】由于你目前处于失业状态，你的 PERM/I-140 申请被原公司撤回，绿卡进度惨遭清零！';
                 } else if (nextStage === 'not_started') {
                    gcMsg = ' 【绿卡停滞】你目前失业，无法启动任何雇主担保的绿卡申请。';
                 } else {
                    gcMsg = ' 【绿卡排期】你虽然失业，但由于你的 I-140 已经获批，Priority Date 依然为你保留，排期照常进行。';
                 }
              } else if (s.difficulty_title === '困难难度' && s.job_type === 'startup') {
                 gcMsg = ' 【困难模式】在当前 AI 寒冬下，初创公司 Startup 拒绝为你递交 PERM 绿卡申请！只能跳槽大厂或办 O1 签证。';
              } else if (s.job_type === 'startup' && newStartupTenure <= 2) {
                 gcMsg = ` Startup 政策：入职前 2 年不予办理绿卡（当前第 ${newStartupTenure} 年，排期暂未推进）。`;
              } else {
                 if (nextStage === 'not_started') {
                    if (isO1 || isPhd) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc); 
                       gcMsg = ' 【绿卡进度】凭借你的杰出背景 (NIW/EB1)，律师直接为你跳过 PERM，提交了 I-140 申请！';
                    } else {
                       if (Math.random() < (isBigTech ? 0.7 : 0.4)) {
                         nextStage = 'perm_processing';
                         nextGc = Math.max(1, nextGc);
                         gcMsg = ' 【绿卡进度】公司律师正式为你启动了 PERM 打广告和 PWD 流程，漫长的绿卡长征开始了。';
                       } else {
                         gcMsg = ' ⏳ 【绿卡进度】HR 还在拖延你的绿卡流程，尚未正式启动 PERM...';
                       }
                    }
                 } else if (nextStage === 'perm_processing') {
                    const rand = Math.random();
                    if (rand < 0.25) {
                       nextStage = 'perm_audit';
                       gcMsg = ' 【PERM Audit】运气不佳，你的 PERM 遇到了劳工部 Audit (抽查审计)，进度被严重拖延至少一年...';
                    } else if (rand < 0.8) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc);
                       gcMsg = ' 【绿卡进度】你的 PERM 顺利获批！律师马不停蹄为你提交了 I-140 申请。';
                    } else {
                       gcMsg = ' 【绿卡进度】PERM 广告与审理流程仍在进行中...';
                    }
                 } else if (nextStage === 'perm_audit') {
                    if (Math.random() < 0.6) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc);
                       gcMsg = ' 【Audit通过】经历漫长的劳工部审计，你的 PERM 奇迹般顺利自证清白并获批！律师已提交 I-140。';
                    } else {
                       gcMsg = ' 【Audit持续】劳工部仍在严审你的职位薪水与合规材料，本年度进度停滞。';
                    }
                 } else if (nextStage === 'i140_processing') {
                    const rand = Math.random();
                    if (rand < 0.20 && !isO1 && !isPhd) {
                       nextStage = 'i140_rfe';
                       gcMsg = ' 【I-140 RFE】移民局对你的学历与技能发出了补件通知 (RFE)，需追加技术证明材料！';
                    } else {
                       nextStage = 'i140_approved';
                       nextGc = 3;
                       gcMsg = ' 【I-140获批】大喜讯！你的 I-140 移民申请正式获批！你的 Priority Date (PD) 已永久锁定，正式进入漫长排期队列！';
                    }
                 } else if (nextStage === 'i140_rfe') {
                    nextStage = 'i140_approved';
                    nextGc = 3;
                    gcMsg = ' 【RFE通过】补充材料顺利打消了移民局疑虑，你的 I-140 成功获批并锁定 PD！';
                 } else if (nextStage === 'i140_approved') {
                    const currentYear = s.year;
                    const canFile485 = (currentYear >= 2024 && (isO1 || isPhd)) || (nextGc >= 4);
                    if (canFile485) {
                       nextStage = 'i485_pending';
                       nextGc = 4.5;
                       gcMsg = ' 【排期大前进】排期到了！律师已火速为你递交 I-485 身份调整申请，进入最后制卡冲刺阶段！';
                    } else {
                       gcMsg = ' 【绿卡排期】每天刷 Visa Bulletin 已经成了你的习惯，但本月排期纹丝不动。';
                       if (Math.random() < 0.5 && nextGc < 4) nextGc += 0.5; // Slowly increment visual progress
                    }
                 } else if (nextStage === 'i485_pending') {
                    if (Math.random() < 0.6) {
                       nextStage = 'approved';
                       nextGc = 5;
                       gcMsg = ' 【制卡成功】制卡完成，你的 I-485 正式获批！';
                    } else {
                       gcMsg = ' 【制卡中】你的 I-485 正在打指纹和背景调查阶段，距离实体绿卡只有一步之遥！';
                       nextGc = 4.8;
                    }
                 }
              }
           }

            // H1B 年底自动抽签逻辑
            let h1bMsg = '';
            let newVisa = s.visa;
            let newAttempts = s.h1b_attempts || 0;

            if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)' || s.visa === 'Day 1 CPT' || s.visa === 'L1 (外派)') && !s.laid_off && s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'cn_tech' && s.company !== 'cn_big_tech') {
              newAttempts += 1;
              const baseWinRate = s.difficulty_title === '简单难度' ? 0.65 : s.difficulty_title === '困难难度' ? 0.20 : 0.40;
              const winRate = baseWinRate + (s.luck / 100) * 0.2;
              const win = Math.random() < winRate;
              if (win) {
                newVisa = 'H1B (工签)';
                h1bMsg = s.visa === 'L1 (外派)' ? `  外派/L1 转换中签！在第 ${newAttempts} 次 H1B 抽签中成功中签，顺利获得 H1B 工签！` : `  人品大爆发！在第 ${newAttempts} 年 H1B 抽签中成功中签，正式获得 H1B 身份！`;
              } else {
                if (s.visa === 'L1 (外派)') {
                  h1bMsg = ` 【L-1 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！但凭借你的 L-1 跨国外派签证，你在湾区合法工作完全不受影响，公司将为你继续递交后续抽签或启动 EB-1C 绿卡！`;
                } else if (s.visa === 'Day 1 CPT') {
                  h1bMsg = ` 【CPT 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！好在有 Day 1 CPT 学籍维持合法全职工作，明年继续冲刺抽签！`;
                } else {
                  if (newAttempts === 1) {
                    h1bMsg = ' 【H1B首抽未中】第一年 H1B 未中签！已自动激活 STEM OPT 2 年延期，明年还有抽签机会！';
                  } else if (newAttempts === 2) {
                    h1bMsg = ' 【H1B二抽未中】第二年 H1B 依然未中签！只剩最后一年 STEM OPT 抽签机会，需密切关注转学挂靠或外派后路！';
                  } else {
                    h1bMsg = ' 【三年未中告急】警告：三年 H1B 抽签均未能中签！STEM OPT 身份即将到期，面临离境遣返危机！';
                  }
                }
              }
            }

            // Merit raise / RSU refresh check (45% chance)
            let updatedTC = s.tc;
            let meritMsg = '';
            const isWorking = !s.laid_off && s.job_type && s.job_type !== 'unemployed';
            const refreshChance = newEconomy === 'bull' ? 0.60 : newEconomy === 'bear' ? 0.15 : 0.45;
            
            if (isWorking && Math.random() < refreshChance) {
              const refreshAmt = Math.random() < 0.3 ? (newEconomy === 'bull' ? 5.0 : 3.5) : (newEconomy === 'bear' ? 1.0 : 2.0);
              updatedTC = s.tc + refreshAmt;
              meritMsg = `  凭本年度表现获得了公司 Merit Raise 调薪与 RSU 股票 Refresh (+${refreshAmt.toFixed(1)}w TC)！`;
            }

           const newNetWorth = finalCash + currentStocks;
            const newHistory = [
              ...(s.history_net_worth || []),
              {
                age: s.age,
                year: s.year,
                netWorth: parseFloat(newNetWorth.toFixed(1)),
                cash: parseFloat(finalCash.toFixed(1)),
                stocks: parseFloat(currentStocks.toFixed(1))
              }
            ];

            let newTimeline = [...(s.timeline || [])];
            let newStoryFlags = { ...(s.story_flags || {}) };

            if (newNetWorth >= 100 && !newStoryFlags.milestone_100w) {
              newStoryFlags.milestone_100w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '资产跨越: 个人净资产突破 $100 万美元',
                description: '恭喜！扣除所有开支与税费，你的流动净资产正式突破百万美元大关！迈出财务自由扎实一步！',
                category: 'wealth',
                statHighlight: `$${newNetWorth.toFixed(1)}w`
              });
            }
            if (newNetWorth >= 300 && !newStoryFlags.milestone_300w) {
              newStoryFlags.milestone_300w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '资产跨越: 个人净资产突破 $300 万美元',
                description: '通过薪资结余与资本市场复利积累，你的净资产已达 300 万美元，生活从容度大幅提升！',
                category: 'wealth',
                statHighlight: `$${newNetWorth.toFixed(1)}w`
              });
            }
            if (newNetWorth >= 500 && !newStoryFlags.milestone_500w) {
              newStoryFlags.milestone_500w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成基础 FIRE 财务自由 ($500w)',
                description: '资产突破 500 万美元！即使每年 4% 安全提款率也能覆盖湾区高品质生活，提前退休大门已为你敞开！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w FIRE`
              });
            }
            if (newNetWorth >= 800 && !newStoryFlags.milestone_800w) {
              newStoryFlags.milestone_800w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成舒适级 FIRE 财务自由 ($800w)',
                description: '资产突破 800 万美元！坐拥丰厚股票持仓与优质被动现金流，跻身硅谷高净值自由阶层！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w 舒适 FIRE`
              });
            }

            return { 
              mid_year: false,
              season_stage: undefined,
              age: s.age + 1, 
              year: s.year + 1,
              visa: newVisa,
              h1b_attempts: newAttempts,
              startup_tenure: newStartupTenure,
              gc_progress: nextGc,
              gc_stage: nextStage,
              cash: finalCash,
              stocks: currentStocks,
              tc: updatedTC,
              health: newHealth,
              macro_economy: newEconomy,
              story_flags: newStoryFlags,
              timeline: newTimeline,
              history_net_worth: newHistory,
              message: `扣除所得税、房租/房贷、生活与宠物账单支出 ${totalExpense.toFixed(1)} 万后，本年现金流 ${netIncome >= 0 ? '+' + netIncome.toFixed(1) : netIncome.toFixed(1)} 万美元。${rentalMsg}${stockFluctuation !== 0 ? `你的股票账户受大盘影响，本年度浮动为 ${stockFluctuation >= 0 ? '+' : ''}${stockFluctuation.toFixed(1)}w 美元。` : ''}${rsuMsg}${economyMsg}${gcMsg}${companyMsg}${petMsg}${h1bMsg}${meritMsg}${autoStockSellMsg}` 
           };
        },
        nextEventId: (s) => {
          if (s.status === 'win') return 'end';
          if ((s.cash + (s.stocks || 0)) >= s.win_threshold && !s.has_reached_initial_fire) {
            return 'fire_milestone_choice';
          }
          if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && (s.h1b_attempts || 0) >= 3) {
            return 'h1b_final_crisis';
          }
          if (s.gc_progress >= 5 && s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') return 'post_green_card';
          
          return 'sv_daily_life';
        },
      }
    ]
  },
  'blind_team_tea': {
    id: 'blind_team_tea',
    title: '【Blind黑料】深夜吃瓜突然吃到自己头上',
    description: '深夜一点半，你躺在 Sunnyvale 的床上翻看 Blind。热榜第一条加红帖标题赫然写着：\n"Avoid Org [X] in [Company]: Micromanaging Director pip-ing top performers to hit quota, run before it is too late!"\n你越读越心惊——代号项目名、下周 Milestone 日期、以及下午 4 点死盯 Progress 的习惯……这说的特么不就是你的组？！',
    choices: [
      {
        text: '混水摸鱼匿名跟帖：“TC 380k，做过同组，TL 人格分裂确实坑”',
        effect: (s) => ({ charm: Math.min(25, s.charm + 2), health: s.health - 5, message: '你出了一口恶气，但第二天看到 Manager 脸色阴沉地在全员会强调“我们要加强团队信任与通力协作”。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '极度恐慌！连夜关摄像头，边开全员大会边狂刷 LeetCode 备战跳槽',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: s.health - 15, message: '你吓得半夜爬起来刷了 6 道动态规划困难题，咖啡因过量导致心率达到了 130。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '私信发帖人“同在湾区可以加微信交流吗”，结果发现是隔壁工位的同胞',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), cash: Math.max(0, s.cash - 0.2), message: '你们在 Palo Alto 密谋了一下午抱团取暖指南，并交换了彼此的 Referral 资源库。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'zoom_camera_off_leetcode': {
    id: 'zoom_camera_off_leetcode',
    title: '【多任务大师】“不好意思刚才我 Mute 了”',
    description: '部门 60 人的 Quarterly Architecture Review 线上大会正在进行。你关着摄像头、开启静音，一边听高管讲 AI Roadmap，一边全神贯注地切 LeetCode 困难题 #2097。\n突然 Principal Architect 话锋一转：“[你的名字]，针对刚才这个微服务重构方案，你觉得 Rust 和 Go 哪个更适合你们组？”',
    choices: [
      {
        text: '老油条废话推手：“Hello？抱歉刚才 AirPods 断了……我觉得这个要看 Trade-off，建议我们 Offline 找时间 Align 一下。”',
        effect: (s) => ({ charm: Math.min(25, s.charm + 2), message: '经典的硅谷废话太极！高管满意地点了点头，你成功保住了饭碗并继续写出 O(1) 空间复杂度的指针翻转。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '手滑点错！把力扣 Hard 解题窗口共享给了全公司 60 个人！',
        effect: (s) => ({ health: s.health - 15, charm: Math.min(25, s.charm + 8), cash: s.cash + 10, message: '会议室内一片死寂。你把自己的社死截图匿名发到小红书《全员大会手滑投影了力扣Hard怎么破？》，收获 3 万点赞和 200 条求职 Referral 软广费！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '3 秒把问题扔给 ChatGPT，照着读“High throughput, horizontal scalability, zero-cost abstractions”',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 5), tc: s.tc + 2, message: '高管赞叹你的技术深度，当场决定下季度让你负责这个高风险架构重组。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'rsu_vesting_crash': {
    id: 'rsu_vesting_crash',
    title: '【归属日渡劫】从准备买 Palo Alto 到看 Milpitas 打折便当',
    description: '入职第四年，传说中的 4-Year RSU Vesting Cliff (股票归属崖) 正式到来，然而恰逢宏观加息加科技股大暴跌，公司股价从你入职时的 $380 暴跌至 $42。\n你打开 E*TRADE 账户，原本预估的 $40 万美元股票市值缩水成了“能够买两台二手特斯拉”。',
    choices: [
      {
        text: '心理防御倒塌：“哥们，你们厂现在有 Referral 吗？包身份就行，TC 随缘！”',
        effect: (s) => ({ tc: Math.max(10, s.tc - 5), health: s.health - 10, is_new_job: true, message: '你含泪跳槽去了一家给钱更少但至少股价底部的公司，重新开始坐 4 年股票牢。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '拍小红书 VLOG《28岁硅谷码农资产蒸发 60%，带你体验极简挂壁生活》',
        effect: (s) => ({ cash: s.cash + 15, charm: Math.min(25, s.charm + 4), message: '网友太喜欢看硅谷中产受苦了！你的小红书粉丝暴涨，光是电竞椅和挂壁盒饭的广告费就填补了股票亏损。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '死扛信仰！每天去大华超市买促销打折盒饭，熬到中东主权基金收购',
        effect: (s) => ({ health: s.health - 12, luck: Math.min(99, (s.luck || 20) + 8), message: '你开启了硅谷极简苦行僧模式，胃功能下降了，但心智磨砺得坚不可催。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'boba_inflation': {
    id: 'boba_inflation',
    title: '【湾区物价】一杯 $13 的珍珠奶茶与四个小费按钮',
    description: '周六下午，你来到 Cupertino 的奶茶店。点了一杯“黑糖珍珠鲜奶微糖加蛋布丁”，结账单显示：$12.85。\n接着店员把旋转 iPad 屏幕转面向你，提示音响起，屏幕上赫然出现四个巨大按钮：\n【20%】   【25%】   【30%】   【Custom】',
    choices: [
      {
        text: '冒着被店员白眼的风险，眯着眼准确点击极小的字体 Custom Tip -> $0.50',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), charm: Math.max(0, s.charm - 1), message: '你捧着奶茶仓皇逃回车里，发现在停车场你的白色 Model Y 旁边停了另外四台一模一样的白色 Model Y，你按半天钥匙开错别人的车门。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '痛快点击 25%，拍照发朋友圈：“湾区物价让硅谷 L5 活得不如国内县城中产 [流泪]”',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(25, s.charm + 2), message: '你的朋友圈成功引起了老同学的围观和暗酸，完成了标准的硅谷式哭穷炫耀。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'h1b_rfe_vs_parent_nag': {
    id: 'h1b_rfe_vs_parent_nag',
    title: '【周五噩梦】移民局 80 页 RFE 信遇到老妈 60 秒语音',
    description: '周五下午 4:55，律所律师发来紧急邮件：“USCIS 针对你的 H1B 发出了 Specialty Occupation RFE，质疑写前端 React 代码不需要计算机学士学位。”\n与此同时，你微信弹出老妈连续三条 60 秒语音：“隔壁王阿姨的小儿子在老家公务员双胞胎都两岁了！你整天在美利坚租房 4000 美金图个啥？！今年到底带不带女朋友回来？！”',
    choices: [
      {
        text: '通宵三个晚上，写出 120 页辩护报告阐述“为什么 Virtual DOM 调 CSS 属于高等应用数学”',
        condition: (s) => s.visa === 'H1B (工签)',
        effect: (s) => ({ health: Math.max(0, s.health - 25), visa: s.visa, message: '你用极具创造性的学术废话打动了移民局官员，成功保住了 H1B 身份！但你的头发掉了三分之一。' }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '直接把 RFE 截屏发给老妈：“妈，我在美国连狗都不如，随时可能被遣返，别催了，祈祷我别回老家啃老吧”',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: (s.charm || 10) + 1, message: '电话那头沉默了。老妈第二天默默给你转了 5000 人民币并附言：“儿子，实在不行咱们回省城考公”。耳朵清静了半年！' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'ai_wrapper_startup': {
    id: 'ai_wrapper_startup',
    title: 'Hayes Valley 的 AGI 革命',
    description: '在 Hayes Valley 的咖啡馆，一个穿着 Patagonia 背心的 Founder 凑过来。他宣称自己正在做“颠覆人类的 AGI”，但你发现他的产品只是个调 OpenAI API 的壳子。他邀请你加入当 CTO，开价 0 薪水 + 10% 期权（四年 Vesting），并让你立刻修一个 prompt injection 的 bug。',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: 'All in! 辞职加入，这波必成独角兽',
        effect: (s) => ({ 
          cash: s.cash - 5, 
          tc: 0, 
          job_type: 'startup',
          health: s.health - 20,
          message: '你辞去了大厂工作。熬夜修了三天 Bug 后，OpenAI 发布了新功能，直接把你们的产品做成了免费内置功能。公司破产了。'
        }),
        nextEventId: 'job_hunt',
        condition: (s) => s.tc > 0 && s.cash >= 5
      },
      {
        text: '投资 $10k，当个天使投资人',
        effect: (s) => {
          const success = Math.random() > 0.9;
          return success 
            ? { cash: s.cash + 100, charm: s.charm + 5, message: '离谱！这家公司莫名其妙被 Yahoo 收购了，你暴富了！' }
            : { cash: s.cash - 1, message: '几个月后这哥们去巴厘岛做数字游民了，你的投资打了水漂。' };
        },
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 1
      },
      {
        text: '冷笑一声，继续刷我的 LeetCode',
        effect: (s) => ({ 
          leetcode: s.leetcode + 5, 
          charm: s.charm - 1,
          message: '你懒得理他，默默 AC 了一道 Hard 题。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'friday_pip': {
    id: 'friday_pip',
    title: '周五下午四点的 1:1',
    description: '你的 Manager 突然在周五下午 4 点给你发了个 "Quick Sync" 的日历邀请。会上，他用着毫无感情的 corporate 语调表示你的 "impact" 没有 "move the needle"，并将你放入了为期 30 天的 Focus/PIP 计划。',
    choices: [
      {
        text: '【王牌证据反杀】拿出暗中备份的 40 页 Commit 与沟通记录直接上报 HR 与 VP！',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off && !!s.story_flags?.has_dave_evidence,
        hideIfUnavailable: true,
        reqBadge: '需 掌握证据链',
        effect: (s) => ({
          tc: s.tc + 5,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 3),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 0, status: 'nemesis', note: '被你反杀的职场宿敌' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            dave_defeated: true,
            dave_defeated_year: s.year
          },
          message: '【绝地反杀】HR 廉政合规调查组介入，查实该 PIP 属于恶意打击报复！你的 PIP 被当场撤销，Manager 被调岗，公司为你补发了绩效调薪！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '认怂疯狂加班，证明自己的 Synergy',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const isHighPipCompany = s.job_type === 'amazon' || s.company === 'amazon' || s.company === 'meta';
          const hasNetworkProtection = (s.network || 0) >= 30;
          const passProb = hasNetworkProtection ? 0.95 : (isHighPipCompany ? 0.55 : 0.80);
          const survived = Math.random() < passProb;
          return survived
            ? { 
                health: Math.max(0, s.health - 15), 
                network: Math.min(100, (s.network || 0) + 3),
                message: hasNetworkProtection 
                  ? '人脉发威！组里多位熟人大佬与总监联名向上层打包票，判定你成功走出 PIP！' 
                  : '你每天工作 16 小时狂补 Deliverables，终于熬过了 PIP 考核！但深感身心俱疲。' 
              }
            : { health: Math.max(0, s.health - 15), tc: 0, laid_off: true, job_type: 'unemployed', message: '你熬了几个通宵，最后还是被 Manager 找借口未达标开除了。' };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '选择拿钱走人 (Pivot / Buyout 离职包)，领 2 个月 Severance 在家刷题',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ 
          cash: s.cash + 4, 
          tc: 0, 
          laid_off: true,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 10),
          message: '【选择 Pivot 离职包】你不再和主管理论内耗，果断签字拿了 2 个月 Buyout 离职包 (+$4w) 体面走人！不再卷 PIP，压力瞬间释放！'
        }),
        nextEventId: (s) => (s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') ? 'layoff_hit' : 'job_hunt'
      },
      {
        text: '【工签紧急挂靠】启动 60 天 Grace Period 找外包公司办理 H1B Transfer (消耗 w)',
        condition: (s) => s.cash >= 2 && (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          cash: s.cash - 2,
          company: 'icc',
          job_type: 'startup',
          tc: Math.max(10, Math.floor(s.tc * 0.55)),
          health: s.health - 15,
          message: '外包中介连夜为你开具了紧急 Offer 办理了工签 Transfer！虽然总包大幅跳水，但你的 60 天合法身份警报成功解除！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【OPT / 工签转学自救】注册 Day 1 CPT 大学维持合法留美身份并刷题 (消耗 $1.5w)',
        condition: (s) => s.cash >= 1.5 && (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)' || s.visa === 'H1B (工签)') && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          tc: 0,
          laid_off: true,
          job_type: 'unemployed',
          cpt_used: true,
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对裁员与身份压力，你果断注册了 Day 1 CPT 大学维持合法学生身份并全职刷题准备下一轮求职，完全不受 60 天工签遣返威胁！'
        }),
        nextEventId: 'job_hunt'
      },
      {
        text: '【钞能力 EB-5 自救】掏出 $80w 办理新法 EB-5 并双递交 (I-485)，拿 EAD Combo 卡解除 PIP 危机！',
        reqBadge: '需现金>=80w+无绿卡',
        condition: (s) => s.cash >= 80 && s.visa !== '绿卡' && s.visa !== '公民' && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          cash: s.cash - 80,
          gc_progress: 4.5,
          gc_stage: 'i485_pending',
          tc: 0,
          laid_off: true,
          job_type: 'unemployed',
          message: '【EB-5 双递交成功】你不伺候了！直接出资 $80w 办理新法 EB-5 投资移民并 Concurrent Filing 递交 I-485。3 个月内顺利拿到 EAD Combo 自由工卡！虽然正式实体绿卡尚在调查制卡（进入 I-485 Pending），但你已彻底解除 60 天离境警报，拥有自由合法身份！'
        }),
        nextEventId: 'job_hunt'
      }
    ]
  },
  'biohacking_party': {
    id: 'biohacking_party',
    title: 'Atherton 的长寿教徒',
    description: '在 Atherton 的一个豪宅派对上，主人戴着三个智能指环，宣称自己把生物钟逆转到了 18 岁。他递给你一杯绿色的不明液体，说是他独家研发的“细胞级抗衰老矩阵精华”，只要 $500 一杯。',
    choices: [
      {
        text: '报名“长寿换血抗衰老”年度会员 (消耗 $50w)',
        effect: (s) => ({ 
          cash: s.cash - 50, 
          health: 100,
          message: '你花了 50 万美元。每个月都会有私人医生上门给你注射定制干细胞。你的身体仿佛回到了 18 岁，精力极其充沛！'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 50
      },
      {
        text: '买！一杯“细胞级精华” ($500) 尝尝鲜',
        effect: (s) => ({ 
          cash: s.cash - 0.05, 
          health: Math.min(100, s.health + 5),
          message: '你花了 $500 喝下这杯用香菜和不知名粉末榨的汁。别说，第二天在办公室写代码确实不困了。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 0.05
      },
      {
        text: '拒绝，并去厨房找多力多滋和可乐',
        effect: (s) => ({ 
          health: s.health - 2,
          charm: s.charm - 2, 
          message: '你在这个满是生酮饮食者的派对里大嚼碳水，被大家用异样的眼光注视。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '跟他探讨脑机接口，看能不能弄点融资',
        effect: (s) => ({ 
          charm: s.charm + 3,
          cash: s.cash + 10,
          message: '你成功用一些炫酷的词汇忽悠了他，他当场决定给你打钱让你帮他开发一个“量子睡眠追踪”App。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.charm > 5
      }
    ]
  },
  'burning_man_invite': {
    id: 'burning_man_invite',
    title: '火人节的召唤',
    description: '在 Dolores Park 晒太阳时，你的一群朋友（他们是一个住在 SOMA 三居室里的 6 人 Polycule / 开放式关系群体）邀请你加入他们的 Burning Man 营地。他们说这不仅是心灵的洗礼，还能结识顶级 VC。',
    choices: [
      {
        text: '去！拥抱尘土与自由！',
        effect: (s) => ({ 
          cash: s.cash - 1.5, 
          health: s.health - 15,
          charm: s.charm + 10,
          message: '你花了 1.5 万刀买装备。在黑石城的沙尘暴中，你不仅心灵得到了升华，还真的在某个变种车上认识了一个红杉资本的合伙人。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 1.5
      },
      {
        text: '算了吧，我还要在家 On-Call',
        effect: (s) => ({ 
          health: s.health + 5,
          cash: s.cash + (s.tc / 12),
          message: '你因为顶替他们做了假期的 On-Call 拿到了额外的 Bonus。但看着他们朋友圈的末日废土风照片，你流下了社畜的眼泪。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'stock_crash': {
    id: 'stock_crash',
    title: '美联储加息，宏观经济遇冷',
    description: '美股大盘全线暴跌，纳斯达克惨不忍睹。你的公司股价腰斩，导致你今年的 RSU 价值大幅缩水！',
    choices: [
      {
        text: '心在滴血，但也只能接受现实 (总包 TC 缩水 20%)',
        effect: (s) => ({
          tc: Math.floor(s.tc * 0.8),
          stocks: Math.floor((s.stocks || 0) * 0.75),
          macro_economy: 'bear',
          health: s.health - 15,
          message: '大盘大跌入熊市！打开券商账户看了一眼股票持仓蒸发 25%，你决定今年圣诞节改去家里蹲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '此时不博何时博？加杠杆抄底！(需现金 > 30w)',
        condition: (s) => s.cash >= 30,
        effect: (s) => {
           const winRate = 0.2 + (s.luck / 100) * 0.4; // 抄底成功率 20% - 60%
           const win = Math.random() < winRate;
           return win 
             ? { tc: Math.floor(s.tc * 0.9), stocks: Math.floor((s.stocks || 0) * 1.15), cash: s.cash + 35, message: '虽然宏观大盘熊市让基本薪酬受压，但你精准在最低点抄底了 AI 龙头，逆势吃到反弹波段大赚 $35w，股票市值也有所增值！' }
             : { tc: Math.floor(s.tc * 0.8), stocks: Math.floor((s.stocks || 0) * 0.70), cash: s.cash - 25, health: s.health - 30, message: '抄底抄在半山腰，现金和股票惨遭双杀，市场继续在深度熊市中煎熬。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'perf_review': {
    id: 'perf_review',
    title: '年底 Perf Review 绩效考核',
    description: '又到了公司一年一度的 PSC 绩效考核时间，大家都开始疯狂抢 Project Impact 争夺升职名额。',
    choices: [
      {
        text: '【稳扎稳打】加班抢项目 Impact (争取 L4 / L5 升职)',
        condition: (s) => {
          const isWorking = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          const cur = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          return isWorking && (cur === 'L3' || cur === 'L4');
        },
        effect: (s) => {
          const win = Math.random() < 0.45;
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          const isL3 = cur === 'L3';
          const tcIncrease = isL3 ? 3.5 : 6.5;
          const nextLevel = isL3 ? 'L4' : 'L5 (Senior)';
          return win 
            ? { health: Math.max(0, s.health - 12), tc: s.tc + tcIncrease, level: nextLevel, last_promo_age: s.age, message: ` 卷赢了！你拿到了 EE 绩效，成功晋升至 ${nextLevel}，总包调薪 +${tcIncrease} 万美元！` }
            : { 
                health: Math.max(0, s.health - 12),
                npcs: {
                  ...(s.npcs || {}),
                  dave: s.npcs?.dave || { name: 'Manager Dave', role: 'manager', affinity: 30, status: 'nemesis', note: '抢占你项目功劳的经理' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  has_dave_evidence: true,
                  dave_conflict_year: s.year
                },
                message: '你辛辛苦苦写的核心文档被 Manager Dave 拿去汇报抢了功劳！好在你暗中留存了全部 Jira Commit 与 Slack 截图证据链，等待时机反击！' 
              };
        },
        nextEventId: (s) => ((s.message || '').includes('晋升') ? 'promo_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【冲击 L6 Staff 架构师】主导跨组核心架构设计 (L5 升 L6 专属高门槛)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L5 (Senior)' || cur === 'L5') && s.leetcode >= 60 && (s.charm || 10) >= 12 && (s.network || 10) >= 20 && s.health >= 35 && s.tc >= 30;
        },
        reqBadge: '需 当前L5 & 算法≥60 & 魅力≥12 & 人脉≥20 & TC≥30w',
        costBadge: '消耗健康与高阶精力',
        effect: (s) => {
          const winRate = 0.08 + ((s.charm || 10) / 100) * 0.25 + ((s.network || 10) / 100) * 0.25 + (s.leetcode / 100) * 0.10;
          const win = Math.random() < winRate;
          return win 
            ? { level: 'L6 (Staff)', tc: s.tc + 12, health: Math.max(0, s.health - 20), last_promo_age: s.age, message: ' 奇迹破局！你在晋升委员会 (Promo Committee) 手撕核心架构与跨团队沟通，打破硅谷天花板顺利晋升为 L6 Staff Engineer！总包 (TC) 暴涨 +12 万美元！' }
            : { health: Math.max(0, s.health - 18), message: '晋升委员会否决了你的 L6 Staff 申请，认为你在部门影响力与政治 Sponsorship 上仍缺一把火。白卷了一整年。' };
        },
        nextEventId: (s) => ((s.level === 'L6 (Staff)' && (s.message || '').includes('晋升')) ? 'l6_staff_celebration' : ((s.message || '').includes('晋升') ? 'promo_celebration' : h1ToH2Router(s))),
      },
      {
        text: '【角逐 L7 Senior Staff 资深架构师】统领跨部门级核心技术战略与下一代基建 (L6 升 L7 专属)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L6 (Staff)' || cur === 'Staff' || cur === 'MTS') && s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35 && s.health >= 40 && s.tc >= 45;
        },
        reqBadge: '需 当前L6 & 算法≥70 & 魅力≥16 & 人脉≥35 & TC≥45w',
        costBadge: '消耗健康与高阶政治与战略心智',
        effect: (s) => {
          const winRate = 0.12 + ((s.charm || 10) / 100) * 0.20 + ((s.network || 10) / 100) * 0.20 + (s.leetcode / 100) * 0.08;
          const win = Math.random() < winRate;
          return win 
            ? { level: 'L7 (Senior Staff)', tc: s.tc + 20, health: Math.max(0, s.health - 25), last_promo_age: s.age, message: ' 战略封神！你在跨部门架构评审中凭借高层 VP Sponsor 撑腰与无可撼动的技术领导力，正式晋升为 L7 Senior Staff Engineer 资深架构师！总包 (TC) 狂飙 +20 万美元！' }
            : { health: Math.max(0, s.health - 22), message: '晋升委员会否决了你的 L7 Senior Staff 申请，认为你在高层政治阵营拉拢与全公司级战略视野上仍需深耕。白卷了一整年。' };
        },
        nextEventId: (s) => ((s.level === 'L7 (Senior Staff)' && (s.message || '').includes('晋升')) ? 'l7_senior_staff_celebration' : ((s.message || '').includes('晋升') ? 'promo_celebration' : h1ToH2Router(s))),
      },
      {
        text: '【登顶 L8 Principal 首席架构师】定义行业技术范式与下一代算力/模型标准 (L7 升 L8 终极天堑)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L7 (Senior Staff)' || cur === 'Senior Staff' || cur === 'L7') && s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50 && s.health >= 45 && s.tc >= 65;
        },
        reqBadge: '需 当前L7 & 算法≥80 & 魅力≥20 & 人脉≥50 & TC≥65w',
        costBadge: '消耗健康与终极政治心智',
        effect: (s) => {
          const winRate = 0.10 + ((s.charm || 10) / 100) * 0.15 + ((s.network || 10) / 100) * 0.15 + (s.leetcode / 100) * 0.05;
          const win = Math.random() < winRate;
          return win 
            ? { level: 'L8 (Principal)', tc: s.tc + 35, health: Math.max(0, s.health - 32), last_promo_age: s.age, message: ' 硅谷传世神话！你在董事会闭门答辩中赢得 CEO 与顶级投资人一致肯定，破格受聘为全公司屈指可数的 L8 Principal Engineer 首席架构师/技术院士！年薪总包与期权暴涨 (+$35w TC)！' }
            : { health: Math.max(0, s.health - 25), message: 'L8 职级名额受全公司顶层 Quota 严格限制，尽管你的产出极其卓越，但在董事会与高管派系答辩中仍以一票之差抱憾延期。白卷了一整年。' };
        },
        nextEventId: (s) => ((s.level === 'L8 (Principal)' && (s.message || '').includes('晋升')) ? 'l8_principal_celebration' : ((s.message || '').includes('晋升') ? 'promo_celebration' : h1ToH2Router(s))),
      },
      {
        text: '准点下班，躺平拿 Meets (保重身体)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'team_offsite': {
    id: 'team_offsite',
    title: ' Tahoe / Hawaii 部门 Team Offsite 免费团建大游',
    description: '部门老板今年预算充沛，全组飞往 Lake Tahoe 豪华雪山木屋与 Hawaii 夏威夷海滩，开启为期 3 天的公费 Team Offsite 度假！不用干活，全额报销，全组同事开启狂欢度假模式。',
    choices: [
      {
        text: '【打卡户外与极限运动】参加 Lake Tahoe 滑雪 / Hawaii 冲浪 & 纳帕酒庄品酒',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 1),
          message: '【爽玩雪山与海滩】打卡了顶级雪道与海滩冲浪！全额公费报销，身心得到了放松与充电 (健康 +10)！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【深夜酒吧与德州扑克】和组员喝精酿鸡尾酒、打德扑、聊湾区八卦与职场内幕',
        effect: (s) => ({
          network: Math.min(99, (s.network || 10) + 4),
          charm: Math.min(25, (s.charm || 10) + 2),
          health: Math.min(100, s.health + 5),
          message: '【八卦与社交收获】在晚宴酒桌与德扑桌上畅饮谈笑，拉近了与组内同事和小领导的关系 (人脉 +4, 魅力 +2)。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【奢华米其林与 SPA 纯躺平】睡到自然醒，吃爆公司全额报销的奢华海鲜米其林大餐',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          cash: s.cash + 0.2,
          message: '【公费惬意躺平】抛开一切工作 Slack 消息，在奢华度假村享受 SPA 与米其林大餐，身心得到了良好恢复 (健康 +12)。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'promo_celebration': {
    id: 'promo_celebration',
    title: ' 职级大晋升喜报！PROMOTION UNLOCKED',
    description: '轰动部门！鉴于你在公司核心业务中的突出 Impact，晋升委员会 (Promo Committee) 官方批准了你的职级晋升！',
    choices: [
      {
        text: '【欢呼庆祝】请团队喝 Boba 奶茶 & 继续奋斗',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ health: Math.min(100, s.health + 5), charm: s.charm + 1, message: `在全组同事的喝彩中，你正式挂上了 ${s.level} 的职级头衔，包裹与职场地位同步跃升！` }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'l6_staff_celebration': {
    id: 'l6_staff_celebration',
    title: ' 突破硅谷天花板！晋升 L6 Staff 架构师',
    description: '轰动全公司！你突破了 35 岁天花板与硅谷码农最大天堑，正式晋升为 L6 Staff Engineer 架构师！手握跨组技术决策权，年薪总包与期权迈入顶级行业前列。',
    choices: [
      {
        text: '【大摆宴席】在 Santana Row 举办全组升职庆功宴 (消耗 $0.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          health: Math.min(100, s.health + 20),
          charm: Math.min(25, s.charm + 5),
          message: '全组同事与 VP 亲临现场向你祝贺！你挂上了 L6 Staff 的终极胸牌，成为了湾区技术圈里的传奇神仙！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【深藏功名】保持低调，发小红书“L5 升 L6 心得与系统架构面经”',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 6),
          luck: Math.min(99, (s.luck || 20) + 10),
          message: '干货面经收割了数千赞！你被尊称为小红书与 Blind 上大佬级技术导师！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'l7_senior_staff_celebration': {
    id: 'l7_senior_staff_celebration',
    title: ' 跨部门战略统帅！晋升 L7 Senior Staff 资深架构师',
    description: '战略封神！你赢得了全公司高层 VP 的政治背书与全域架构指导权，破格批准晋升为 L7 Senior Staff Engineer 资深架构师！你的决策将深刻影响公司下一代技术路线图。',
    choices: [
      {
        text: '【包场庆祝】包下 Sand Hill Road 顶级会所与 VP 及顶级 Headhunter 畅饮 ($1.0w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.0),
          health: Math.min(100, s.health + 25),
          charm: Math.min(25, (s.charm || 10) + 6),
          network: Math.min(99, (s.network || 10) + 15),
          message: '全公司各条业务线的 VP 与顶级 VC 合伙人纷纷举杯致意！你已立于硅谷大厂高管与资深决策层的核心交汇点！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【学术发表】受邀在 IEEE / NeurIPS 发表顶会 Keynote 演讲',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 8),
          luck: Math.min(99, (s.luck || 20) + 12),
          message: '你的演讲在业界引起巨大轰动，行业内无数顶尖工程师与学生将你视作全领域技术偶像！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'l8_principal_celebration': {
    id: 'l8_principal_celebration',
    title: ' 硅谷传世神话！登顶 L8 Principal 首席架构师 / 技术院士',
    description: '硅谷巅峰至尊！你成功攻克终极天堑，在董事会答辩中获得 CEO、CTO 及顶级投资人全票推举，破格登顶 L8 Principal Engineer / Fellow 首席架构师！全公司数万人中仅有屈指可数的数位泰斗能臻此境！',
    choices: [
      {
        text: '【豪宅庄园庆功】在 Atherton / Los Altos Hills 庄园举办全公司高管慈善晚宴 ($2.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 2.5),
          health: Math.min(100, s.health + 30),
          charm: Math.min(25, (s.charm || 10) + 10),
          network: Math.min(99, (s.network || 10) + 20),
          message: 'CEO 亲自为你颁发公司终身荣誉技术院士奖章！在名流云集的庄园夜色中，你成为了硅谷华人史上无可争议的传世传奇！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【功成身退的从容】在 Los Altos Hills 豪宅中惬意品茶，各大顶级猎头与 VC 趋之若鹜',
        effect: (s) => ({
          health: Math.min(100, s.health + 30),
          cash: s.cash + 10,
          message: '你以科技泰斗之尊笑看风云。各大独角兽与 VC 抢着奉上顾问期权与咨询费，你已站在硅谷食物链的终极顶端！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'dating_market': {
    id: 'dating_market',
    title: '湾区婚恋交友 (CMB & 情感发展)',
    description: '湾区高压生活下，你打开了 Coffee Meets Bagel (CMB) 与朋友圈，开启属于你的情感阶段探索。',
    imageUrl: 'images/boba_date.jpg',
    choices: [
      {
        text: '【高端局】参加南湾高阶桌游与剧本杀局',
        reqBadge: '需 算法能力',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.leetcode >= 40,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'engineer', message: '【匹配成功】在激烈的狼人杀中，你敏锐的逻辑吸引了同为大厂码农的 TA。双方互加微信，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【看展看演出】去 SF MOMA 看展或看独立乐队演出',
        reqBadge: '需 出众形象',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.charm >= 15,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'artist', charm: Math.min(30, s.charm + 3), message: '【匹配成功】在昏暗的 Livehouse 里，你与一位在设计学院读书的文青对上了眼。你们聊了王家卫和坂本龙一，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【高端社交】混入沙丘路 VC 晚宴与红酒品鉴会',
        reqBadge: '需 雄厚财力',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.cash >= 50,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'vc', network: s.network + 10, message: '【匹配成功】你端着香槟在沙丘路的高端晚宴上侃侃而谈，成功吸引了一位年轻有为的 VC 投资人/创业大佬，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【周末交友】周末 Santana Row 喝奶茶 (Coffee Meets Bagel)',
        condition: (s) => !s.relationship_status || s.relationship_status === 'single',
        effect: (s) => {
          const winRate = 0.35 + (s.charm * 0.02) + (s.luck * 0.002) + (s.has_pet ? 0.20 : 0);
          const pass = Math.random() < winRate;
          return pass 
            ? { relationship_status: 'matched', partner_type: 'random', charm: Math.min(25, s.charm + 2), message: '【匹配成功】因为主页挂了滑雪和宠物照片，你成功匹配到了一位湾区打工人！双方聊得非常投机，进入 Matched 阶段！' }
            : { cash: Math.max(0, s.cash - 0.2), health: s.health - 5, message: '【匹配失败】连喝了三杯 Boba，对方一听你还没买房且身份未定，默默选择了 AA。你不仅花了钱还受到了真实伤害。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【情感升温】邀请对方一起去 Lake Tahoe 滑雪度假 (升温至 Dating)',
        condition: (s) => s.relationship_status === 'matched',
        reqBadge: '阶段：Matched',
        effect: (s) => {
          const isArtist = s.partner_type === 'artist';
          const pass = Math.random() < (isArtist ? 0.4 : 0.7); // 文青比较难搞
          return pass
            ? { relationship_status: 'dating', charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: `【正式确立关系】Tahoe 的雪景与小木屋篝火让两人的感情迅速升温！你们正式官宣成为湾区情侣 (Dating)！` }
            : { relationship_status: 'single', partner_type: undefined, health: s.health - 10, message: '【分道扬镳】滑雪途中因为路线分配和谁洗碗产生了严重分歧。回到湾区后双方互删，退回单身。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【走进婚姻】与伴侣在 Santa Clara 法院登记领证 (领证结婚)',
        condition: (s) => s.relationship_status === 'dating',
        reqBadge: '阶段：Dating',
        effect: (s) => {
          let bonusCash = 20;
          if (s.partner_type === 'engineer') bonusCash = 30; // 码农存款多
          if (s.partner_type === 'vc') bonusCash = 80; // 大佬超多钱
          if (s.partner_type === 'artist') bonusCash = 5; // 文青没钱
          
          return {
            relationship_status: 'married',
            is_married: true,
            cash: s.cash + bonusCash,
            message: `【领证结婚】恭喜！你们在法院正式登记结婚！两人合并了存款与工资 (+$${bonusCash}w 现金)，正式晋升为合法夫妻！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【豪车开局】开豪车直接闪婚 (单身直达结婚)',
        reqBadge: '需 保时捷/赛博皮卡',
        condition: (s) => (s.car === 'porsche' || s.car === 'cybertruck') && (s.relationship_status === 'single' || !s.relationship_status),
        effect: (s) => {
          return {
            relationship_status: 'married',
            partner_type: 'random',
            is_married: true,
            health: s.health - 15,
            message: '【豪车闪婚】你开着豪车在半月湾兜风，出众的个人吸引力让你在短短几个月内就完成了相识、热恋和闪婚！'
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '放弃交友，专心搞钱',
        condition: (s) => !s.is_married && s.relationship_status !== 'married',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '觉得相亲太累，你回到家里躺着刷了一整天 YouTube，感到内心十分平静。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'car_broken': {
    id: 'car_broken',
    title: '三藩市特产：零元购',
    description: '周末你开车去三藩市吃早茶，吃完回来发现自己的车窗被砸了，放在后座的 Macbook 被偷了。',
    choices: [

      {
        text: '报警认栽，自认倒霉',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.5), health: s.health - 10, message: '警察让你填了个表就没下文了，你花了 $5000 换玻璃和买新电脑。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '定位电脑，勇闯奥克兰黑市！',
        effect: (s) => {
          const win = Math.random() > 0.7;
          return win 
            ? { charm: s.charm + 2, cash: s.cash, message: '你像叶问一样一打十，从黑帮手里夺回了电脑，成为了湾区传说！' }
            : { health: s.health - 30, cash: Math.max(0, s.cash - 0.5), message: '你不仅没找回电脑，还被打了一顿，医药费花了好几千。' };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'visa_check': {
    id: 'visa_check',
    title: 'H1B 被 Check',
    description: '你回国探亲，顺便去大使馆签证，结果喜提行政审查 (Check)，签证官冷漠地扔给你一张黄条。',
    choices: [
      {
        text: '在国内每天熬夜，按美国时间远程上班',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ health: s.health - 30, cash: s.cash, imageUrl: 'images/visa_denied.jpg', message: '你昼夜颠倒地干了两个月，头发掉光了，但保住了工作。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '管他呢，直接请无薪假在国内到处旅游！',
        condition: (s) => s.cash >= 20 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ cash: s.cash - 20, health: s.health + 30, leetcode: s.leetcode - 10, imageUrl: 'images/visa_denied.jpg', message: '你顺便打卡了三亚和新疆，身体是养好了，但是现金流大幅缩水，算法也生疏了。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【绿卡/公民免检】出示美国护照/绿卡，免除检查直接入境',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: () => ({ message: '海关人员核验了你的永久居民/公民身份，热情祝你生活愉快！' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'layoff_rumor': {
    id: 'layoff_rumor',
    title: 'Blind 裁员谣言',
    description: '有一天，Blind 上传出你们部门要被整个裁掉的消息，人心惶惶。',
    choices: [

      {
        text: '疯狂加班，讨好 Manager 试图留下',
        effect: (s) => {
          let surviveRate = 0.4;
          if (s.leetcode >= 80) surviveRate = 0.8;
          const win = Math.random() < surviveRate;
          return win 
            ? { health: s.health - 20, cash: s.cash, message: '你没日没夜地干活，终于在这个裁员季活了下来，但距离 Burnout 只有一步之遥。' }
            : { health: s.health - 10, cash: s.cash, laid_off: true, tc: 0, job_type: 'unemployed', message: '不管你怎么卷，你们整个组都被端了。你被裁员了！' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : h1ToH2Router(s),
      },
      {
        text: '立刻开始刷题，准备后路',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 10, cash: s.cash, message: '你偷偷在上班时间刷题。果不其然，你被裁了，但你已经做好了准备。' }),
        nextEventId: 'layoff_hit',
      }
    ]
  },
  'h1b_final_crisis': {
    id: 'h1b_final_crisis',
    title: 'H1B 三抽不中 (绝境危机)',
    description: '连续三年 H1B 抽签全军覆没！你的 STEM OPT 即将到期，公司 HR 和律所发来最终通知：必须在 30 天内解决合法身份，否则将被终止合同并安排外派离境！',
    choices: [
      {
        text: '【婚姻绿卡自救】与伴侣领证结婚，递交 I-130/I-485 婚姻绿卡',
        condition: (s) => (s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married || (s.charm || 10) >= 15) && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const hasRealPartner = s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married;
          const win = hasRealPartner || Math.random() < 0.75;
          return win
            ? { visa: '绿卡', gc_progress: 5, gc_stage: 'approved', is_married: true, relationship_status: 'married', message: '【婚姻绿卡获批】在绝境中你与伴侣正式领证结婚并提交了婚姻绿卡申请，彻底解除了身份危机！' }
            : { status: 'game_over', message: '移民局严肃调查判定为虚假婚姻，你被当场遣返回国并终身禁入美国，游戏结束！' };
        },
        nextEventId: (s: GameState) => s.status === 'game_over' ? 'end' : 'post_green_card',
      },
      {
        text: '【学业自救】紧急注册 Day 1 CPT 大学维持合法学生身份并继续工作 (消耗 .5w)',
        condition: (s) => s.cash >= 1.5 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          cpt_used: true,
          message: '【无缝接轨 Day 1 CPT】虽然 STEM OPT 耗尽，但你成功挂靠了 Day 1 CPT 大学，白天写代码晚上交作业，成功维持合法留美身份并继续抽签！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '砸 w 现金找顶级律所紧急加急办理 O1 杰出人才签证 (需现金 >= w, 限 PhD或硬核算法背景)',
        reqBadge: '现金>=8w+超凡背景',
        condition: (s) => (s.is_phd || s.leetcode >= 85 || s.job_type === 'ai_research') && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const pass = Math.random() < (s.is_phd ? 0.70 : 0.35);
          return pass
            ? { cash: s.cash - 8, visa: 'O1 (杰出人才)', message: '律师极其硬核！通过挖掘你在论文和核心架构中的亮点，成功压线批准了 O1 签证！绝地求生！' }
            : { cash: s.cash - 8, health: Math.max(0, s.health - 15), message: '移民局严肃驳回了 O1 申请，w 律师费彻底打了水漂...' };
        },
        nextEventId: (s: GameState) => s.visa === 'O1 (杰出人才)' ? 'sv_daily_life' : 'h1b_final_crisis',
      },
      {
        text: '【钞能力自救】全额出资办理新法 EB-5 投资移民绿卡 (花费 w)',
        reqBadge: '现金>=80w',
        condition: (s) => s.cash >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - 80, message: '在绝境中你果断出资 w 办妥新法 EB-5 投资移民绿卡！彻底解决在美身份枷锁！' }),
        nextEventId: 'post_green_card',
      },
      {
        text: '接受外派温哥华/多伦多 L1 办公室 (曲线救国)',
        costBadge: '免费外派',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: 'L1 (外派)',
          l1_relocated: true,
          message: '你转到了温哥华分公司，凭 L1 签证曲线救国保住了工作！一年后顺利申请调回湾区 Headquarters！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'post_green_card': {
    id: 'post_green_card',
    title: '绿卡到手：硅谷新篇章',
    description: '身份的枷锁解除后，你发现硅谷的烦恼并没有结束。现在的你面临着人生新的十字路口。',
    choices: [

      {
        text: '砸 300 万现金全款买下 Atherton 顶级学区豪宅！(消耗 300 万 · 可用股票抵扣)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 300,
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - 300, rent: 0, has_housing: true, housing_name: 'Atherton 顶级豪宅', charm: Math.min(25, s.charm + 15), health: 100, message: '你买下了传说中硅谷大佬们扎堆的 Atherton 豪宅！现在你周末可以在自己的大别野里开 Pool Party，享受真正的人生赢家生活！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '继续在 Open House 现场观望挑房 (回到日常行动)',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', message: '你看了一圈全现金竞价的疯狂现场，决定再冷静观察观察宏观降息走向。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '搞副业炒股：梭哈英伟达 (NVDA)！',
        effect: (s) => {
          const winProb = 0.25 + (Math.min(45, s.luck) / 150);
          const win = Math.random() < winProb;
          return win
            ? { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash + Math.min(120, Math.floor(s.cash * 0.6)), message: '皮衣黄刀法精准！英伟达业绩大超预期，你的股票投资获得了巨额收益！' }
            : { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: Math.max(1, Math.floor(s.cash * 0.6)), health: s.health - 15, message: '买在了高位... 监管禁令导致大厂股票大幅回撤。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '辞职！凭多年大厂的技术积累直接搞 AI Startup',
        effect: (s) => {
          const success = s.leetcode >= 50 && Math.random() < 0.3;
          return success
            ? { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', age: s.age + 1, cash: s.cash + 200, tc: 0, rent: 4, message: '你带着前沿的 AI 理念获得了顶级风投 A 轮融资！手里的股权市值飙升！' }
            : { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', age: s.age + 1, cash: Math.max(0, s.cash - 20), health: s.health - 20, message: '创业太烧钱了，大模型算力成本高昂，产品还没盈利资金见底，你只能重回大厂。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '不再唯唯诺诺，开始在职场上重拳出击',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', charm: Math.min(25, s.charm + 3), message: '你拿着身份特权不再受气，在组会上直接反驳不合理的 Deadline。' }),
        nextEventId: 'office_politics',
      },
      {
        text: '彻底摆烂，佛系上班',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', health: Math.min(100, s.health + 30), cash: s.cash + 10, age: s.age + 2, message: '你开始掌握精湛的职场太极，每天做最少的工作拿足额工资，把精力花在周末去 Tahoe 滑雪上。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'buy_house': {
    id: 'buy_house',
    title: '宇宙中心加价抢房大乱斗',
    description: '湾区房地产 Open House 现场挤满了手里攥着支票簿的华裔和印度裔工程总监。中介微笑着告诉你：“已经收到了 14 个 No-Contingency 全现金 Offer，你准备加价多少？”',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '抢 Sunnyvale 70年代加州单层老破小 SFH (首付 $45w, 每年地税/房贷消耗低) - 湾区做题家神房',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 45,
        effect: (s) => ({ cash: s.cash - 45, rent: 1.5, has_housing: true, housing_name: 'Sunnyvale 老破小', health: s.health + 10, imageUrl: 'images/house.jpg', message: '虽说是 1974 年木板老破小且地板走起来吱吱响，但地大 7500 尺能开辟菜园种葱，去 Apple Park 和 Googleplex 只要 12 分钟！做题家终极神房落地！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '买 North San Jose 现代挑高高密度 Townhouse (首付 $40w, 年供折算 $2.5w) - 颜值极高的小红书美宅',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 40,
        effect: (s) => ({ cash: s.cash - 40, rent: 2.5, has_housing: true, housing_name: 'North San Jose 联排', charm: Math.min(25, s.charm + 5), message: '全套智能家电、石英石大理石中岛！虽然贴着 neighbor 抽油烟机且每月要上缴 $550 恶心 HOA 费，但每天拍 home decor 发小红书点赞爆表！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '攻下 Fremont Mission San Jose 9分顶配学区房 (首付 $65w, 年负担 $4.5w) - 卷二代的终极战场',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 65,
        effect: (s) => ({ cash: s.cash - 65, rent: 4.5, has_housing: true, housing_name: 'Fremont 学区房', charm: Math.min(25, s.charm + 4), luck: s.luck + 10, message: '为了娃彻底豁出去了！隔壁邻居全是高强度卷 AMC10 和卡内基梅隆机器人夏令营的硅谷老爹，社区图书馆周末全是解题小孩，神教合一！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '向国内父母紧急开支票（掏空六个钱包跨国电汇凑齐首付）',
        condition: (s) => (s.cash + (s.stocks || 0)) < 40 && !s.parents_helped_house,
        effect: (s) => ({ cash: 0, has_housing: true, housing_name: 'Sunnyvale 老破小', health: s.health - 15, parents_helped_house: true, message: '父母卖掉了国内老家二线城市的房子跨国电汇给你凑齐了 Sunnyvale 首付，你背上了深沉的愧疚包袱与巨额房贷。' }),
        nextEventId: 'house_slave',
      },
      {
        text: '资金暂时不足 / 观望行情，先返回日常行动攒钱',
        effect: () => ({ message: '你看了一眼加价疯狂且竞争白热化的湾区房市，决定等现金流更充裕时再做打算。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'house_slave': {
    id: 'house_slave',
    title: '沉重的房贷生活',
    description: '通过父母举债六个钱包交齐首付买下 Sunnyvale 老破小后，每年固定房屋供税支出让手头极度紧绷。你决定怎么应对接下来的挑战？',
    choices: [
      {
        text: '老老实实上班，咬牙扛住房贷（进入日常行动）',
        effect: (s) => ({ rent: 2.2, has_housing: true, housing_name: 'Sunnyvale 老破小', health: Math.max(0, s.health - 5), message: '你把心安在了加州木板老破小里，虽然房贷沉重，但每次看到属于自己的草坪，干劲又回来了！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '把次卧与车库偷偷出租给转码留学生（每年回血 $1.5w 被动现金流）',
        effect: (s) => {
          const badTenant = Math.random() > 0.65;
          return badTenant
            ? { rent: 1.2, has_housing: true, housing_name: 'Sunnyvale 老破小', has_adu_rented: true, rental_income: (s.rental_income || 0) + 1.0, health: Math.max(0, s.health - 15), message: '留学生搞加密货币挖矿弄跳闸了电闸还开派对，虽然收了租金 (+$1.0w/年)，但把你折腾得够呛。' }
            : { rent: 0.8, has_housing: true, housing_name: 'Sunnyvale 老破小', has_adu_rented: true, rental_income: (s.rental_income || 0) + 1.5, message: '好运！留学生是 CMU 学霸，安静极少下厨还按时交租，为你带来稳定被动租金 (+1.5w/年)！' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '断供卖房！回归租房生活的自由',
        condition: (s) => s.cash < 50,
        effect: (s) => ({ cash: s.cash + 35, has_housing: false, housing_name: '普通合租单间', rent: 2, health: s.health + 10, message: '你最终无力支付房贷被迫断供卖房。虽亏掉了前期本金，但你卸下了深沉包袱，重新拿回流动资金回到出租屋。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '感觉人生一眼望到头，卖房去创业！(要求 100 万现金)',
        condition: (s) => s.cash >= 100,
        effect: (s) => ({ cash: s.cash - 50, message: '你受够了温水煮青蛙，卖了房子拿着巨资投入到了创业大潮中！' }),
        nextEventId: 'startup_work',
      }
    ]
  },
  'manage_rental_properties': {
    id: 'manage_rental_properties',
    title: '房产投资与资产管理中心',
    description: '在硅谷与全美优质学区配置投资性不动产，打造无惧科技裁员周期的终极被动现金流（Passive Rental Income）！',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【自住房改造】搭建后院 ADU 独立套间并出租 (耗费 $1.5w · 产生 +$2.0w/年 租金净流)',
        costBadge: '花费 $1.5w',
        condition: (s) => s.has_housing && !s.has_adu_rented && (s.cash + (s.stocks || 0)) >= 1.5 && ['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房', 'Atherton 顶级豪宅'].includes(s.housing_name || ''),
        effect: (s) => ({
          cash: s.cash - 1.5,
          has_adu_rented: true,
          rental_income: (s.rental_income || 0) + 2.0,
          message: '【ADU 改造完成】你在后院建起了一套带独立卫浴的预制 ADU，挂在 Zillow 上第一天就被隔壁大厂实习生秒签！每年稳定产生 +$2.0w 净租金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【外州远程投资】购入 Austin/Seattle 精装独栋别墅 (首付 $25w · 产生 +$2.2w/年 租金净流)',
        costBadge: '首付 $25w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 25 && !(s.investment_properties || []).includes('Austin 远程独栋屋'),
        effect: (s) => ({
          cash: s.cash - 25,
          rental_income: (s.rental_income || 0) + 2.2,
          investment_properties: [...(s.investment_properties || []), 'Austin 远程独栋屋'],
          message: '【外州资产配置】借助全美远程物业托管，你在德州 Austin 核心科技园区拿下了一套独栋屋，租给 Tesla/Apple 工程师，每年被动落袋 +$2.2w 纯现金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【湾区核心投资】购入东湾 Hayward/Fremont 独栋出租房 (首付 $45w · 产生 +$3.8w/年 租金净流)',
        costBadge: '首付 $45w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 45 && !(s.investment_properties || []).includes('Hayward 独立投资房'),
        effect: (s) => ({
          cash: s.cash - 45,
          rental_income: (s.rental_income || 0) + 3.8,
          investment_properties: [...(s.investment_properties || []), 'Hayward 独立投资房'],
          message: '【湾区核心资产】拿下东湾优质通勤独立屋！坐收湾区刚需码农家庭租金，每年稳健产生 +$3.8w 租金现金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【大地主终极资产】全款/杠杆拿下 Sunnyvale 4-Plex 核心多户公寓楼 (首付 $120w · 产生 +$11.0w/年 巨额租金)',
        costBadge: '首付 $120w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 120 && !(s.investment_properties || []).includes('Sunnyvale 4-Plex 公寓楼'),
        effect: (s) => ({
          cash: s.cash - 120,
          rental_income: (s.rental_income || 0) + 11.0,
          investment_properties: [...(s.investment_properties || []), 'Sunnyvale 4-Plex 公寓楼'],
          charm: Math.min(25, (s.charm || 10) + 5),
          message: '【加州大地主登顶】你拿下了 Sunnyvale 黄金地段 4 套相连的公寓楼！光靠收租每年就能躺赚 +$11.0w 净现金流，彻底告别打工内卷！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '返回日常行动',
        effect: () => ({ message: '你审视了名下的资产组合与租金收益，决定稳健经营现金流。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'fire_milestone_choice': {
    id: 'fire_milestone_choice',
    title: '硅谷奇迹：达成财务自由 (FIRE)',
    description: '看着银行账户与股票投资组合上的数字突破了既定目标，你深吸了一口气。曾经在 LeetCode 上死磕的深夜、在工位上焦灼等待 H1B/PERM 排期的日子，终于在此刻结出了丰硕的果实。你已经拥有了随时登出硅谷内卷的底气！接下来，你打算怎么选择？',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【见好就收 · 立即退休】宣布提前退休，正式登出硅谷内卷（进入人生胜利结算）',
        costBadge: '终局胜利',
        effect: (s) => ({
          status: 'win',
          message: `【FIRE 胜利退休】你在 ${s.age} 岁正式宣布提前退休！总资产达到 $${(s.cash + (s.stocks || 0)).toFixed(1)}w，再也不需要看任何 Manager 与排期的脸色，开启了环游世界与自由探索的璀璨余生！`
        }),
        nextEventId: 'end',
      },
      {
        text: '【继续生活 · 探索舒适 FIRE 目标 ($800w)】留在硅谷享受生活，配置不动产与高端资产',
        condition: (s) => (s.cash + (s.stocks || 0)) < 800,
        effect: (s) => ({
          has_reached_initial_fire: true,
          win_threshold: 800,
          fire_tier: 'comfortable',
          health: Math.min(100, s.health + 20),
          message: '【进入自由探索模式】你决定留在湾区继续享受生活与打拼！新的阶梯目标设定为 $800w 舒适 FIRE（尽情体验跑车豪宅、投资房与多元人生）。'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【登顶硅谷 · 冲刺奢华 FIRE 目标 ($1500w+)】追逐顶级独角兽与 Atherton 庄园',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 800,
        effect: (s) => ({
          has_reached_initial_fire: true,
          win_threshold: 1500,
          fire_tier: 'luxury',
          health: Math.min(100, s.health + 20),
          message: '【豪门巨鳄模式】你的雄心已超越普通打工人！向着 $1500w 奢华 FIRE 与硅谷顶层名流进军！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【无畏追梦 · 辞职创立 AI 独角兽】手握充沛本金，去沙丘路拉融资改变世界！',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 200,
        effect: (s) => ({
          has_reached_initial_fire: true,
          win_threshold: 1500,
          fire_tier: 'luxury',
          job_type: 'startup_founder',
          laid_off: false,
          health: Math.min(100, s.health + 10),
          message: '【创办独角兽】你拿着充裕的启动资金辞职创业，正式成立 AI Agent 独角兽公司，开启传奇创始人之路！'
        }),
        nextEventId: 'startup_work',
      }
    ]
  },
  'tahoe_ski_blizzard': {
    id: 'tahoe_ski_blizzard',
    title: '【冬日浩劫】 Tahoe 暴雪警报与 I-80 公路 9 小时生死大堵车',
    description: '周五下午 3:15，Slack 上的 #skiing 频道与微信群全炸了：“Tahoe 今晚开大雪，明早 Pow 天雪质爆满！”你急忙合上电脑，把滑雪板扣进车顶箱狂飙出门。然而刚到 Truckee，I-80 公路突然由于暴雪启动了 Chain Control (强制雪链停摆检查)，成千上万台 Tesla 和斯巴鲁卡在雪堆里动弹不得。',
    choices: [
      {
        text: '硬着头皮睡车里！启动特斯拉营地模式或开足暖气在车厢睡袋硬扛',
        effect: (s) => ({
          health: Math.max(15, s.health - 10),
          cash: Math.max(0, s.cash - 0.2),
          luck: Math.min(99, (s.luck || 20) + 6),
          message: '你在后备箱睡袋里吃着打折冷蛋白棒堵了整整 9 个小时。第二天早晨 7:30 铲雪车终于打通道路，你抢到了 Heavenly 缆车头把梯，在大草海滑到了无痕绝美头粉！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '识时务者为俊杰！果断掉头在 Sacramento 找快捷酒店吃自热火锅',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 15),
          charm: s.charm + 1,
          message: '你看着微信群同学在雪里冻得瑟瑟发抖求援救援车，自己在大床房里吃着海底捞自热火锅打黑神话，完成了最明智标准的湾区反向避险骚操作。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'meta_tlm': {
    id: 'meta_tlm',
    title: 'Meta TLM 卷王之王',
    description: '在 Meta，你不进则退。当上 Tech Lead Manager 后，手下管着 5 个人，每天被拉进无数个群，晚上 11 点还在回复印度总监的邮件。',
    choices: [
      {
        text: '继续卷升职 (冲击下一级别)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const win = Math.random() > 0.3; // 70% 成功率
          return win 
            ? { tc: s.tc + 30, cash: s.cash + s.tc, health: s.health - 20, imageUrl: 'images/burnout.jpg', message: `你干掉了同组的竞争对手，成功拿到了顶格绩效并升职！当前 TC 达到 ${s.tc + 30}w，包裹极大，但你的身体严重透支。` }
            : { health: s.health - 15, imageUrl: 'images/burnout.jpg', message: '辛辛苦苦卷了一年，名额却被空降的 VP 亲信抢走了。' };
        },
        nextEventId: (s) => s.health <= 0 ? 'end' : h1ToH2Router(s),
      },
      {
        text: '太累了，降薪跳槽去 Google/Apple 养老',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ tc: Math.max(20, s.tc - 20), company: 'google', health: Math.min(100, s.health + 20), message: '你受够了 Meta 的高压，降薪跳槽去了以 WLB 著称的养老大厂。虽然包裹大幅缩水，但终于有了生活。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'office_politics': {
    id: 'office_politics',
    title: '职场宫心计 (Office Politics)',
    description: '没了绿卡约束，你决定在公司大干一场。现在公司空出了一个 Director 的位子，你的竞争对手是深谙 PPT 之道的印度同事 Raj。',
    choices: [
      {
        text: '疯狂写代码，用硬实力说话',
        effect: (s) => ({ health: Math.max(0, s.health - 20), charm: Math.max(0, (s.charm || 10) - 2), message: 'Raj 用你写的硬核代码做了一份精美的 PPT 向上汇报，他获得了晋升。虽然你被边缘化，但你依然手握绿卡拿着高薪大包稳坐工位。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '放下 IDE，打开 PPT 开始高强度向上管理',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => s.charm >= 12
          ? { tc: (s.tc || 0) + 15, cash: s.cash + 15, charm: Math.min(25, s.charm + 2), message: '你顿悟了硅谷“向上管理”的精髓，精美 PPT 加上社交手腕打动了 VP，成功升职加薪！' }
          : { health: Math.max(0, s.health - 25), charm: Math.max(0, s.charm - 2), message: '缺乏社交情商，你的汇报被对手挑出毛病，功劳全被同事占了。' },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'layoff_hit': {
    id: 'layoff_hit',
    title: '不幸被裁 (裁员风暴)',
    description: '不幸遭遇了湾区科技公司大厂裁员潮，你抱着个人物品箱退出了 Slack。面对突如其来的失业与身份倒计时，请选择你的应对策略：',
    imageUrl: 'images/layoff_box.jpg',
    choices: [
      {
        text: '【美籍/绿卡玩家专属】领取 Severance 遣散费，全职刷题无忧备战',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 8,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 15),
          leetcode: Math.min(100, s.leetcode + 15),
          message: '手握美籍/绿卡无所畏惧！你拿到了 3 个月 Severance 遣散费 (+$8w)，在家一边散步一边刷题，从容准备下一家大厂 Offer！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【美籍/绿卡玩家专属】申请加州 EDD 失业金，休假半年放空身心',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 3,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 25),
          message: '领着加州 EDD 官方失业补贴，你顺便休假半年去 Lake Tahoe 滑雪，心态极度放松！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【强力人脉救援】联系 LinkedIn 熟人总监直通内部免试 referral 上岸',
        reqBadge: '需深厚熟人关系',
        condition: (s) => (s.network || 0) >= 35,
        effect: (s) => {
          const rescueCompanies = [
            { company: 'google', name: 'Google' },
            { company: 'apple', name: 'Apple' },
            { company: 'meta', name: 'Meta' },
            { company: 'microsoft', name: 'Microsoft' }
          ];
          const rescue = rescueCompanies[Math.floor(Math.random() * rescueCompanies.length)];
          return {
            tc: Math.max(22, s.tc || 22),
            company: rescue.company,
            job_type: 'big_tech',
            laid_off: false,
            health: Math.min(100, s.health + 10),
            network: Math.min(100, (s.network || 0) + 5),
            message: `人脉发威！你的熟人总监收到求助后连夜开绿灯将你内推拉入 ${rescue.name} 团队，跳过倒计时直接上岸！`
          };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【F-1 / OPT 身份】利用 90/150 天失业期额度疯狂刷题，火速投递 E-Verify 新公司',
        condition: (s) => s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)',
        effect: (s) => {
          const pass = s.leetcode >= 45 || Math.random() < 0.55;
          return pass
            ? { tc: 20, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 1), health: Math.max(0, s.health - 15), message: '【OPT 成功上岸】利用 90 天 OPT 失业期窗口，你的算法实力征服了面试官，火速拿下支持 E-Verify 的新 Offer，成功延续 OPT 身份！' }
            : { status: 'game_over', message: '90 天 OPT 失业期耗尽，且未能及时挂靠转学，SEVIS 状态失效被迫登机回国。' };
        },
        nextEventId: (s) => s.laid_off ? 'end' : 'sv_daily_life',
      },
      {
        text: '【F-1 / OPT 转学自救】失业期告急，紧急注册 Day 1 CPT 大学维持 SEVIS 身份 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          cpt_used: true,
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对 OPT 失业期倒计时，你果断注册了 Day 1 CPT 大学维持合法留美学生身份，从容全职刷题准备下一轮跳槽面试！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【H-1B 工签身份】利用 60 天 H1B Grace Period 极限刷题办理 H1B Transfer',
        condition: (s) => s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)',
        effect: (s) => {
          const pass = s.leetcode >= 55 || Math.random() < 0.50;
          return pass
            ? { tc: 22, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 2), health: Math.max(0, s.health - 20), message: '【工签 Transfer 成功】有惊无险！凭高超算法在 60 天限期内火速入职新公司并成功办理 H1B Transfer 保住工签！' }
            : { status: 'game_over', message: '没能在 60 天 H1B Grace Period 内找到支持 Visa Transfer 的新工作，工签身份到期被迫登机离境。' };
        },
        nextEventId: (s) => s.laid_off ? 'end' : 'sv_daily_life',
      },
      {
        text: '【工签紧急挂靠】60 天倒计时逼近，找外包 ICC 公司办理 H1B Transfer 挂靠 (消耗 w)',
        condition: (s) => (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && s.cash >= 2,
        effect: (s) => ({
          cash: s.cash - 2,
          company: 'icc',
          tc: 14,
          laid_off: false,
          job_type: 'startup',
          health: Math.max(0, s.health - 10),
          message: '外包中介连夜为你开具了紧急 Offer 办理了 H1B Transfer！虽然总包大打折扣，但你的 60 天工签遣返警报成功解除！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【工签转 Day 1 CPT】转为学生身份就读 Day 1 CPT 避险，全职备战大厂 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          cpt_used: true,
          leetcode: s.leetcode + 15,
          message: '你将身份转为 Day 1 CPT 维持合法停留，解除 60 天遣返倒计时，开始全职闭关刷题！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【Day 1 CPT 专属】学籍在册无离境倒计时压力，边上课边全职刷题求职',
        condition: (s) => s.visa === 'Day 1 CPT',
        effect: (s) => ({
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【学籍保护】由于你早已挂靠在 Day 1 CPT 大学，完全不受 60 天工签驱逐威胁！你按部就班上课并全职刷题准备下一家面试。'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【钞能力 EB-5 自救】全额出资申办 EB-5 投资移民并递交 I-485 拿 Combo 卡 (花费 $80w)',
        reqBadge: '现金>=80w',
        condition: (s) => s.cash >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: '绿卡',
          gc_progress: 5,
          gc_stage: 'approved',
          cash: s.cash - 80,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          message: '凭雄厚资金实力，全额出资 $80w 办妥新法 EB-5 投资移民绿卡！彻底甩开所有身份枷锁，自由留美找工！'
        }),
        nextEventId: 'post_green_card',
      }
    ]
  },
  'cn_work': {
    id: 'cn_work',
    title: '国内大厂体验期',
    description: '你在国内大厂打工攒钱，积累硬核工程经验与算法能力，为后续赴美做准备。',
    choices: [
      {
        text: '【打工攒钱】积累赴美存款 (积累 $8w 存款)',
        effect: (s) => ({
          health: Math.max(25, s.health - 12),
          cash: s.cash + 8,
          age: s.age + 1,
          year: s.year + 1,
          leetcode: s.leetcode + 15,
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '国内研发',
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '无',
          message: '你在国内大厂打工一年攒下了 8 万美金存款，算法与硬核项目经验有了显著提升！'
        }),
        nextEventId: (s) => s.health <= 25 ? 'cn_burnout' : 'cn_work',
      },
      {
        text: '【申请美硕】拿着积蓄申请美国 CS 硕士 (顺利赴美)',
        condition: (s) => s.cash >= 4,
        effect: (s) => ({
          cash: s.cash - 4,
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
          company: undefined,
          job_type: undefined,
          level: undefined,
          tc: 0,
          school: 'state',
          has_us_degree: true,
          is_master: true,
          age: s.age,
          message: '拿着打工攒下的第一桶金，你顺利通过签证与录取，踏上了赴美求学之路！'
        }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【跨海直投 / 驻外调动】凭硬核技术与论文申请赴美/外派 (需算法/美籍/L1调动)',
        condition: (s) => s.leetcode >= 50,
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'L1 (外派)',
          tc: 22,
          company: 'google',
          job_type: 'big_tech',
          level: 'L4',
          laid_off: false,
          cash: s.cash + 5,
          age: s.age + 1,
          year: s.year + 1,
          message: (s.visa === '公民' || s.visa === '绿卡')
            ? '凭美籍/绿卡身份优势，你免受签证束缚直接飞赴硅谷入职 Google！'
            : '陆本硬核算法发威！你拿到了外派 Offer，先以 L1 身份入职海外分公司，一年后调动回湾区总部！'
        }),
        nextEventId: (s) => (s.visa === '公民' || s.visa === '绿卡') ? 'job_hunt' : 'sv_daily_life',
      }
    ]
  },
  'cn_burnout': {
    id: 'cn_burnout',
    title: '职场调养：体检警示',
    description: '长期加班让你的身体有点疲惫，公司医疗保险为你提供了全面的体检与休养支持。',
    choices: [
      {
        text: '公司医保大部分报销治病休养 (花费 1 万美元)',
        effect: (s) => ({ cash: Math.max(0, s.cash - 1), health: Math.min(100, s.health + 40), age: s.age + 1, year: s.year + 1, message: '在医保绝大部分报销后，你休养了半个月恢复了健康！' }),
        nextEventId: 'cn_work'
      },
      {
        text: '趁机申请美硕离开 (留学贷款 + TA 助教，需评估项目背景与算法)',
        reqBadge: '需算法/背景评估',
        effect: (s) => {
          const pass = (s.leetcode >= 20) || (Math.random() < 0.50 + (s.luck / 200));
          return pass
            ? { cash: Math.max(0, s.cash - 2), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', age: s.age, health: Math.min(100, s.health + 20), message: ' 申请成功！凭借在国内大厂积累的工程项目经历，你顺利通过无抵押贷款审核与 Master 录取，开启赴美新生活！' }
            : { health: s.health - 10, message: ' 申请被拒！留学贷款机构与校方评估认为你负债风险过高，贷款未获批准。你只能留在本地继续调养或打工。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('赴美新生活') ? 'us_master_year1' : 'cn_work'
      }
    ]
  },
  'job_hop_market': {
    id: 'job_hop_market',
    title: '湾区跳槽季：多重 Offer 抉择',
    description: '经历了数轮密集的 Onsite 面试与薪酬谈判 (Negotiation)，猎头与各大厂 HR 陆续向你发来了意向沟通。\n\n【注意】若你的 I-140 尚未批准，跳槽将导致当前 PERM 废弃重办；刚跳槽大厂通常伴随高压 Ramp-up 考验。请根据当前宏观市场与自身状态慎重抉择：',
    choices: [
      {
        text: '【跳槽 Google】降压养老，享受顶尖 WLB、美味食堂与稳健股票 (需算法达标)',
        condition: (s) => s.company !== 'google',
        effect: (s) => {
          const req = s.macro_economy === 'bear' ? 60 : s.macro_economy === 'bull' ? 35 : 45;
          const passProb = s.leetcode >= req ? 0.85 : (0.35 + (s.leetcode / 120));
          const pass = Math.random() < Math.min(0.90, passProb);

          if (!pass) {
            return {
              health: Math.max(0, s.health - 12),
              message: `【面试遗憾折戟】当前市场环境要求算法>=${req}。Google 最后一轮 Hiring Committee 认为你的架构设计深度略有欠缺，未发 Offer。你只能留任原厂。`
            };
          }

          const curLevel = s.level || (s.is_phd ? 'L4' : 'L3');
          const nextLvl = curLevel === 'L3' ? 'L4' : curLevel === 'L4' ? 'L5 (Senior)' : curLevel === 'L5 (Senior)' ? 'L6 (Staff)' : curLevel === 'L6 (Staff)' ? 'L7 (Senior Staff)' : curLevel === 'L7 (Senior Staff)' ? 'L8 (Principal)' : curLevel;
          const baseBand = nextLvl === 'L8 (Principal)' ? 120 : nextLvl === 'L7 (Senior Staff)' ? 82 : nextLvl === 'L6 (Staff)' ? 58 : nextLvl === 'L5 (Senior)' ? 42 : nextLvl === 'L4' ? 30 : 22;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 4, Math.floor(baseBand * econMultiplier));

          return {
            company: 'google',
            job_type: 'big_tech',
            level: nextLvl,
            tc: newTC,
            health: Math.min(100, s.health + 12),
            is_new_job: true,
            message: `【成功入职 Google】顺利入职山景城 Googleplex！享受顶级养老福利与免费美食，职级调整至 ${nextLvl}，总包锁定为 ${newTC}w！`
          };
        },
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【跳槽 Meta】加入卷王之王，挑战高压核心架构冲刺顶格 Package (需算法>=60)',
        condition: (s) => s.company !== 'meta',
        effect: (s) => {
          const req = s.macro_economy === 'bear' ? 75 : s.macro_economy === 'bull' ? 50 : 60;
          const passProb = s.leetcode >= req ? 0.80 : (0.25 + (s.leetcode / 150));
          const pass = Math.random() < Math.min(0.85, passProb);

          if (!pass) {
            return {
              health: Math.max(0, s.health - 18),
              message: `【Meta 面试被挂】当前市场环境要求算法>=${req}。在 Meta 严苛的 45 分钟两道 Hard 题极限编码中遇到 Bug 卡壳，面试未过。你只能留任原公司。`
            };
          }

          const curLevel = s.level || (s.is_phd ? 'L4' : 'L3');
          const nextLvl = curLevel === 'L3' ? 'L4' : curLevel === 'L4' ? 'L5 (Senior)' : curLevel === 'L5 (Senior)' ? 'L6 (Staff)' : curLevel === 'L6 (Staff)' ? 'L7 (Senior Staff)' : curLevel === 'L7 (Senior Staff)' ? 'L8 (Principal)' : curLevel;
          const baseBand = nextLvl === 'L8 (Principal)' ? 135 : nextLvl === 'L7 (Senior Staff)' ? 92 : nextLvl === 'L6 (Staff)' ? 65 : nextLvl === 'L5 (Senior)' ? 46 : nextLvl === 'L4' ? 34 : 25;
          const econMultiplier = s.macro_economy === 'bull' ? 1.20 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 6, Math.floor(baseBand * econMultiplier));

          return {
            company: 'meta',
            job_type: 'big_tech',
            level: nextLvl,
            tc: newTC,
            cash: s.cash + (s.macro_economy === 'bull' ? 8 : 4),
            health: Math.max(0, s.health - 18),
            is_new_job: true,
            message: `【卷入 Meta 核心架构】手握硬核代码通过委员会审核！职级跃升至 ${nextLvl}，总包大幅飙升至 ${newTC}w！但新人高压 Oncall 让你身心紧绷 (健康 -18)。`
          };
        },
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【跳槽 NVIDIA】加入显卡巨头，吃满 AI 算力与芯片狂飙红利',
        condition: (s) => s.company !== 'nvidia',
        effect: (s) => {
          const req = s.macro_economy === 'bear' ? 65 : 45;
          const passProb = s.leetcode >= req ? 0.80 : 0.40;
          const pass = Math.random() < passProb;

          if (!pass) {
            return {
              health: Math.max(0, s.health - 12),
              message: '【英伟达面试未过】芯片底层驱动与 CUDA 并行加速系统设计问题未能打动面试官，遗憾被拒。你继续留任原职。'
            };
          }

          const isBull = s.macro_economy === 'bull' || s.year >= 2023;
          const curLevel = s.level || (s.is_phd ? 'L4' : 'L3');
          const nextLvl = curLevel === 'L3' ? 'L4' : curLevel === 'L4' ? 'L5 (Senior)' : curLevel === 'L5 (Senior)' ? 'L6 (Staff)' : curLevel === 'L6 (Staff)' ? 'L7 (Senior Staff)' : curLevel === 'L7 (Senior Staff)' ? 'L8 (Principal)' : curLevel;
          const boost = isBull 
            ? (nextLvl === 'L8 (Principal)' ? 20 : nextLvl === 'L7 (Senior Staff)' ? 15 : nextLvl === 'L6 (Staff)' ? 11 : nextLvl === 'L5 (Senior)' ? 7 : 4) 
            : (nextLvl === 'L8 (Principal)' ? 14 : nextLvl === 'L7 (Senior Staff)' ? 10 : nextLvl === 'L6 (Staff)' ? 7 : nextLvl === 'L5 (Senior)' ? 4 : 2);

          return {
            company: 'nvidia',
            job_type: 'nvidia',
            level: nextLvl,
            tc: s.tc + boost,
            cash: s.cash + (isBull ? 4 : 2),
            is_new_job: true,
            message: isBull
              ? `【赶上 AI 芯片大风口】皮衣黄显卡霸权！你拿到了高 RSU 占比的 NVIDIA 芯片团队包裹，职级晋至 ${nextLvl}，年薪总包调至 ${(s.tc + boost).toFixed(1)}w！`
              : `【入职英伟达】成功入职芯片团队，职级调整至 ${nextLvl}，拿到稳健的软硬件结合包裹 (+${boost}w TC)！`
          };
        },
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【跳槽 TikTok / 字节】接手中美跨时区核心业务，拿顶格现金包裹',
        condition: (s) => s.company !== 'tiktok',
        effect: (s) => {
          const req = s.macro_economy === 'bear' ? 55 : 40;
          const pass = (s.leetcode >= req) || Math.random() < 0.65;

          if (!pass) {
            return {
              health: Math.max(0, s.health - 10),
              message: '【TikTok 面试卡壳】高并发算法设计未完全符合标准，遗憾被拒。你继续留任原职。'
            };
          }

          const curLevel = s.level || (s.is_phd ? 'L4' : 'L3');
          const nextLvl = curLevel === 'L3' ? 'L4' : curLevel === 'L4' ? 'L5 (Senior)' : curLevel === 'L5 (Senior)' ? 'L6 (Staff)' : curLevel === 'L6 (Staff)' ? 'L7 (Senior Staff)' : curLevel === 'L7 (Senior Staff)' ? 'L8 (Principal)' : curLevel;
          const boost = nextLvl === 'L8 (Principal)' ? 40 : nextLvl === 'L7 (Senior Staff)' ? 26 : nextLvl === 'L6 (Staff)' ? 18 : nextLvl === 'L5 (Senior)' ? 12 : 8;

          return {
            company: 'tiktok',
            job_type: 'big_tech',
            level: nextLvl,
            tc: s.tc + boost,
            cash: s.cash + 10,
            health: Math.max(0, s.health - 18),
            is_new_job: true,
            message: `【入职字节跳动】字节开出巨额全现金 Sign-on 奖金！职级挂至 ${nextLvl}，总包提升至 ${(s.tc + boost).toFixed(1)}w！但深夜跨时区对齐让你睡眠严重不足 (健康 -18)。`
          };
        },
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【跳槽 OpenAI / AI 实验室】加入 AGI 最前沿，拿到天价 MTS 架构师包裹 (需算法>=75 或 PhD)',
        condition: (s) => s.company !== 'openai',
        effect: (s) => {
          const isEligible = s.leetcode >= 75 || s.is_phd;
          if (!isEligible) {
            return {
              health: Math.max(0, s.health - 15),
              message: '【门槛不足】OpenAI 简历筛选极度严苛，要求顶会论文背景或 80+ 极致算法，你的简历在初筛阶段被拒。'
            };
          }

          const passProb = (s.is_phd ? 0.70 : 0.40) + (s.macro_economy === 'bull' ? 0.15 : 0);
          const pass = Math.random() < passProb;

          if (!pass) {
            return {
              health: Math.max(0, s.health - 15),
              message: '【终面惜败】在关于大模型 MoE 路由与分布式通信优化的终极架构面试中遗憾惜败，未能入职 OpenAI。'
            };
          }

          return {
            company: 'openai',
            job_type: 'ai_research',
            level: 'MTS',
            tc: Math.max(s.tc + 22, 68),
            cash: s.cash + 8,
            health: Math.max(0, s.health - 10),
            is_new_job: true,
            message: `【斩获 OpenAI MTS 天价大包】顶级行业光环！你以 Member of Technical Staff 身份加入前沿大模型团队，TC 跃升至 ${Math.max(s.tc + 22, 68)}w！`
          };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【跳槽 AI Startup 初创团队】降薪赌一把早期核心员工期权大饼 (高风险高回报)',
        condition: (s) => s.job_type !== 'startup',
        effect: (s) => ({
          company: 'startup',
          job_type: 'startup',
          stocks: (s.stocks || 0) + 18,
          tc: Math.max(16, Math.floor(s.tc * 0.85)),
          health: Math.max(0, s.health - 10),
          is_new_job: true,
          message: '【加入 AI Startup】你接受了一家顶级风投领投的早期初创团队 Offer！虽然现金略微下调，但分到了极其丰厚的早期期权股份！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【跳槽 Apple】加入库比蒂诺巨头，享受极致稳定性与顶尖硬件生态 (需算法达标)',
        condition: (s) => s.company !== 'apple',
        effect: (s) => {
          const req = s.macro_economy === 'bear' ? 60 : 40;
          const pass = (s.leetcode >= req) || Math.random() < 0.75;

          if (!pass) {
            return {
              health: Math.max(0, s.health - 10),
              message: '【Apple 面试未过】底层系统优化与架构设计未能完全打动面试委员会，遗憾留任原职。'
            };
          }

          const curLevel = s.level || (s.is_phd ? 'L4' : 'L3');
          const nextLvl = curLevel === 'L3' ? 'L4' : curLevel === 'L4' ? 'L5 (Senior)' : curLevel === 'L5 (Senior)' ? 'L6 (Staff)' : curLevel === 'L6 (Staff)' ? 'L7 (Senior Staff)' : curLevel === 'L7 (Senior Staff)' ? 'L8 (Principal)' : curLevel;
          const baseBand = nextLvl === 'L8 (Principal)' ? 125 : nextLvl === 'L7 (Senior Staff)' ? 86 : nextLvl === 'L6 (Staff)' ? 60 : nextLvl === 'L5 (Senior)' ? 44 : nextLvl === 'L4' ? 32 : 24;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 5, Math.floor(baseBand * econMultiplier));

          return {
            company: 'apple',
            job_type: 'big_tech',
            level: nextLvl,
            tc: newTC,
            health: Math.min(100, s.health + 10),
            is_new_job: true,
            message: `【入职 Apple Park】顺利通过库比蒂诺架构团队审核！职级跃升至 ${nextLvl}，锁定年薪总包 ${newTC}w！享受极佳的稳定性与员工折扣！`
          };
        },
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【拿 Competing Offer 原地 Match】拿着外部 Offer 找现任老板谈薪，就地加薪并保留原厂排期',
        effect: (s) => ({
          tc: s.tc + 4.5,
          health: Math.min(100, s.health + 5),
          message: '【成功 Counter-Offer】老板为了挽留你连夜向 HR 申请了特别加薪 (+4.5w TC)！你零搬迁成本、零 PERM 重置风险，继续在原厂稳步发展！'
        }),
        nextEventId: midYearEventRouter,
      }
    ]
  },

  'icc_work': {
    id: 'icc_work',
    title: 'ICC 挂靠',
    description: '你在 ICC 拿着微薄的薪水，随时可能被开除。',
    choices: [

      {
        text: '偷偷刷题，准备跳槽大厂',
        effect: (s) => ({ leetcode: s.leetcode + 40, health: s.health - 20, age: s.age + 1 }),
        nextEventId: 'job_hunt',
      }
    ]
  },
  'startup_work': {
    id: 'startup_work',
    title: '初创公司风云',
    description: '你加入了一家 Early-Stage Startup，一个人干三个人的活。现在的风向变了，关于公司的发展方向：',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '坚守传统赛道 (如 SaaS / Web3 工具)',
        effect: (s) => {
          let winRate = 0.15;
          if (s.year >= 2020 && s.year <= 2022) winRate = 0.30;
          const win = Math.random() < winRate; 
          return win 
            ? { cash: s.cash + 60, message: '稳扎稳打！公司被大厂收购了，你的期权兑现了 $60w 现金！' }
            : { cash: Math.max(0, s.cash - 5), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸，你不得不重新进入求职市场。' };
        },
        nextEventId: (s) => (s.message || '').includes('收购') ? 'sv_daily_life' : 'job_hunt',
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型架构',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: Math.max(0, s.cash - 10), health: s.health - 20, laid_off: true, job_type: 'unemployed', tc: 0, message: `在 ${s.year} 年盲目跟风 AI 概念缺乏底层研发，产品无人问津，公司资金链断裂倒闭，你重新失业。` };
          }
          const win = Math.random() < 0.18;
          return win 
            ? { cash: s.cash + 35, stocks: (s.stocks || 0) + 45, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '绿卡', gc_progress: 5, gc_stage: 'approved', imageUrl: 'images/ai_startup.jpg', message: '踩中 AI 风口！公司拿到巨额融资，你的期权大幅升值，获赠 $35w 现金与 $45w 股票资产，顺便拿到了 EB-1 绿卡！' }
            : { cash: Math.max(0, s.cash - 10), health: s.health - 20, laid_off: true, job_type: 'unemployed', tc: 0, imageUrl: 'images/layoff_box.jpg', message: '转型太慢，被巨头连夜更新的接口直接背刺干死了...连夜抱起铺盖重新刷题求职。' };
        },
        nextEventId: (s) => (s.message || '').includes('绿卡') ? 'post_green_card' : 'job_hunt',
      }
    ]
  },

  'phd_life': {
    id: 'phd_life',
    title: '北美读博：学术民工',
    description: '你拿着每年 3 万美元的 stipend，看着去湾区打工的本科同学已经换了保时捷。你的老板极度 push，凌晨两点还在群里圈你改 Paper。',
    choices: [
      {
        text: '熬！硬发顶会 (耗时 2 年)',
        effect: (s) => {
          const pass = Math.random() < 0.50; // 50% paper acceptance chance
          return pass 
            ? { age: s.age + 2, health: Math.max(0, s.health - 10), leetcode: Math.min(100, s.leetcode + 20), message: '两年的昼夜颠倒，你的论文终于有了一些突破性的进展，老板决定带你去夏威夷参加顶级学术会议！' }
            : { age: s.age + 2, health: Math.max(0, s.health - 12), message: '论文惨遭拒稿连环背刺，实验数据全崩，你陷入了深深的自我怀疑。' };
        },
        nextEventId: (s) => ((s.message || '').includes('夏威夷') ? 'phd_conference' : 'phd_life')
      },
      {
        text: '太累了！跟导师请假去 Yosemite 营地休养放松 (健康 +15, 耗时 1 年)',
        effect: (s) => ({ health: Math.min(100, s.health + 15), age: s.age + 1, message: '你暂时放下了科研压力，去 Yosemite 森林露营徒步，身心逐渐恢复健康！' }),
        nextEventId: 'phd_life'
      },
      {
        text: '老板太坑了，我要 Master Out (拿个硕士跑路求职)',
        effect: (s) => ({ age: s.age + 1, health: Math.min(100, s.health + 15), message: '你及时止损，认清了自己不适合做学术，拿着硕士学位重回求职大军。' }),
        nextEventId: 'job_hunt'
      }
    ]
  },
  'phd_conference': {
    id: 'phd_conference',
    title: '夏威夷学术顶会 (CVPR/NeurIPS)',
    description: '你在夏威夷的会场做完了 Poster 展示。接下来几天，你打算怎么安排？',
    choices: [
      {
        text: '疯狂 Network，结识学术大牛 (耗时 3 年顺利毕业)',
        effect: (s) => ({ charm: s.charm + 5, age: s.age + 3, health: s.health - 10, is_phd: true, leetcode: s.leetcode + 20, message: '你成功给几位学术大佬留下了深刻印象。回到学校后，你顺利完成了 Defense，拿到了沉甸甸的 PhD 学位！' }),
        nextEventId: 'phd_job_hunt'
      },
      {
        text: '去海滩冲浪放飞自我 (引起老板不满，延毕 1 年)',
        effect: (s) => ({ health: s.health + 20, charm: s.charm + 5, age: s.age + 4, is_phd: true, leetcode: s.leetcode + 10, message: '你在海滩上玩疯了，没参加老板组织的组会。老板很生气，多留了你一年才放你毕业。' }),
        nextEventId: 'phd_job_hunt'
      }
    ]
  },
  'phd_job_hunt': {
    id: 'phd_job_hunt',
    title: '博士求职 (降维打击)',
    description: '顶着 AI 方向 PhD 的光环，你进入了人才市场。这不再是一般的刷题找工作，而是直接面 Research 岗位。',
    choices: [
      {
        text: '申请 OpenAI / Anthropic 核心研究员 (地狱面试, 胜率约 25%)',
        effect: (s) => {
          // Remove 100% auto win exploit! Base pass chance 22%, bonus up to 20% for high leetcode
          const winRate = 0.22 + (s.leetcode >= 80 ? 0.18 : 0.08) + (s.charm >= 15 ? 0.05 : 0);
          const win = Math.random() < winRate;
          return win
            ? { tc: 80, cash: s.cash + 20, health: s.health - 20, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'openai', job_type: 'ai_research', level: 'MTS', message: '震撼硅谷！你攻克了 AGI 前沿推理大模型面试，OpenAI 直接用 $80w 顶配包裹和 O1 签证把我聘为核心研究员！' }
            : { health: s.health - 20, message: 'OpenAI 核心研究员面试太残酷了！不仅手撕 Triton 算子还深考系统对齐论文，你很遗憾没能拿到 Offer。好在顶级大厂抢着要你的 PhD 光环！' };
        },
        nextEventId: (s: GameState) => {
          if (s.tc < 45 && !s.job_type) return 'job_hunt';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '去大厂当 Applied Scientist (应用科学家)',
        effect: (s) => ({ tc: 45, cash: s.cash + 15, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'google', job_type: 'ai_research', level: 'L5', message: '大厂的科学家岗位待遇丰厚，不用写 CRUD，直接解决核心算法问题，生活相对安稳。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家','加州湾区老宅'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      }
    ]
  },


  'startup_crisis': {
    id: 'startup_crisis',
    title: '初创危机',
    description: '你的 Startup 最近融资不太顺利，账上的钱只够发 3 个月工资了。',
    choices: [
      {
        text: '相信老板的 PPT，自愿降薪换取更多期权 (博取小概率收购变现)',
        effect: (s) => {
          const win = Math.random() < 0.05;
          return win 
            ? { cash: s.cash + 150, message: ' 奇迹爆发！公司被大厂以数亿美元溢价收购，你的早期期权直接兑现 $150w 现金！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, job_type: 'unemployed', message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('收购') ? h1ToH2Router(s) : 'job_hunt',
      },
      {
        text: '【带资领投】自己掏 $10w 领投公司 Seed 轮自救',
        reqBadge: '现金>=10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => {
          const win = Math.random() < 0.25;
          return win
            ? { cash: s.cash + 60, tc: s.tc + 10, message: '你带资入组！公司靠你的资金撑到了 A 轮融资并估值大暴涨，你的 TC 与期权收益双双上涨！' }
            : { cash: s.cash - 10, tc: 0, laid_off: true, job_type: 'unemployed', health: s.health - 20, message: '砸进去的 $10w 没能挽救寒冬，公司还是倒闭了...你不仅没了工作还心痛不已。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '偷偷骑驴找马，准备跑路',
        effect: (s) => ({ health: s.health - 5, tc: 0, cash: s.cash, laid_off: true, job_type: 'unemployed', message: '你一边假装努力工作，一边偷偷刷题。不久后公司果然资金链断裂，你不得不重新找工作。' }),
        nextEventId: 'job_hunt',
      }
    ]
  },
  'ai_research_crisis': {
    id: 'ai_research_crisis',
    title: 'AGI 的脚步',
    description: '最近 OpenAI 又发了新模型，你在实验室里的项目面临被降维打击的危险。',
    choices: [
      {
        text: '抢占先机，连夜写 Paper 冲击顶会！',
        effect: (s) => {
          const win = Math.random() < (0.55 + s.leetcode / 300);
          return win 
            ? { tc: s.tc + 25, cash: s.cash + 30, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', charm: Math.min(25, s.charm + 4), health: s.health - 20, message: ' 论文斩获 NeurIPS Best Paper！你提出的推理大模型架构震惊学术界与工业界！公司立刻发了 $30w Retention Bonus 并协助加急批复了 O1 签证！' }
            : { health: s.health - 25, cash: s.cash, message: '熬了半个月，结果撞车了别人的工作被直接 Reject，心态炸裂。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '佛系跟进，不争不抢',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '反正公司也不差你这一个项目，你按时下班，每天看着同事们卷生卷死。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'quant_stress': {
    id: 'quant_stress',
    title: '华尔街的脉搏',
    description: '最近股市剧烈波动，你的量化策略出现了巨大的 Drawdown (回撤)。',
    choices: [
      {
        text: '顶着高压，手动干预策略并加大杠杆！(45% 概率获得 $250w 巨额 Bonus)',
        effect: (s) => {
          const win = Math.random() < 0.45;
          return win 
            ? { cash: s.cash + 250, health: s.health - 25, message: ' 华尔街之狼！这波疯狂杠杆让你单月帮基金出海捕捞暴赚！老板亲手为你颁发了 $250w 美金的年终 Bonus 巨额支票！' }
            : { cash: Math.max(0, s.cash - 15), health: s.health - 30, laid_off: true, tc: 0, job_type: 'unemployed', message: '黑天鹅爆发！杠杆爆仓导致策略穿仓，不仅 Bonus 归零，你还收到了 HR 的解雇协议。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '相信数学，不干预策略 (求稳退守)',
        effect: (s) => ({ health: s.health - 10, cash: s.cash + 15, message: '虽然每天看着回撤心惊肉跳，但你还是忍住了干预的冲动。最终策略慢慢回本，年底拿到了小额 Bonus。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'dental_emergency': {
    id: 'dental_emergency',
    title: '突发：智齿发炎',
    description: '你的智齿突然发炎，痛得满地打滚，必须拔除。',
    choices: [
      {
        text: '在湾区看牙医',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ cash: s.cash - 0.5, health: s.health + 10, message: '拔了两颗智齿，虽然有保险，但自付额还是高达 $5000，美国医疗名不虚传。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '买机票回国拔牙！',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: s.cash - 0.2, health: s.health + 20, message: '机票 $1500，拔牙只要 200 块人民币！顺便还能吃顿火锅，身心愉悦！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '吃布洛芬硬抗 (免费)',
        effect: (s) => ({ health: s.health - 20, message: '为了省钱你选择了硬抗，结果引发了感染，痛不欲生。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'crypto_scam': {
    id: 'crypto_scam',
    title: '微信群里的财富密码',
    description: '一个高中同学突然拉你进了一个 Web3 交流群，里面的人天天晒豪车和几十倍收益的截图。',
    choices: [
      {
        text: '搏一搏，单车变摩托！投入 $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const winRate = 0.01 + (Math.min(45, s.luck) / 100) * 0.15;
          const win = Math.random() < winRate;
          return win 
            ? { cash: s.cash + 15, message: '你买的土狗币居然真的小火了一把！你在高点果断卖出提现，狠赚了一笔！' }
            : { cash: Math.max(0, s.cash - 5), health: Math.max(0, s.health - 7), imageUrl: 'images/crypto_crash.jpg', message: '经典的杀猪盘。项目方第二天就跑路了，你的钱全都变成了空气币。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '天上不会掉馅饼，退群保平安',
        effect: (s) => ({ charm: s.charm + 1, message: '你敏锐地察觉到了这是骗局，并且在小红书上发帖曝光，获得了不少点赞。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'xhs_boba': {
    id: 'xhs_boba',
    title: '小红书探店日常',
    description: '周末不知道干什么，你打开小红书，看到首页全在推南湾新开的一家“绝绝子”网红奶茶店。',
    choices: [
      {
        text: '跟风去排队！并在小红书打卡发帖',
        effect: (s) => {
          const viral = Math.random() > 0.8;
          return viral 
            ? { charm: s.charm + 10, health: s.health + 10, cash: Math.max(0, s.cash - 0.0015), message: '排队 2 小时买到了。你随手拍的照片加了滤镜发到小红书，居然成了爆款！涨粉 1000 人，极大地满足了虚荣心。' }
            : { health: s.health - 10, cash: Math.max(0, s.cash - 0.0015), message: '在烈日下排队 2 小时，喝了一口发现又贵又难喝，纯纯智商税。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '去大厂食堂薅羊毛拿免费气泡水',
        effect: (s) => ({ health: s.health + 2, cash: s.cash + 0.1, message: '你拒绝被消费主义洗脑。周末假装去公司加班，从 MicroKitchen (MK) 顺走了两罐 La Croix 气泡水和几包零食，完美解决下午茶。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },
  'change_rental': {
    id: 'change_rental',
    title: '重新选择湾区租房',
    description: '身价与年薪变了，是时候调整你的固定住房开支与居住体验了。',
    choices: [
      {
        text: '豪华 1b1b (每年 4 万美元): 泳池健身房与全职门卫, 提振相亲社交',
        condition: (s) => s.cash >= 4 || s.tc >= 18,
        effect: (s) => ({ rent: 4, charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 15), housing_name: 'San Jose 高级公寓', message: '你搬进了带无边泳池的高级公寓！生活质量飙升！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比极高的湾区中产标准',
        effect: (s) => ({ rent: 2, housing_name: 'Cupertino 2b2b合租', message: '你搬进了 Cupertino 经典的双主卧合租公寓，省钱又方便。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '挂壁大客厅隔间 (每年 1 万美元): 极致压低开销狂攒首付/防破产',
        effect: (s) => ({ rent: 1, charm: Math.max(0, s.charm - 2), health: Math.max(0, s.health - 10), housing_name: '客厅屏风隔间', message: '你搬回了客厅屏风隔间，将每年固定的房租开销砍到了极致。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '终极挂壁：连夜退租！搬进特斯拉/租用 Van 里睡车顶 (房租归零 $0/年)',
        condition: (s) => !!(s.car && s.car !== 'none'),
        effect: (s) => ({ rent: 0, housing_name: '特斯拉 睡车顶', health: Math.max(0, s.health - 15), message: '你把睡袋卡式炉扔进车后备箱，正式开启硬核湾区车顶睡袋生活！房租彻底归零！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '算了，目前的房子住得挺好，不搬了',
        effect: (s) => ({ message: '你打消了搬家念头。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'end': {
    id: 'end',
    title: '游戏结束',
    description: '你的硅谷人生模拟旅程已经达成终局结算。',
    choices: [
    ]
  },
  'trader_annual_strategy': {
    id: 'trader_annual_strategy',
    title: '【全职 Day Trader】年度操盘策略选择',
    description: '作为全职 Trader，你不再依靠大厂发放的固定工资。今年的美股/加密货币市场波谲云诡，你打算采用哪种操盘策略？',
    choices: [
      {
        text: '【稳健对冲股息策略】主要布局标普500/高股息 ETF 与跨期对冲期权 (低风险)',
        effect: (s) => {
          const isBear = s.macro_economy === 'bear';
          const isBull = s.macro_economy === 'bull';
          const baseRate = isBull ? 0.10 : (isBear ? -0.04 : 0.06);
          const luckRate = ((s.luck || 20) / 1000);
          const gainRate = baseRate + luckRate;
          const profit = s.cash * gainRate;
          const cappedTc = Math.max(0, Math.min(30, parseFloat(profit.toFixed(1))));
          
          if (profit >= 0) {
            return {
              mid_year: true, season_stage: 'h1',
              tc: cappedTc,
              health: Math.max(0, s.health - 4),
              message: ` 稳健盈利！凭借严谨的风控与股息配置，本年度操盘收益率 +${(gainRate * 100).toFixed(1)}% (+${cappedTc}w 美元生活提取)！`
            };
          } else {
            const loss = Math.min(Math.abs(profit), 20);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(5, s.cash - loss),
              health: Math.max(0, s.health - 6),
              message: ` 熊市震荡！宏观大盘整体回调，对冲仓位受损 -${loss.toFixed(1)}w 美元。好在你严格止损，保住了绝大部分主力资金。`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【重仓科技龙头股票】梭哈英伟达 (NVDA) / 特斯拉 / AI 芯片龙头 (中风险)',
        effect: (s) => {
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.60 : (isBear ? 0.35 : 0.48);
          const isWin = Math.random() < winRate;
          if (isWin) {
            const gain = Math.min(45, s.cash * 0.30);
            return {
              mid_year: true, season_stage: 'h1',
              tc: parseFloat(gain.toFixed(1)),
              health: Math.max(0, s.health - 6),
              message: ` 飞天暴赚！你重仓的 AI 科技巨头股价随着算力风口暴涨！账面盈利 +${gain.toFixed(1)}w 美元！`
            };
          } else {
            const loss = Math.min(s.cash * 0.20, 30);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(8, s.cash - loss),
              health: Math.max(0, s.health - 10),
              message: ` 宏观回调！科技板块遭遇资金阶段性获利砸盘，仓位回调 -${loss.toFixed(1)}w 美元！`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高杠杆末日期权】重仓 0DTE 末日期权与 Web3 杠杆博弈 (极高风险)',
        effect: (s) => {
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.40 : (isBear ? 0.18 : 0.28);
          const roll = Math.random();
          if (roll < winRate) {
            const doubleGain = Math.min(60, s.cash * 0.50);
            return {
              mid_year: true, season_stage: 'h1',
              tc: parseFloat(doubleGain.toFixed(1)),
              health: Math.max(0, s.health - 10),
              message: ` 奇迹大胜！末日期权精准抓中财报暴涨行情，本金暴赚 +${doubleGain.toFixed(1)}w 美元！`
            };
          } else if (roll < winRate + 0.40) {
            const drop = Math.min(s.cash * 0.30, 40);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(5, s.cash - drop),
              health: Math.max(0, s.health - 12),
              message: ` 惨遭反杀！黑天鹅剧烈波动导致期权权利金归零，本金大撤退 -${drop.toFixed(1)}w 美元！`
            };
          } else {
            const bust = Math.min(s.cash * 0.55, 60);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(2, s.cash - bust),
              health: Math.max(0, s.health - 15),
              message: ` 极端爆仓！杠杆触发强制平仓连环踩踏，数十万本金瞬间灰飞烟灭！你欲哭无泪，备受精神打击...`
            };
          }
        },
        nextEventId: h1ToH2Router,
      }
    ]
  },
  'founder_annual_strategy': {
    id: 'founder_annual_strategy',
    title: '【全职 Founder】公司战略与轮次推进',
    description: '作为初创公司 CEO，你手下带着十几名员工，烧钱率与公司生命线全掌握在你手里。请决定本年度的核心战略：',
    choices: [
      {
        text: '前往 Sand Hill Road (沙丘路) 向顶级 VC 演示 Pitch 寻求融资',
        reqBadge: '需丰富人脉或出众形象',
        condition: (s) => (s.network || 0) >= 20 || (s.charm || 0) >= 18,
        effect: (s) => {
          const stage = s.founder_stage || 'seed';
          const ecoBonus = s.macro_economy === 'bull' ? 0.20 : s.macro_economy === 'bear' ? -0.20 : 0;
          const networkBonus = Math.min(0.20, (s.network || 0) / 100);
          const charmBonus = Math.min(0.15, (s.charm || 0) / 100);
          const successChance = Math.max(0.25, Math.min(0.80, 0.45 + ecoBonus + networkBonus + charmBonus));
          const pass = Math.random() < successChance;

          if (pass) {
            if (stage === 'seed') {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'series_a',
                company_valuation: 2500,
                cash: s.cash + 25,
                tc: 18,
                health: Math.max(0, s.health - 5),
                message: ' 融资大获成功！顶级 VC 领投 $250w 支票（估值 $2500w），你成功套现 $25w 现金并为自己发放了 $18w TC 创始人薪水！'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'exit',
                company_valuation: 7000,
                cash: s.cash + 45,
                tc: 28,
                health: Math.max(0, s.health - 5),
                message: ' B 轮超级融资！红杉资本以 $7000w 估值领投，公司账上资金充沛，离 IPO 上市仅有一步之遥！'
              };
            }
          } else {
            const isDownRound = Math.random() < 0.4;
            if (isDownRound) {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, s.cash - 5),
                company_valuation: Math.max(200, (s.company_valuation || 800) - 300),
                health: Math.max(0, s.health - 15),
                message: ' 估值倒挂 (Down Round)！资本寒冬下 VC 极度挑剔，只肯给折价过桥贷款，严苛的对赌协议让你彻夜难眠，自己垫付了 $5w 现金。'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, s.cash - 3),
                health: Math.max(0, s.health - 12),
                message: ' 融资遇冷！沙丘路跑了 20 家 VC 均表示“赛道拥挤、继续观察”，未能发出 Term Sheet。公司只能继续靠现有资金死撑。'
              };
            }
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高举高打招聘】重金从 Meta/Google 挖掘顶级大牛核心工程组 (需现金>=15w)',
        reqBadge: '现金>=15w',
        condition: (s) => s.cash >= 15,
        effect: (s) => {
          const success = Math.random() < 0.70;
          if (success) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: s.cash - 15,
              company_valuation: (s.company_valuation || 1000) + 1200,
              leetcode: Math.min(100, s.leetcode + 10),
              message: ' 团队战力爆表！大厂 Senior 大牛加盟后研发出颠覆性的 AI Agent 产品，公司估值飙升！'
            };
          } else {
            return {
              mid_year: true, season_stage: 'h1',
              cash: s.cash - 15,
              company_valuation: (s.company_valuation || 1000) + 300,
              health: Math.max(0, s.health - 10),
              message: ' 文化磨合受挫！空降大牛与早期团队理念冲突，消耗了大笔安家费预算但交付延期，公司估值增长有限。'
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【终局 Exit】考虑公司并购 Acq-hire 或准备 纳斯达克 IPO 敲钟上市',
        condition: (s) => (s.company_valuation || 0) >= 2000,
        effect: (s) => {
          const roll = Math.random();
          if (roll < 0.35) {
            // 35% IPO Win
            return {
              status: 'win',
              cash: s.cash + 400,
              message: ' 传奇诞生！公司成功在纳斯达克 IPO 挂牌敲钟！创始人股权套现 $400w 美元，名利双收极速达成 FIRE 终局！'
            };
          } else if (roll < 0.75) {
            // 40% Acqui-hire / Trade Sale (Safe landing with solid cash & Staff position)
            return {
              cash: s.cash + 120,
              job_type: 'big_tech',
              level: 'L6 (Staff)',
              company: 'google',
              tc: 55,
              laid_off: false,
              founder_stage: undefined,
              company_valuation: 0,
              health: Math.max(0, s.health - 5),
              message: ' 成功被收购！Google/Meta 科技巨头以溢价并购了你们的公司。扣除 VC 清算优先权后，创始人获得 $120w 现金分成，并受聘为大厂 L6 Staff 架构师！'
            };
          } else {
            // 25% Fire Sale (Liquidation preference wipes out valuation)
            return {
              cash: s.cash + 20,
              job_type: 'unemployed',
              company: undefined,
              level: '待业',
              laid_off: true,
              founder_stage: undefined,
              company_valuation: 0,
              tc: 0,
              health: Math.max(0, s.health - 15),
              network: (s.network || 0) + 8,
              message: ' 折价清算！市场行情急转直下，公司被低价贱卖清盘。VC 拿走清算优先权后，你仅分得 $20w 离场费。创业虽败，但你积累了宝贵的人脉与创始人经历！'
            };
          }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : (s.laid_off ? 'job_hunt' : h1ToH2Router(s)),
      },
      {
        text: '【精简开支苟活】裁撤非核心人员，收缩战线，努力过冬 (无条件)',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: Math.max(0, s.cash - 3),
          company_valuation: Math.max(100, (s.company_valuation || 1000) - 350),
          health: Math.max(0, s.health - 12),
          message: '资金与资源有限，你决定开源节流，挥泪解雇了一批员工。虽然度过了危机，但公司士气大跌，你的心理压力极大。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'rto_wars': {
    id: 'rto_wars',
    title: 'RTO (Return to Office) 查考勤大战',
    description: 'CEO 突然宣布全员每周必须在办公室打卡 3 天，否则直接取消奖金甚至开除！你之前为了省房租偷偷搬到了便宜的外州/偏远地区，现在面临极大危机。',
    choices: [
      {
        text: '老老实实搬回湾区租昂贵的公寓 (房租重置为 4w)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ rent: 4, health: s.health - 15, message: '你极不情愿地回到了湾区，每个月的房租让你心如刀割，但至少保住了工作。' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '淘宝买物理点击器+找同事代刷工牌 (高风险)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const caught = Math.random() < 0.3;
          return caught
            ? { tc: 0, laid_off: true, job_type: 'unemployed', health: s.health - 30, message: '你的代刷工牌行为被 HR 发现，直接以违纪名义当天开除！' }
            : { cash: s.cash + 5, charm: s.charm + 2, message: '成功瞒天过海！你一边拿着加州的工资，一边享受着外州的低物价。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s)
      },
      {
        text: '硬刚 Manager：“要么让我 Remote，要么我走人！”',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const win = s.leetcode >= 70 && Math.random() < 0.5;
          return win
            ? { tc: s.tc + 2, charm: Math.min(25, s.charm + 5), message: '由于你是团队的核心骨干（High Performer），Manager 妥协了，给你申请了特殊的 Remote Exception！' }
            : { tc: 0, laid_off: true, job_type: 'unemployed', message: 'Manager 冷笑一声：“现在是买方市场，门在那边。” 你被解雇了。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s)
      }
    ]
  },
  'news_bull_market_start': {
    id: 'news_bull_market_start',
    title: ' 突发新闻：史诗级牛市开启！',
    description: '手机弹出华尔街日报推送："美联储意外宣布降息 50 个基点，纳斯达克指数创历史新高！各大 AI 独角兽宣布完成百亿融资！"\n\nBlind 上的跳槽包裹满天飞，连前台都在聊股票。硅谷的空气里充满了金钱的味道。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'bull', message: '宏观经济进入【狂暴大牛市】！现在大厂疯狂扩招，面试门槛大幅降低，年底 RSU 必定暴涨！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'news_bear_market_crash': {
    id: 'news_bear_market_crash',
    title: ' 突发新闻：资本寒冬降临！',
    description: '手机弹出 Bloomberg 推送："通胀超预期，美联储宣布暴力加息！纳斯达克单日暴跌 5%！"\n\n紧接着，Blind 上传出多个大厂即将冻结招聘 (Hiring Freeze) 甚至筹备万人大裁员的风声。硅谷的资本盛宴戛然而止。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'bear', message: '宏观经济进入【裁员大熊市】！现在求职面试将变成地狱难度 (需要刷海量 LeetCode)，年底 RSU 也会严重缩水！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'news_neutral_market': {
    id: 'news_neutral_market',
    title: '️ 突发新闻：市场回归理性',
    description: '经历了前段时间的剧烈波动，华尔街和硅谷大厂达成了某种默契。\n\n"各大科技公司表示将专注盈利和核心业务，停止无序扩张，但也不会进行大规模裁员。" 市场情绪逐渐平稳。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'neutral', message: '宏观经济回归【正常震荡期】。一切按部就班，靠实力说话。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'overemployed': {
    id: 'overemployed',
    title: 'OE (Overemployed) 诱惑：身兼数职',
    description: '你在 Blind 上看到了一个神秘的 OE 社区。里面的人同时拿着 3 份全职远程工作的薪水（J1, J2, J3），年收入突破 100 万美元。你看着自己轻松的“养老厂”工作，有些心动。',
    choices: [
      {
        text: '接下第二份全职工作 (J2)！赚双倍的钱！',
        condition: (s) => s.job_type === 'big_tech' || s.job_type === 'amazon' || s.job_type === 'nvidia',
        effect: (s) => {
          const caught = Math.random() < 0.25;
          return caught
            ? { tc: 0, laid_off: true, job_type: 'unemployed', health: Math.max(0, s.health - 40), message: '你在 J1 的架构会上忘记静音，突然用 J2 的称呼回答了问题！两家公司的 HR 连夜拉平信息，你被双双开除！' }
            : { cash: s.cash + s.tc, health: Math.max(0, s.health - 30), leetcode: s.leetcode + 5, message: '你用两台电脑同时开会，成功拿到了双倍工资！但是巨大的上下文切换让你精神分裂。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_daily_life'
      },
      {
        text: '算了吧，安分守己',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你拒绝了高危的诱惑，每天下午 3 点准时躺在沙发上看 Netflix，这就是 WLB。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'pickleball_networking': {
    id: 'pickleball_networking',
    title: 'Pickleball (匹克球) 社交局',
    description: '最近湾区不流行高尔夫了，所有人都在打匹克球。你的朋友拉你去参加一个高端局，据说有很多投资人和大厂 Director。',
    choices: [
      {
        text: '【开 Cybertruck/保时捷轰鸣进场】载着顶级装备轰动全场 (需豪车)',
        reqBadge: '豪车轰鸣加成',
        condition: (s) => s.car === 'cybertruck' || s.car === 'porsche',
        effect: (s) => {
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (isUnemployed && !canLandJob) {
            return {
              charm: Math.min(25, s.charm + 5),
              health: Math.min(100, s.health + 15),
              message: '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！有投资人给你推了独角兽面试，但你太久不练算法，白板编程没有通过面试。'
            };
          }
          return {
            tc: isUnemployed ? 22 : s.tc + 6,
            job_type: isUnemployed ? 'big_tech' : s.job_type,
            laid_off: false,
            charm: Math.min(25, s.charm + 5),
            health: Math.min(100, s.health + 15),
            message: isUnemployed
              ? '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！一位科技基金合伙人引荐你去 AI 独角兽，你扎实的算法基础顺利通过面试，空降高薪 Offer (+$22w)！'
              : '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！一位科技基金合伙人主动拉你组队打双打，并现场推荐你去了顶级 AI 独角兽团队！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花 $1w 买全套顶级装备去混圈子',
        condition: (s) => s.cash >= 1,
        effect: (s) => {
          const win = Math.random() > 0.5;
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (win && isUnemployed && !canLandJob) {
            return { cash: s.cash - 1, charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: '你的球技极佳，在场上和一位 VC 成了双打搭档并获推面试，但算法生疏未能拿到 Offer。' };
          }
          return win
            ? { cash: s.cash - 1, tc: isUnemployed ? 20 : s.tc + 5, job_type: isUnemployed ? 'big_tech' : s.job_type, laid_off: false, charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: '你的球技极佳，在场上和一位 VC 成了双打搭档，对方随手把你推荐给了一家明星公司，总包大涨！' }
            : { cash: s.cash - 1, health: Math.max(0, s.health - 15), message: '你用力过猛拉伤了跟腱，不仅没混到圈子，还在家躺了半个月。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '不去，宅在家打黑神话',
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你拒绝了无效社交，在家又通关了一次二郎神，神清气爽。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'breakup_crisis': {
    id: 'breakup_crisis',
    title: '感情危机：七年之痒',
    description: '由于湾区高压的生活节奏、永远在比拼薪资的焦虑、以及你长期对伴侣的忽视，你们的感情走到了破裂的边缘。对方正式向你提出了分手/离婚。',
    choices: [
      {
        text: '和平分手，资产平分',
        effect: (s) => ({ cash: s.cash / 2, is_married: false, relationship_status: 'single', health: Math.max(0, s.health - 20), message: '你们平静地签了字。由于湾区共同财产法，你分走了一半的共同资产，重新搬回了单身公寓。你的生活瞬间空虚了许多。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花 $10w 请湾区顶级离婚律师打官司 (高风险)',
        condition: (s) => s.cash >= 15,
        effect: (s) => {
          const win = Math.random() > 0.5;
          return win
            ? { cash: (s.cash - 10) * 0.9, is_married: false, relationship_status: 'single', health: Math.max(0, s.health - 30), message: '律师非常给力！你成功保住了 90% 的婚内资产，但漫长的官司让你心力交瘁，头发白了一半。' }
            : { cash: (s.cash - 10) * 0.6, is_married: false, relationship_status: 'single', health: Math.max(0, s.health - 40), message: '律师是个水货！不仅花了高昂的律师费，你还被判决失去了 40% 的资产，你痛心不已！' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '痛哭流涕挽留，发誓每天准时 5 点下班做饭',
        effect: (s) => {
          const win = s.charm >= 10 && Math.random() > 0.5;
          return win
            ? { tc: Math.max(0, s.tc - 5), health: Math.min(100, s.health + 10), message: '对方心软了。你为了家庭减少了工作投入，甚至放弃了升职机会，虽然职场发展受阻，但保住了这个家。' }
            : { cash: s.cash / 2, is_married: false, relationship_status: 'single', health: Math.max(0, s.health - 30), message: '破镜难重圆。对方觉得你只是在画大饼，依然坚决离开了你。你被动平分了资产。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'boardgame_dating': {
    id: 'boardgame_dating',
    title: '狼人杀/剧本杀相亲局',
    description: '周末你被朋友拉去参加南湾的百人桌游大群局。名义上是玩剧本杀和狼人杀，实际上是大型单身男女相亲局。',
    choices: [
      {
        text: '逻辑拉满！强势 Carry 狂踩全场 (展现高智商)',
        effect: (s) => ({ charm: Math.max(0, (s.charm || 10) - 3), leetcode: Math.min(100, s.leetcode + 5), message: '你逻辑严密，把全场玩伴的漏洞指得一清二楚，带领好人阵营完胜！但是大家觉得你太有压迫感了，活动结束后没一个人加你微信。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装小白疯狂给人递水，主打情绪价值',
        effect: (s) => {
          const win = Math.random() > 0.5;
          const isMarriedNow = s.is_married || s.relationship_status === 'married';
          return win
            ? { charm: Math.min(s.max_charm || 25, (s.charm || 10) + 3), health: Math.min(100, s.health + 10), relationship_status: isMarriedNow ? 'married' : 'dating', message: isMarriedNow ? '你全程温柔体贴，结识了几位同样在大厂的同行好友，社交氛围轻松！' : '你全程温柔体贴，虽然游戏输了，但成功撩到了一个同样来相亲的大厂同行！你们聊得火热，互加微信并确立了恋爱关系 (Dating)！' }
            : { charm: Math.min(s.max_charm || 25, (s.charm || 10) + 1), health: s.health + 5, cash: Math.max(0, s.cash - 0.2), message: '你跑前跑后伺候大家，当了一整天的“沸羊羊”，虽然交了几个普通朋友，但并没有人看上你。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '发现场地的老板正在招全栈工程师，去聊聊',
        effect: (s) => {
          const win = s.leetcode >= 50;
          const isEmployed = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          return win
            ? { tc: isEmployed ? s.tc + 3 : 0, cash: s.cash + 3, message: '你没去相亲，反而帮老板解决了一个支付系统的 Bug！老板塞给你一份兼职外包合同与现金，赚了点外快！' }
            : { message: '你和老板聊了半天，发现对方只是想白嫖你写个订餐小程序，你礼貌地拒绝了。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'rock_climbing_event': {
    id: 'rock_climbing_event',
    title: '【湾区潮流】Movement 抱石馆的黑标大佬',
    description: '周末你穿上始祖鸟，来到了 Sunnyvale 的 Movement 抱石馆。馆里到处都是身穿 Lululemon 和始祖鸟黑标的硅谷码农在研究 V4/V5 路线。',
    choices: [
      {
        text: '挑战 V5 难度黑点路线 (体验攀岩硬核快感)',
        effect: (s) => ({
          health: Math.min(100, s.health + 20),
          charm: Math.min(25, s.charm + 3),
          message: '你顶住了侧拉与脚尖 Hook 挂墙，成功 Top out 登顶！虽然前臂肌肉酸痛，但心理压力一扫而空，神清气爽！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '与旁边脱下镁粉袋的老哥交流动态跳跃 (尝试搭讪拓展人脉)',
        effect: (s) => {
          const win = Math.random() < 0.45;
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (win && isUnemployed && !canLandJob) {
            return {
              charm: Math.min(25, s.charm + 4),
              health: Math.min(100, s.health + 15),
              message: '老哥极为欣赏你的解题节奏并为你推荐了 AI 团队面试，可惜你长期没练算法没能通过白板面试。'
            };
          }
          return win
            ? {
                tc: isUnemployed ? 20 : s.tc + 5,
                job_type: isUnemployed ? 'big_tech' : s.job_type,
                laid_off: false,
                charm: Math.min(25, s.charm + 4),
                health: Math.min(100, s.health + 15),
                message: '聊了几句才发现对方是隔壁 AI 巨头的 Principal Architect！老哥非常欣赏你的解题节奏，直通推荐你去了核心 AI 算力架构团队！TC 暴涨！'
              }
            : {
                health: Math.min(100, s.health + 20),
                charm: Math.min(25, s.charm + 2),
                message: '老哥热情地向你分享了他的动态挂脚技巧，你们加了 Strava 好友，约定下周末继续来刷 V5 路线。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'tennis_networking': {
    id: 'tennis_networking',
    title: '【湾区精英】Cupertino 网球场双打局',
    description: '周六加州阳光明媚，你带着 Babolat 拍子来到了 Cupertino 的网球场。几位大厂 Senior 与 Startup Founder 正好缺一个双打搭档...',
    choices: [
      {
        text: '轰出 100mph 强力发球，统治比赛',
        effect: (s) => ({
          health: Math.min(100, s.health + 20),
          charm: Math.min(25, s.charm + 4),
          message: '你的正手上旋与发球统治了全场！球友们直呼“湾区费德勒”，纷纷拉你进南湾高端网球俱乐部群，相亲与社交胜率大增！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '打温和拉球，场下与搭档畅聊 AI 风口与美股',
        effect: (s) => ({
          cash: s.cash + 4,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, s.charm + 2),
          message: '打完球后大家在场边喝电解质水，搭档大佬随口指点了你几只算力概念股，你果断跟进，随后获得了 $4w 美金的短期投资回报！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'bay_area_heart_signal': {
    id: 'bay_area_heart_signal',
    title: '【湾区恋综】受邀录制湾区版《心动的信号》',
    description: '凭借出众的高颜值魅力与优秀的行业背景，你收到了小红书与头部华人 MCN 联合打造的现象级恋综《心动的信号·硅谷篇》男神/女神首发嘉宾邀约！录制地点在 Los Altos 山顶豪华独栋别墅，同组嘉宾包括斯坦福美女博主、沙丘路年轻 VC 合伙人与大厂 L6 架构师...',
    choices: [
      {
        text: '【真诚直球路线】在厨房做饭交流真情实感，不争不抢展现真实自我',
        effect: (s) => {
          const baseRate = 0.52;
          const charmBonus = ((s.charm || 22) - 20) * 0.04;
          const luckBonus = ((s.luck || 20) / 300);
          const winRate = Math.min(0.78, Math.max(0.40, baseRate + charmBonus + luckBonus));
          const pass = Math.random() < winRate;

          return pass
            ? {
                charm: Math.min(25, (s.charm || 10) + 3),
                health: Math.min(100, s.health + 12),
                relationship_status: 'dating',
                partner_type: 'random',
                message: '【终极告白牵手】你的真诚、沉稳与厨艺打动了心动嘉宾！在告白夜双向奔赴牵手成功 (进入 Dating 状态)，全网嗑糖破百万播放！'
              }
            : {
                charm: Math.min(25, (s.charm || 10) + 2),
                health: Math.min(100, s.health + 6),
                message: '【体面错付与遗憾】虽然在厨房的交心十分温馨，但心动嘉宾最终在告白夜被另一位进攻性更强的嘉宾打动。你体面送上祝福，真诚克制的表现为你在全网赢得了极佳路人缘。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【大厂硬核炫技】约会时在白板上手撕红黑树与分布式一致性协议，疯狂输出 TC 与大厂光环',
        effect: (s) => ({
          cash: s.cash + 3,
          charm: Math.min(25, (s.charm || 10) + 2),
          leetcode: Math.min(100, s.leetcode + 5),
          message: '【硬核出圈】“约会手撕分布式系统”的名场面直接登顶全网热搜！虽然没能牵手成功，但你被奉为“硅谷最纯粹的硬核做题家码农”，疯狂恰饭赚到了 $3w 品牌代言费！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【顶级海王拉扯】在多个嘉宾之间若即若离，疯狂互发匿名心动短信制造修罗场',
        effect: (s) => {
          const win = Math.random() < (0.50 + ((s.luck || 20) / 200));
          return win
            ? {
                charm: Math.min(25, (s.charm || 10) + 6),
                cash: s.cash + 2,
                relationship_status: 'dating',
                partner_type: 'vc',
                message: '【修罗场赢家】你的极限拉扯让全网嗑生嗑死！最终在万人瞩目下成功牵手年轻 VC 嘉宾 (Dating)，商业价值与颜值魅力拉满！'
              }
            : {
                health: Math.max(0, s.health - 15),
                charm: Math.max(10, (s.charm || 10) - 2),
                message: '【全网被冲】你的多线操作被节目组恶意剪辑成了“湾区海王翻车特辑”，在一亩三分地与小红书被疯狂吃瓜讨论，身心俱疲。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'bay_area_pop_concert': {
    id: 'bay_area_pop_concert',
    title: '【湾区抢票狂潮】Levi\'s Stadium 顶流巨星巡演抢票',
    description: '泰勒·斯威夫特 (Taylor Swift) / 周杰伦世界巡回演唱会加州站空降圣克拉拉 Levi\'s Stadium！全湾区的华人码农和社交圈瞬间沸腾，Ticketmaster 被各路自动化抢票脚本挤爆，StubHub 黄牛票直接炒到了上千刀一张...',
    choices: [
      {
        text: '【手写并发脚本】用 Python 配合代理池手搓自动化抢票脚本，原价抢下前排 VIP 内场票 ($0.4w)',
        condition: (s) => s.leetcode >= 30 && s.cash >= 0.4,
        effect: (s) => ({
          cash: s.cash - 0.4,
          charm: Math.min(25, (s.charm || 10) + 4),
          health: Math.min(100, s.health + 15),
          message: '【VIP 内场狂欢】你的高并发抢票脚本在 0.1 秒内秒杀下两张内场票！在 Levi\'s Stadium 烟火下全场大合唱，身心得到极致释放，朋友圈点赞破 300！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【黄牛高溢价买单】不想费脑子，直接在 StubHub 豪掷千金买下山顶看台票 ($0.8w)',
        condition: (s) => s.cash >= 0.8,
        effect: (s) => ({
          cash: s.cash - 0.8,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 2),
          message: '【千金难买心头好】虽然黄牛溢价让人肉疼，但现场全场挥舞荧光棒的震撼合唱让你彻底忘却了本季度的 Perf 焦虑。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【做黄牛转手套利】用脚本抢下 4 张内场票后直接挂在二手群加价转手，狠赚一笔',
        condition: (s) => s.leetcode >= 25 && s.cash >= 1.0,
        effect: (s) => ({
          cash: s.cash + 2.5,
          charm: Math.max(10, (s.charm || 10) - 1),
          message: '【理财奇才】抢到的门票转手被南湾富二代高价秒抢，净赚 $2.5w 零花钱！虽然被朋友吐槽为“黄牛码农”，但实打实的现金落袋为安。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '理智消费：在体育场外草坪“挂壁”听免费漏音',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          message: '你带着折叠椅和野餐垫坐在场外草坪上，吹着加州晚风听着里面的合唱，一分钱没花也感受到了现场的欢乐。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'influencer_vp_drama': {
    id: 'influencer_vp_drama',
    title: '【组织震荡】公司空降百万粉自媒体网红担任业务线 VP',
    description: '管理层为了追求“AI 时代的品牌破圈”，从外部重金空降了一位拥有百万粉丝的小红书/LinkedIn 科技网红出任你们业务线 VP。新官上任三把火：不仅把所有周会改成全员直播录播客，还要求技术组全部配合他的“营销概念 Demo”，引发老工程师群体强烈不满...',
    choices: [
      {
        text: '【迎合向上管理】通宵帮 VP 定制炫酷的 Agent 营销 Demo，在全网发布会为他站台',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 3),
          tc: s.tc + 3.0,
          health: Math.max(0, s.health - 15),
          message: '【成为嫡系】Demo 在社交平台爆火百万转发，VP 逢人便夸你是他的核心技术心腹，年底直接为你破格申请了 +$3w 调薪！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【硬核技术死磕】在架构评审会上当众用指标与延迟打脸 VP 的花架子 PPT',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => {
          const win = s.leetcode >= 45 || Math.random() < 0.45;
          return win
            ? {
                tc: s.tc + 2.0,
                charm: Math.min(25, (s.charm || 10) + 4),
                message: '【技术派胜利】你的专业驳斥被更高层 CTO 听到了！CTO 叫停了形式主义项目并将技术决策权重新交还给你，你在组员中威望极高！'
              }
            : {
                health: Math.max(0, s.health - 12),
                message: '【惨遭穿小鞋】网红 VP 表面微笑着说“Very good feedback”，私下却把最脏最累的 Oncall 维护活全部分配给了你。'
              };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【冷眼吃瓜刷题】在会议室关麦静音，一边看 VP 吹水一边狂刷 LeetCode 备战跳槽',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          health: Math.min(100, s.health + 5),
          message: '【以静制动】你看着 VP 在 PPT 里堆砌各种虚假 AI 概念，内心毫无波澜地刷完了 5 道 Hard 题，随时准备拿着大包跳槽脱离苦海。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'bay_area_hiking': {
    id: 'bay_area_hiking',
    title: '【硅谷仪式感】Fremont Mission Peak 登顶拔剑',
    description: '周末清晨，你被朋友拉去 Fremont 的 Mission Peak 徒步。面对 6 英里无遮挡的大斜坡与湾区烈日，你一步步迈向山顶那根著名的“拔剑柱” (Mission Peaker)...',
    choices: [
      {
        text: '一口气冲上山顶，在拔剑柱前拍 OOTD 大片',
        effect: (s) => ({
          health: Math.min(100, s.health + 15),
          charm: Math.min(25, s.charm + 3),
          message: '站在 Mission Peak 顶峰俯瞰整个旧金山湾区与 237 公路！你在拔剑柱前拍的帅气写真在朋友圈和小红书获得了上百个赞！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '中途在草地上躺平休养，呼吸湾区新鲜空气',
        effect: (s) => ({
          health: Math.min(100, s.health + 18),
          message: '阳光洒在身上，看着远处的牛群与红木山谷，你久违地感受到了灵魂的放松与惬意。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'hawaii_vacation': {
    id: 'hawaii_vacation',
    title: '【WLB神仙体验】夏威夷 Maui 岛度假避世',
    description: '积攒了一整年的 PTO 假期，你终于买好了飞往夏威夷 (Hawaii) 的机票。漫步在威基基海滩 (Waikiki) 的落日余晖中，手里拿着冰镇椰汁与新鲜 Poke ...',
    choices: [
      {
        text: '体验欧胡岛冲浪与火山潜水 (花费 $0.8w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.8),
          health: Math.min(100, s.health + 18),
          charm: Math.min(25, s.charm + 4),
          message: '太平洋的海浪与彩虹彻底洗去了写代码的疲惫！你的体能恢复满格，带着一身健康的阳光小麦肤色重返硅谷！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '海景酒店阳台躺平，听海浪声睡三整天 (花费 $0.4w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 22),
          message: '彻底关闭 Slack 和 Outlook 提醒！在海浪声中睡到了自然醒，Burnout 症状被完美治愈。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'japan_trip': {
    id: 'japan_trip',
    title: '【跨境自由行】东京羽田/京都赏枫度假',
    description: '彻底摆脱了 H1B 返美签 Stamp 审查与出入境限制的心理阴影，你享受着无需为签证焦虑的自由，买了一张旧金山直飞东京羽田的头等舱机票！',
    choices: [
      {
        text: '银座狂买 & 奢华怀石料理/米其林 (消耗 $1.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.5),
          health: Math.min(100, s.health + 15),
          charm: Math.min(25, s.charm + 5),
          message: '你享受了最高规格的日式招待！品尝了顶配和牛与怀石料理，在银座彻底放空身心！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '富士山小木屋温泉私汤连泡 5 天 (消耗 $0.8w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.8),
          health: Math.min(100, s.health + 20),
          message: '望着富士山雪景泡温泉，热气腾腾中所有的湾区职场焦虑烟消云散！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'luxury_car_meet': {
    id: 'luxury_car_meet',
    title: '【湾区豪车车友会】Skyline Blvd 跑山',
    description: '作为保时捷/Cybertruck 豪车车主，你受邀参加了湾区 35 号公路 (Skyline Blvd) 的周末豪车车友会。',
    choices: [
      {
        text: '和 VC / 大厂 Director 交流豪车与独角兽投资',
        effect: (s) => ({
          tc: s.tc + 5,
          charm: Math.min(25, s.charm + 3),
          health: Math.min(100, s.health + 10),
          message: '车友会里藏龙卧虎！你结识了一位科技基金合伙人，对方为你推荐了一个高薪岗位机会，TC 再次提升！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '下场 17-Mile 沿海公路体验极限跑山 (消耗 $0.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          charm: Math.min(25, s.charm + 5),
          health: Math.max(0, s.health - 5),
          message: '引擎轰鸣，推背感拉满！你在湾区跑车圈名声大噪！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'house_warming_party': {
    id: 'house_warming_party',
    title: '【豪宅乔迁】湾区做题家 Housewarming BBQ',
    description: '你买下了属于自己的湾区房产，周末在私人草坪庭院举行了乔迁露天烤肉派对 (Housewarming)。',
    choices: [
      {
        text: '邀请同事与邻居来庭院做天幕 BBQ 派对 (消耗 $0.3w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.3),
          charm: Math.min(25, s.charm + 4),
          health: Math.min(100, s.health + 15),
          message: '烤肉香气扑鼻，大家纷纷夸赞你的眼光与房产品质！社交圈口碑暴涨！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '拍摄全套 Home Decor 发小红书“湾区买房心得”',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 5),
          message: '爆款文章收割了上千点赞！你成为了小红书湾区家居/房产圈的顶流 Blogger！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'startup_angel_investing': {
    id: 'startup_angel_investing',
    title: '【硅谷资本圈】天使投资人俱乐部',
    description: '手握超过百万元流动现金的你，收到了硅谷华人天使投资俱乐部 (Bay Angels) 的秘密邀请。',
    choices: [
      {
        text: '出资 $20w 成为 AI 独角兽 Seed 轮天使投资人 (高风险)',
        effect: (s) => {
          const win = Math.random() < 0.4;
          return win 
            ? { cash: s.cash + 100, message: '爆火升值！你投资的 AI 独角兽被巨头高价买断，天使轮获得 5 倍天价回报 (+$100w)！' }
            : { cash: Math.max(0, s.cash - 20), health: s.health - 10, message: 'AI 大模型算力消耗太快，创业团队见底倒闭。你交了 20 万美元天使投资学费。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '观望不投，只去品尝顶级红酒与交流网络',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 2),
          health: Math.min(100, s.health + 5),
          message: '你保持了理智，蹭到了昂贵的红酒并拓展了资本圈高管人脉。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'h1b_visa_stamping_crisis': {
    id: 'h1b_visa_stamping_crisis',
    title: '【回国续签】H1B 221(g) 行政审查 Check 危机',
    description: '你趁假期回国探亲顺便预约了美领馆 H1B 续签 Stamp。结果因为 CS/AI 敏感专业，签证官微笑着递给你一张黄单（221g Administrative Processing 行政审查）！',
    choices: [
      {
        text: '在国内远程克服时差高强度打卡，每天刷 Ceac 查询状态',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          health: Math.max(0, s.health - 15),
          message: '你白加黑倒时差工作了两周，终于等到了 Passport 带着 Stamp 寄回！成功惊险返美！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '联系公司法务开具紧急加急信 (Expedite Request)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const pass = Math.random() < 0.55;
          return pass 
            ? { health: Math.min(100, s.health + 5), message: '加急信生效！领事馆提早批复了你的 Visa Stamp，你顺利搭上返美航班！' }
            : { health: s.health - 10, cash: Math.max(0, s.cash - 1), message: '领事馆回复“标准审查无法加急”，你被迫在加州时间深夜远程办公，精疲力竭。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【永久居民 / AP 回美证免签】出示美国护照/绿卡或 AP Combo 卡直接入境',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民' || s.gc_stage === 'i485_pending' || s.gc_stage === 'approved',
        effect: () => ({
          message: '你手握美国绿卡/护照或 I-485 附带的 Advance Parole (AP) Combo 回美卡，在海关 CBP 轻松查验直接入境，无需经历领事馆面签与 Check 煎熬！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'credit_card_churning': {
    id: 'credit_card_churning',
    title: '【湾区理财神器】美卡指南与开卡礼狂热',
    description: '作为湾区精算做题家，你沉迷于美卡指南 (US Credit Card Guide)。从 Chase Sapphire Reserve 到 Amex Platinum，再到 Capital One Venture X，你迷上了 5/24 规则与开卡礼 (Sign-up Bonus)！',
    choices: [
      {
        text: '【开卡礼狂魔】一口气申 4 张大额神卡，刷满开卡礼点数兑头等舱 (消耗 $0.5w, 收益 $1.2w 积分价值)',
        effect: (s) => ({
          cash: s.cash + 1.2,
          charm: Math.min(25, s.charm + 3),
          health: Math.min(100, s.health + 5),
          message: '成功拿到了 300,000 Amex/Chase 积分！直接兑换了旧金山直飞东京的日航全平躺头等舱，精算理财智商彻底碾压同行！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【DoorDash 薅羊毛】研究 Uber Eats / DoorDash 满减优惠券',
        effect: (s) => ({
          cash: s.cash + 0.3,
          message: '虽然每天在不同 App 里切账号领优惠券只省了几百刀，但薅到羊毛的成就感让你乐此不疲！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'vibe_coding_craze': {
    id: 'vibe_coding_craze',
    title: '【AI新纪元】Vibecoding：用 Cursor/Claude 替代手打代码',
    description: 'AI 编程时代降临！硅谷都在传颂“Vibecoding”——不看细节，不用手打每行代码，只用自然语言和 Cursor/Claude Agent 对话，3 分钟生成全栈 App！',
    choices: [
      {
        text: '【Vibecoding 狂魔】开启 Cursor Pro + Claude 3.5 Sonnet，一个人顶一个 5 人团队',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          health: Math.min(100, s.health + 10),
          tc: s.tc > 0 ? s.tc + 5 : s.tc,
          message: '你成为了组里的 Vibecoding 大师！别人用两周写的功能你半天提交 PR，经理惊呼你一个人就是一支队伍！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【生成式 AI 幻觉】全信 AI 自动生成的代码，未审核直接 Push 到 Production 生产环境！',
        effect: (s) => {
          const win = Math.random() < 0.45;
          return win
            ? { luck: Math.min(99, (s.luck || 20) + 5), cash: s.cash + 2, message: '产线竟然零报错无缝运行！用户量大增，领导夸赞你产出惊人！' }
            : { health: Math.max(0, s.health - 15), message: 'AI 幻觉写出了逻辑死锁导致大厂全网宕机 2 小时！你半夜被 PagerDuty 电话叫醒去改底层 C++！' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'ai_agent_startup': {
    id: 'ai_agent_startup',
    title: '【黑客松爆火】AI Agent 自动化工作流助手',
    description: '你在周末 Hackathon 上用 AI Agent 搭建了一个全自动替工程师开 Zoom 会与自动写 Weekly Report 的 Agent 助手，在 Twitter/X 上暴火！',
    choices: [
      {
        text: '【VC 争相送钱】接受 a16z / YC 的 $50w 种子轮打款',
        effect: (s) => ({
          cash: s.cash + 15,
          charm: Math.min(25, (s.charm || 10) + 6),
          job_type: 'startup',
          message: 'a16z 领投种子轮！获得 $15 万美金天使现金，你登上了 TechCrunch 头条，成为硅谷最炙手可热的 AI Agent 创业明星！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【开源上星】在 GitHub 开源该项目，收割 15k Stars',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 8),
          leetcode: Math.min(100, s.leetcode + 10),
          message: '项目登上了 GitHub Trending 榜首！全球几万开发者给你送 Star，连 Sam Altman 都转发了你的 Tweet！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'midlife_management_pivot': {
    id: 'midlife_management_pivot',
    title: '【35岁中年危机】管理岗转型与 IC 路线抉择',
    description: '年过 35，组里新招的 00 后应届生全是会用 Vibecoding 和 AI Agent 的效率怪兽！高层推行“扁平化去除中层管理”，大老板找你谈话：要求你转型 EM 承担背指标背 PIP 的角色，或者继续做 IC 但带头做 AI 转型！',
    choices: [
      {
        text: '【转型 M1/EM 管理岗】承担背指标背 PIP 责任，管理 12 人团队',
        effect: (s) => ({
          tc: s.tc + 15,
          health: Math.max(0, s.health - 20),
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          message: '你升任了 EM 管理岗！TC 飙升，但每天要在各类汇报与背 PIP 的沉重压力下度过，白头发暴增。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【死守 IC 架构师】做纯粹的技术专家，拒绝开扯皮管理会',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          health: Math.min(100, s.health + 10),
          message: '你守住了纯粹技术人的尊严！虽然放弃了管理岗加薪，但工作与生活恢复了健康平衡！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'ai_disruption_existential': {
    id: 'ai_disruption_existential',
    title: '【AI 冲击危机】部门底层代码被 AI Agent 全面重构',
    description: '公司全员接入最新的自研代码大模型！你过去写了 5 年的 Java/C++ 中台系统被 AI Agent 在 10 分钟内全自动用 Rust 重构并部署完成。VP 宣布部门将“精简 30% 传统开发人员”。',
    choices: [
      {
        text: '【拥抱 AI 全面重构】主动领头组建 AI Agent 工作流，把所有业务线接入 LLM',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          tc: s.tc + 10,
          luck: Math.min(99, s.luck + 5),
          message: '你成为了公司的 AI 转型功臣！不仅免受裁员波及，还被 VP 点名表彰带头领跑 AI 新时代！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【死守传统底层系统】强调 Legacy Code 维护的重要性与安全性',
        effect: (s) => {
          const win = Math.random() < 0.40;
          return win
            ? { health: s.health + 5, message: '老系统发生重大产线事故，全球只有你懂得如何救火！你成功凭借稀缺性保住了铁饭碗！' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: s.health - 15, message: '部门最终决定整体重组裁撤！你拿着 Severance 遣散费步入了中年求职市场。' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : h1ToH2Router(s)
      }
    ]
  },
  'property_hoa_special_assessment': {
    id: 'property_hoa_special_assessment',
    title: '【湾区房产危机】HOA 专项摊派与房屋天价大修账单',
    description: '你名下的湾区房产收到了 HOA 业委会的紧急挂号信！由于加州暴雨与房屋地基沉降，社区需要整体更换瓦片屋顶并修缮排水管，HOA 宣布向每户发起 $3.5w 美金的 Special Assessment 专项特别摊派账单！',
    choices: [
      {
        text: '【爽快缴纳全款】咬牙拿出流动资金，彻底修缮地基屋顶',
        effect: (s) => ({
          cash: Math.max(-0.5, s.cash - 3.5),
          health: s.health + 5,
          message: '你痛心地划走了 3.5 万美金！但修缮后的房子在 Zillow 上的估值立刻大涨，房屋安全性大增。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【加入 HOA 业委会抗争】在社区业主大会上与 HOA 主席展开大战',
        effect: (s) => ({
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          health: Math.max(0, s.health - 15),
          message: '你在邻居群里化身意见领袖，成功把摊派金额砍到了 $1.5w！虽然省了钱，但整整三个星期都在和业委会扯皮，身心俱疲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'health_burnout_warning': {
    id: 'health_burnout_warning',
    title: '【中年体能警报】Stanford Health 体检预警',
    description: '在 Stanford Health 的年度体检中，医生严肃地指着你的报告：中度脂肪肝、腰椎 L4-L5 间盘突出、血压血脂双双超标。“如果你继续保持每天坐 10 个小时、高压冲刺代码的生活，5 年内猝死风险高达 40%！”',
    choices: [
      {
        text: '【开启彻底保养】买升降桌、立式办公、每周 3 次皮拉提斯与私人教练 (花费 $1w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1),
          health: Math.min(100, s.health + 25),
          message: '健康就是最大的财富！经过半年的体能恢复，你的身体各项指标全面回归正常，神清气爽！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【轻伤不下火线】吃降压药硬抗，继续为下一个 Promotable Project 拼命',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => ({
          health: Math.max(0, s.health - 20),
          tc: (s.job_type === 'unemployed' || s.laid_off) ? 0 : s.tc + 5,
          message: '你靠吃药硬撑过了 Q4 冲刺！虽然顺利拿到了加薪，但腰椎间盘的剧痛让你每天只能躺在地上看代码。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'bay_area_dink_vs_kids': {
    id: 'bay_area_dink_vs_kids',
    title: '【双码家庭抉择】DINK 丁克自由 vs 抢 10 分学区房',
    description: '结婚几年了，湾区双职工面临终极选择：是在 Palo Alto 享受 DINK (双薪无娃) 每年开滑雪与度假，还是砸钱买 Fremont 10 分学区房准备鸡娃？',
    choices: [
      {
        text: '【坚定 DINK 丁克】享受自由人生，每年去 Tahoe / 夏威夷度假',
        effect: (s) => ({
          cash: s.cash + 10,
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          message: '你和伴侣达成了 DINK 共识！没有育儿焦虑与学区房负担，两人每年满世界度假，生活滋润无比！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【抢学区房鸡娃】买 Fremont 10 分学区房，报名卡内基梅隆机器人夏令营 (消耗 $15w 现金)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({
          cash: s.cash - 15,
          health: s.health - 10,
          rent: s.housing_name === 'Atherton 顶级豪宅' ? 0 : 4.5,
          has_housing: true,
          housing_name: s.housing_name === 'Atherton 顶级豪宅' ? 'Atherton 顶级豪宅' : 'Fremont 10分学区房',
          message: '你步入了湾区老爹鸡娃正轨！社区邻居全是高强度卷 AMC10 的硅谷大佬，每天陪娃解题虽然辛苦但充实。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'nvidia_stock_surge': {
    id: 'nvidia_stock_surge',
    title: '【AI 狂潮暴富】NVDA 英伟达财报暴涨 30%',
    description: '英伟达发布爆表财报！黄教主身穿皮衣宣布 Blackwell 芯片供不应求。全球科技股与大厂 RSU 随着股价飙升狂欢！作为硅谷打工人，你面临个人资产配置调整：',
    choices: [
      {
        text: '【全仓追高芯片股】把剩余流动资金全部追高 Buying NVDA / AMD',
        effect: (s) => {
          const win = Math.random() < 0.45;
          const currentStocks = s.stocks || 0;
          const boostedStocks = Math.floor(currentStocks * 1.35);
          const droppedStocks = Math.floor(currentStocks * 0.85);
          return win
            ? { cash: s.cash + 15, stocks: boostedStocks, macro_economy: 'bull', luck: Math.min(99, s.luck + 5), message: 'AI 牛市暴发！英伟达股价创历史新高，你持有的科技股账户飙升 35%！净资产暴涨！' }
            : { cash: Math.max(0, s.cash - 5), stocks: droppedStocks, macro_economy: 'bull', message: '追高在阶段性山顶！财报后利好出尽遭资金砸盘，你持有的科技股下跌 15%，现金被套牢。' };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【落袋为安抛售套现】把归属的 RSU 及时 Sell，锁住现金买国债/S&P500',
        effect: (s) => ({
          cash: s.cash + 8,
          macro_economy: 'bull',
          message: '你稳健落袋为安！拿着现金稳稳躺赚高息，理财心态稳如老狗。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'ex_wedding_invite': {
    id: 'ex_wedding_invite',
    title: '红色炸弹来袭',
    description: '周末你收到了一份精致的电子请柬。你曾经暧昧过/交往过的前任下个月要在 Napa 酒庄举办盛大婚礼了。',
    choices: [
      {
        text: '大方随份子钱并出席 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(30, s.charm + 1), health: s.health - 5, message: '你强颜欢笑在 Napa 酒庄吃了一顿精致但毫无味道的西餐，包了 $2000 的份子钱，心里拔凉拔凉的。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装没看见，默默拉黑',
        effect: (s) => ({ network: Math.max(0, s.network - 5), health: Math.min(100, s.health + 5), message: '你选择无视请柬并删除了对方的好友。圈子里传言你“格局太小”，人脉受损，但你觉得心情舒畅多了！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'ikea_furniture_fight': {
    id: 'ikea_furniture_fight',
    title: '周末危机：宜家家具组装',
    description: '为了布置温馨的小家，周末你和伴侣去 IKEA 买了一个巨型衣柜。回到家后，面对一堆木板和毫无逻辑的说明书，气氛变得十分焦灼。',
    choices: [
      {
        text: '自告奋勇，独自一人闷头组装 (拼体力)',
        effect: (s) => {
          const pass = Math.random() < 0.5;
          return pass 
            ? { health: s.health - 10, charm: Math.min(30, s.charm + 1), message: '花了 6 个小时，你终于把衣柜拼好了！虽然累得腰酸背痛，但伴侣对你崇拜有加，感情升温！' }
            : { health: s.health - 15, message: '拼到一半发现一块核心木板装反了，必须要全部拆掉重来...伴侣在旁边叹气，两人不欢而散。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花钱消灾，直接请 TaskRabbit 师傅 (花费 $0.1w)',
        condition: (s) => s.cash >= 0.1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), health: Math.min(100, s.health + 5), message: '你果断打开 TaskRabbit 花了 $1000 请了墨西哥老哥。半小时搞定，你们开开心心出门吃大餐去了。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
,
  'llm_datacenter_power_outage': {
    id: 'llm_datacenter_power_outage',
    title: '【机房事故】Santa Clara 数据中心跳闸，训练 2 周的模型中断',
    description: '周二凌晨 2 点，PagerDuty 尖锐狂响！公司在 Santa Clara 的 AI 数据中心因为酷暑供电过载跳闸，集群全部掉线。你训了 14 天的 100B 参数大模型没有及时存 Checkpoint...',
    choices: [
      {
        text: '通宵 48 小时手写 Recovery 恢复脚本救回权重',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 15), message: '凭借硬核的 Infra 恢复脚本，你奇迹般地挽回了 90% 的权重数据，VP 在 Slack 全员频道为你点赞！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '果断甩锅给基础设施 Infra 部门，关掉手机继续睡觉',
        effect: (s) => ({ health: Math.min(100, s.health + 10), network: Math.max(0, (s.network || 0) - 3), message: '第二天 Infra 组扛下了所有责任，你虽然保住了睡眠，但跟 Infra 组领队关系降到了冰点。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'meta_reorg_manager_left': {
    id: 'meta_reorg_manager_left',
    title: '【重组风暴】Manager 突然 Pursuing New Opportunities',
    description: '周一例行 All-hands 会议上，你的直属 Manager 突然宣布离职。新调来的 Manager 对你过去半年的成果完全不了解，把你正在负责的核心项目划给了他的亲信...',
    choices: [
      {
        text: '主动约新 Manager 1:1，带上精心准备的 30 页 PPT 汇报展现价值',
        effect: (s) => ({ network: Math.min(100, (s.network || 0) + 5), health: Math.max(0, s.health - 10), message: '你的主动与专业打动了新老板，成功保住了原本的项目 Owner 身份！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '彻底失望，借机关摄像头狂刷 LeetCode 准备跳槽',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 15), health: Math.max(0, s.health - 10), message: '你在摸鱼中狂刷了 50 道 Hard 题，算法功力大增，准备随时寻找下家！' }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'apple_vision_pro_demo': {
    id: 'apple_vision_pro_demo',
    title: '【空间计算】公司全面发力 Vision Pro 空间应用开发',
    description: '苹果发布 Vision Pro 后，VP 要求团队立刻将主站应用重构为空间计算版本。你拿到了组里唯一一台试用设备。',
    choices: [
      {
        text: '自告奋勇担任 Head of Spatial App 领头人',
        effect: (s) => ({ tc: s.tc + 3, health: Math.max(0, s.health - 15), message: '你成为了公司内部空间计算的第一专家，产品上线后获得了大批关注！总包获得增长！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '体验完 3D 效果后吐槽“戴着颈椎酸痛”，按部就班写网页版代码',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你维持了健康的生活节奏，避开了空间计算概念退潮后的热度崩塌。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'san_francisco_car_window_smash': {
    id: 'san_francisco_car_window_smash',
    title: '【旧金山特色】Mission 区吃 Tacos 车窗惨遭砸破',
    description: '周六下午，你开车去旧金山 Mission 区吃网红 Tacos。停在路边仅 1 小时，回来赫然发现后车窗被打碎，后备箱里的健身包被搜刮一空...',
    choices: [
      {
        text: '自认倒霉走自付费 Deductible 换玻璃 (消耗 $0.1w)',
        condition: (s) => s.cash >= 0.1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), health: s.health - 5, message: '你自费修好了车窗玻璃，领教到了旧金山最真实的治安“震撼”。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '拍照发小红书“旧金山治安体验”，引发热烈围观',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), health: s.health - 5, message: '你的小红书帖子获得了 300+ 赞，不少湾区博主在评论区感同身受地交流防砸车经验。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'napa_wine_tasting': {
    id: 'napa_wine_tasting',
    title: '【中产仪式感】Napa 纳帕谷酒庄品酒周六出行',
    description: '阳光明媚的周末，你和几位湾区同行驱车前往 Napa 纳帕谷高端酒庄。在葡萄园城堡里，侍酒师倒上了 2018 年 Cab Sauv...',
    choices: [
      {
        text: '入坑购买 2 箱高端红酒并订阅 Wine Club 会员 (花费 $0.8w)',
        condition: (s) => s.cash >= 0.8,
        effect: (s) => ({ cash: s.cash - 0.8, charm: Math.min(25, s.charm + 4), health: Math.min(100, s.health + 10), message: '你体验到了正宗的湾区中产生活方式，品味大幅上升，社交话题更加丰富！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '纯打卡拍照发朋友圈，喝葡萄汁享受阳光',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(25, s.charm + 2), message: '纳帕谷的明媚阳光与绿油油的葡萄园让你极度放松，身心得到了全面滋养！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'costco_gold_bar_frenzy': {
    id: 'costco_gold_bar_frenzy',
    title: '【抗通胀神器】Sunnyvale Costco 排队抢购 24K 纯金条',
    description: '消息在湾区微信群疯传：Sunnyvale Costco 突然上架了 1 盎司 Pamp 瑞士 24K 纯金条，大批码农排起长队抢购以抵御高通货膨胀！',
    choices: [
      {
        text: '刷信用卡加码买入 2 块金条避险 (消耗 $0.4w 现金)',
        condition: (s) => s.cash >= 0.4,
        effect: (s) => ({ cash: s.cash - 0.4, luck: Math.min(99, s.luck + 2), message: '你成功抢到了两块实物金条装进保险柜，踏实感满满！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '吐槽“码农盲目跟风”，转身买了两盒烤鸡和热狗回家',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.02), health: Math.min(100, s.health + 5), message: '啃着 $4.99 美元的 Costco 烤鸡，你觉得这才是实打实的性价比自由。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'palo_alto_stanford_lecture': {
    id: 'palo_alto_stanford_lecture',
    title: '【硅谷大咖讲座】Stanford 斯坦福现场听 Jensen Huang 演讲',
    description: '周五晚上，Stanford 校园礼堂举办 AI 领袖公开讲座。黄仁勋穿着皮衣登台演讲，现场挤爆了来自 Sand Hill Road 的 VC 和各大厂码农。',
    choices: [
      {
        text: '讲座后抢占 Q&A 提问环节，自信展示技术见解',
        effect: (s) => ({ network: Math.min(100, (s.network || 0) + 5), charm: Math.min(25, s.charm + 3), message: '你的提问得到了老黄的幽默点评，现场几位 VC 主动递上了名片！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '默默听完讲座，去大学路吃一碗热气腾腾的拉面',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: Math.min(25, s.charm + 1), message: '顶级思维碰撞加上一碗热拉面，让你度过了一个充实而愉快的周五夜晚。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'tesla_fsd_unsupervised_scare': {
    id: 'tesla_fsd_unsupervised_scare',
    title: '【FSD 惊魂】101 高速自动驾驶施工路段幽灵刹车',
    description: '周一早高峰晚点，你在 101 高速上开启了最新版的 Tesla FSD 自动驾驶。车子在 Passing 施工路段时突然无征兆幽灵急刹...',
    choices: [
      {
        text: '吓出一身冷汗，立刻双手接管车轮',
        effect: (s) => ({ health: Math.max(0, s.health - 5), leetcode: s.leetcode + 3, message: '你惊险避免了后车追尾！经此一役，你对自动驾驶边界条件有了更深的工程体会。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '把行车记录仪视频剪辑发 YouTube / B站爆火',
        effect: (s) => ({ charm: Math.min(25, s.charm + 4), message: '你的幽灵刹车测试视频获得了 50,000+ 播放，吸引了大批极客粉丝关注！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
,
  'property_supplemental_tax_hike': {
    id: 'property_supplemental_tax_hike',
    title: '【房产重击】加州 Santa Clara 县评估员重估房屋补充房产税账单',
    description: '周五下班回家，你打开信箱赫然发现一封来自 Santa Clara 县 Assessor 评估办公室的挂号信：由于房产评估值重估，你必须限期补缴 Supplemental Property Tax 补充房产税及加州县级附加税！',
    choices: [
      {
        text: '咬牙全额缴纳补充房产税账单 (消耗 $3w 现金)',
        condition: (s) => s.cash >= 3,
        effect: (s) => ({ cash: s.cash - 3, health: s.health - 5, message: '你一次性补齐了 $3w 房产税账单，虽然心痛不已，但保住了房产产权。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '聘请专业 Property Tax Appeal 申诉律师写辩护书 (花费 $1w 律师费)',
        condition: (s) => s.cash >= 1,
        effect: (s) => {
          const win = Math.random() < 0.5;
          return win
            ? { cash: s.cash - 1, charm: Math.min(25, s.charm + 2), message: '律师出面成功证明了评估值虚高，帮为你减免了绝大部分额外房产税！胜诉！' }
            : { cash: s.cash - 4, health: s.health - 10, message: '申诉失败，你不仅补缴了 $3w 房产税，还倒贴了 $1w 律师费！痛苦加倍。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '现金吃紧，向县政府申请税款延期与分期还款协议 (健康 -10)',
        condition: (s) => s.cash < 1,
        effect: (s) => ({ health: Math.max(0, s.health - 10), message: '在复杂的延期申诉流程后，你成功申请了税款分期，暂时化解了滞纳金危机。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'luxury_car_vandalism_towing': {
    id: 'luxury_car_vandalism_towing',
    title: '【破财消灾】豪车 Palo Alto 街头遭遇恶意砸车与霸王拖车',
    description: '你停在 Palo Alto 大学路旁边的保时捷 / 豪车突然被无良拖车公司强行拖走！不仅车窗被恶意损坏，恶霸拖车公司还开出了包含强制 Storage 存放费的天价赎车单...',
    choices: [
      {
        text: '花钱消灾，直接缴纳天价赎车费与维修费 (消耗 $2w 现金)',
        condition: (s) => s.cash >= 2,
        effect: (s) => ({ cash: s.cash - 2, health: s.health - 5, message: '你一次性掏出 $2w 赎回了豪车并修好了大灯。高阶玩家的烦恼往往就是这么朴实无华。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '找律师控诉并录制视频发小红书/YouTube 曝光 (消耗 $0.5w 现金)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ cash: s.cash - 0.5, health: s.health - 10, charm: Math.min(25, s.charm + 3), message: '你的曝光视频引发了舆论关注，拖车公司迫于压力退还了赎车费，但你折腾得精疲力竭。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '现金不足，强行刷信用卡透支支付赎车费 (健康 -10)',
        condition: (s) => s.cash < 0.5,
        effect: (s) => ({ health: Math.max(0, s.health - 10), cash: s.cash - 0.5, message: '在现金彻底见底的情况下，你不得不信用卡透支结清拖车费赎回了车辆。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'high_level_reorg_domain_loss': {
    id: 'high_level_reorg_domain_loss',
    title: '【高阶重组】VP 换人导致 Architecture 推翻，Domain Knowledge 清零',
    description: '公司高层爆发权斗，新上任的 VP 带来了自己的亲信。你带领团队搭建了三年的核心系统架构被宣布“全盘废弃，全面拥抱新架构”！多年积累的领域知识 (Domain Knowledge) 一夕沉没...',
    choices: [
      {
        text: '通宵加班重头学习最新 Infra 业务架构',
        effect: (s) => ({ health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 10), message: '凭着硬核的学习能力，你咬牙掌握了新架构，重新站稳了团队的核心位置！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '极度挫败！因长期未手写底层代码，算法实力与热情下滑',
        effect: (s) => ({ leetcode: Math.max(20, s.leetcode - 15), health: Math.min(100, s.health + 5), message: '长期从事高层画饼与 PPT 汇报，导致你的手写算法功力大幅生疏，算法实力下滑。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'irs_tax_audit_crisis': {
    id: 'irs_tax_audit_crisis',
    title: '【国税局查账】收到 IRS CP2000 稽查信与 FBAR 审计',
    description: '周一信箱赫然出现一封盖着 IRS 标志的加急信！美国国税局对你过去三年的股票股票解禁、副业收入以及海外账户 (FBAR) 进行了严格查账，要求补充完整证明或缴纳补税与滞纳金。',
    choices: [
      {
        text: '聘请顶级 CPA 注册会计师与税务律师处理 (消耗 $4w 现金)',
        condition: (s) => s.cash >= 4,
        effect: (s) => ({ cash: s.cash - 4, message: '顶级 CPA 出面帮你处理了所有复杂的税务审计纠纷，彻底平息了 IRS 查账危机！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '自己跟 IRS 沟通并补交滞纳金与罚款 (消耗 $2.5w 现金)',
        condition: (s) => s.cash >= 2.5,
        effect: (s) => ({ cash: s.cash - 2.5, health: Math.max(0, s.health - 10), message: '你在复杂的税务表格与电话排队中被折磨得头昏脑涨，最终补齐了罚款结案。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '资金吃紧，向 IRS 申请分期付款协议 (IA Plan) 并配合补交材料 (健康 -15)',
        condition: (s) => s.cash < 2.5,
        effect: (s) => ({ health: Math.max(0, s.health - 15), message: '经过漫长的电话排队与表格递交，你成功与 IRS 达成了分期付款协议。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'agent_hallucination_prod_disaster': {
    id: 'agent_hallucination_prod_disaster',
    title: '【AI 幻觉事故】自主 Agent 生产环境误删数据库',
    description: '组里尝试用自主 Agent 跑 CI/CD 自动部署，结果 Agent 产生幻觉在脚本里执行了 DROP DATABASE，把生产环境数据库给删了！',
    choices: [
      {
        text: '通宵手写 SQL 脚本与备份恢复',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 15), message: '凭借硬核的数据库恢复功底，你连夜恢复了绝大部分备份，保住了生产环境！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '甩锅给大模型 API 供应商，申请专项赔偿 (消耗 $0.5w)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 2), cash: Math.max(0, s.cash - 0.5), message: '虽然倒贴了一些补偿金，但团队把主要责任交给了云端模型供应商的幻觉缺陷。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },
  'mac_mini_open_claw_server': {
    id: 'mac_mini_open_claw_server',
    title: '【本地 AI 极客】买 Mac Mini 部署 OpenClaw 本地 Agent',
    description: '为避免云端 API 账单爆表与隐私泄露，你果断花了 $2,000 美金抢购了一台 64GB 统一内存的 Mac Mini，在客厅 24 小时本地部署跑 OpenClaw / 本地自主 Agent！',
    choices: [
      {
        text: '调教 Agent 替你跑抓取与总结邮件 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), leetcode: Math.min(100, s.leetcode + 4), health: Math.min(100, s.health + 5), message: '本地 OpenClaw 部署成功！虽然折腾 YAML 配置有点累，但 Agent 帮处理了不少琐碎爬虫与邮件任务。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '折腾三天环境，发小红书“湾区码农客厅 AI 服务器” (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(25, s.charm + 2), message: '你的客厅 Mac Mini 服务器组照获得了 200+ 赞，不少极客同仁在评论区交流开源部署心得。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '资金吃紧，改在旧电脑上配置免费开源 Local Model 尝试轻量测试',
        condition: (s) => s.cash < 0.2,
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 2), message: '你在旧设备上搭建了轻量版本地 Agent，虽然算力有限但体验了本地 AI 的乐趣。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'multi_agent_side_hustle': {
    id: 'multi_agent_side_hustle',
    title: '【Multi-Agent 副业】部署无人值守 Agent 自动套利',
    description: '你自己写了一套 Multi-Agent 架构，全网 24 小时自动化抓取美股财报、套利与量化小工具。',
    choices: [
      {
        text: '定时提现副业收益 (现金 +$12w)',
        effect: (s) => ({ cash: s.cash + 12, health: Math.max(0, s.health - 5), message: 'Multi-Agent 自动套利脚本为你带来了 $12w 额外副业现金流！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '规模过大被 Cloudflare 封禁 IP，倒贴伺服器租金 (消耗 $1w)',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 1), message: '频繁并发触发了云端防爬虫拦截，脚本失效并损失了一笔服务器租金。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'fashion_disaster_hoodie': {
    id: 'fashion_disaster_hoodie',
    title: '【湾区穿搭】洞洞鞋 + 大厂旧 Hoodie 被吐槽',
    description: '你穿着起球的大厂旧 Hoodie、Patagonia 夹克和洞洞鞋去 Palo Alto 约会。餐桌上，朋友开玩笑吐槽：“你这一身活脱脱就是湾区油腻码农标配啊！”',
    choices: [
      {
        text: '坚称“这是极客硬核文化与 WLB 的象征”',
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), health: Math.min(100, s.health + 5), message: '你维持了自己的穿搭习惯，但在朋友眼里你的精致度与个人形象有所减分。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '痛下决心，去 Santana Row 购买几套修身休闲装 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(25, s.charm + 3), message: '换上合身的新衣服后，你整个人精神焕发，颜值与个人吸引力大幅提升！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'linkedin_cold_outreach_spam': {
    id: 'linkedin_cold_outreach_spam',
    title: '【人脉黑名单】LinkedIn 乱发 Cold Message 遭圈内避嫌',
    description: '你急于拓展圈子，用自动化脚本向湾区 200 多位大厂 Director / VP 批量发送了推销自己的 Cold Message。结果被某总监截图发在 Pulse 专栏吐槽“缺乏基本职业素养”...',
    choices: [
      {
        text: '在评论区与发帖总监论战维护尊严',
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 5), health: Math.max(0, s.health - 5), message: '你在评论区的生硬辩解招致了更多业内大佬的抵触，人脉网络受损。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '私信向对方诚恳致歉并主动关闭脚本',
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 2), charm: Math.min(25, s.charm + 1), message: '你的诚恳态度平息了波澜，成功控制住了负面影响。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'ex_1point3acres_expose': {
    id: 'ex_1point3acres_expose',
    title: '【避雷爆料】一亩三分地情感版爆料帖：“湾区某大厂 L5 避雷全纪录”',
    description: '深夜微信群被一条一亩三分地热帖刷屏，标题赫然写着《湾区某大厂 L5 避雷，分手抢搬家具 + AA 小费极品全纪录》。帖子附带了匿名聊天记录截图与你特征极度明显的描述，瞬时冲上了论坛热榜第一！',
    choices: [
      {
        text: '亲自下场在论坛回复发帖与前任对撕澄清',
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 5), charm: Math.max(0, s.charm - 4), health: Math.max(0, s.health - 10), message: '两人的互撕引发了千人围观吃瓜，你在湾区华人圈与同组同事面前丢尽了颜面，人脉与形象重创！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装作没看见并找论坛管理员申请隐去敏感信息 (花费 $0.1w)',
        condition: (s) => s.cash >= 0.1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), network: Math.max(0, (s.network || 0) - 2), charm: Math.max(0, s.charm - 2), message: '论坛管理员删除了包含个人身份的信息，虽然负面影响逐渐平息，但你依然社死休养了半个月。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'hair_loss_and_slouch': {
    id: 'hair_loss_and_slouch',
    title: '【职业病危机】发际线后移与湾区体态衰退',
    description: '长期 996 熬夜死磕代码与高压 Oncall，你无意中照镜子惊恐地发现自己的发际线急剧后移，且出现了严重的倒三角龟脖与弯腰驼背体态！',
    choices: [
      {
        text: '无视它，“程序员靠硬核算法实力说话，不靠颜值”',
        effect: (s) => ({ charm: Math.max(0, s.charm - 4), health: Math.max(0, s.health - 5), message: '你放任了体态衰退，虽然省下了精力，但在同龄社交局中显得愈发沧桑。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '预约土耳其植发与高端体态矫正普拉提 (花费 $0.5w)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.5), charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: '植发与体态矫正效果显著！你的精气神与个人吸引力大幅度恢复！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'social_withdrawal_burnout': {
    id: 'social_withdrawal_burnout',
    title: '【社交退化】闭门不出与社恐自我隔离',
    description: '近两年来你除了在 MicroKitchen (MK) 拿气泡水外几乎没进行过工作以外的社交，感觉自己的口头表达能力与圈子广度急剧退化...',
    choices: [
      {
        text: '继续宅在宿舍/家里，下班打单机游戏',
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), network: Math.max(0, (s.network || 0) - 3), health: Math.min(100, s.health + 5), message: '你沉浸在宅家快乐中，但你的社交朋友圈与个人形象进一步萎缩。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '强迫自己报名湾区狼人杀局与攀岩圈 (花费 $0.05w)',
        condition: (s) => s.cash >= 0.05,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.05), charm: Math.min(25, s.charm + 2), network: Math.min(100, (s.network || 0) + 3), message: '在桌游与攀岩中你结识了多位开朗的新朋友，重新找回了社交节奏！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'rednote_influencer_side_hustle': {
    id: 'rednote_influencer_side_hustle',
    title: '【网红副业】小红书/自媒体高形象变现',
    description: '由于你出众的形象与湾区大厂生活 Vlog，你在小红书和 YouTube 积累了数万粉丝，多家品牌方发来商业广告邀约！',
    choices: [
      {
        text: '接下品牌商业植入推广，开启副业变现！',
        effect: (s) => ({ cash: s.cash + 2, charm: Math.min(25, s.charm + 1), message: ' 爆款变现！商业合作广告大获成功，你轻松斩获 $2w 美元额外副业收益！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '保持纯粹，只分享生活日常，拒绝硬广洗脑',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 5), message: '你的真实与接地气圈粉无数，获得了绝佳的粉丝口碑！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'parents_us_visit': {
    id: 'parents_us_visit',
    title: '【爸妈探亲】B2 签证赴美与中西文化碰撞',
    description: '爸妈拿着 10 年 B2 签证飞抵旧金山 SFO！老两口打算在湾区住上三个月。老爸每天在小区后院尝试种韭菜养鸡被 HOA 警告，老妈则带你在 99 大华超市狂购并吐槽湾区天价中餐...',
    choices: [
      {
        text: '全程陪同！请假带爸妈自驾一号公路去 17 Mile 与 Napa 品酒 (花费 $0.3w)',
        condition: (s) => s.cash >= 0.3,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.3), health: Math.min(100, s.health + 5), charm: Math.min(25, s.charm + 2), network: Math.min(100, (s.network || 0) + 2), message: '虽然老妈一路吐槽加州紫外线强且嫌纳帕红酒贵，但看到朋友圈晒满照片并收获老家亲戚数百赞，你感受到了久违的家庭温暖。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '给爸妈报华人大巴老年团，让他们自己去黄石公园与大峡谷 (花费 $0.15w)',
        condition: (s) => s.cash >= 0.15,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.15), health: Math.min(100, s.health + 5), message: '老两口在大巴团里结识了一圈同龄阿姨叔叔，每天聊得热火朝天，顺便还帮你拉到了几个潜在相亲对象的信息。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '工作太忙无暇陪同，让爸妈自己在 South Bay 散步看戏',
        effect: (s) => ({ health: Math.max(0, s.health - 5), message: '老爸因后院翻土种韭菜遭到了 HOA 邻居联名警告，老妈抱怨湾区除了大超市啥都没有像大农村，老两口带着满腹牢骚提前回国了。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },
  'boba_opening_frenzy': {
    id: 'boba_opening_frenzy',
    title: '【湾区网红潮】南湾新开爆款奶茶店排队狂潮',
    description: '南湾 Westfield 购物中心新开了一家号称“国内顶流”的网红奶茶烘焙店，朋友圈与小红书被全网刷爆，连湾区大厂码农和网红都在烈日下排起了长龙！',
    choices: [
      {
        text: '跟风排队！周末烈日下排队 2 小时打卡并发小红书 (花费 $0.02w)',
        condition: (s) => s.cash >= 0.02,
        effect: (s) => {
          const win = Math.random() < 0.70;
          return win
            ? { cash: Math.max(0, s.cash - 0.02), charm: Math.min(25, s.charm + 2), health: Math.max(0, s.health - 3), message: '排队 2.5 小时终于喝到了！随手加了滤镜发小红书获得了 200+ 点赞，极大满足了湾区潮人的虚荣心！' }
            : { cash: Math.max(0, s.cash - 0.02), health: Math.max(0, s.health - 6), message: '排队两小时，一口喝下去发现又甜又贵纯纯智商税！不仅被加州阳光晒脱皮，还因高糖奶茶腹泻了半天。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '闪送黄牛代排！多花钱找跑腿黄牛送至办公室 (花费 $0.08w)',
        condition: (s) => s.cash >= 0.08,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.08), charm: Math.min(25, s.charm + 1), message: '多花了几万韩元/跑腿费免去了排队晒太阳之苦，你在办公室悠闲地喝着网红奶茶，收获了同事羡慕的目光。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '清流拒绝！去大厂 MicroKitchen (MK) 薅免费 LaCroix 气泡水',
        effect: (s) => ({ health: Math.min(100, s.health + 5), cash: s.cash + 0.05, message: '你拒绝了消费主义洗脑。周末假装去公司加班，从 MicroKitchen (MK) 顺走了两罐气泡水与坚果，省钱又健康！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  // === 职场长线 NPC 与多幕剧情因果链 (Long-term NPC Narrative Arcs) ===
  'alex_startup_series_a': {
    id: 'alex_startup_series_a',
    title: '【硅谷前沿】Alex 博士的咖啡馆深谈',
    description: '在 Palo Alto University Ave 的 Philz Coffee，当年的伯乐 Alex 博士递给你一杯 Mint Mojito。他神情兴奋地推过来一份 Pitch Deck：“我们正在打造具身智能与多智能体底座——OmniAgent，刚拿到红杉沙丘路 $1200w Series A 领投。来做早期核心合伙人吧，期权管够！”',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '【All-in 核心合伙人】降薪加入，拿 2.5% 早期原始股权 (转为 Startup 核心)',
        condition: (s) => !s.laid_off && s.job_type !== 'unemployed',
        effect: (s) => ({
          job_type: 'startup',
          company: 'OmniAgent AI',
          tc: Math.max(16, Math.floor((s.tc || 25) * 0.65)),
          health: Math.max(0, s.health - 10),
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', affinity: 95, status: 'ally', company: 'OmniAgent AI', note: 'OmniAgent 创始人，并肩作战' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            joined_omniagent: true,
            omniagent_start_year: s.year
          },
          message: '【全职合伙人启航】你正式以早期核心合伙人身份加入 OmniAgent AI！手握 2.5% 原始股权，与 Alex 一起在硅谷车库与算力集群日夜攻坚！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【天使注资支持】出资 $10w 个人现金作为天使轮投资人 (拿早期投资份额)',
        condition: (s) => s.cash >= 10,
        reqBadge: '需现金≥$10w',
        effect: (s) => ({
          cash: s.cash - 10,
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', affinity: 90, status: 'ally', company: 'OmniAgent AI', note: '天使投资项目创始人' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            angel_invest_omniagent: true,
            omniagent_start_year: s.year
          },
          message: '【天使注资】你以个人天使身份给 OmniAgent 开出 $10w 支票！Alex 感动地握住你的手：“兄弟，上市敲钟那天第一排有你的位置！”'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【稳健保守】婉拒全职加入，答应担任外部兼职技术顾问 (保持盟友关系)',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 15),
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', affinity: 85, status: 'ally', company: 'OmniAgent AI', note: '独角兽创始人，外部顾问' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            omniagent_advisor: true
          },
          message: '你保持了大厂的稳定生活，并作为顾问为 Alex 介绍了多位大牛校友。Alex 依然视你为最信赖的技术智囊！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'alex_omniagent_ipo_exit': {
    id: 'alex_omniagent_ipo_exit',
    title: '【前沿分水岭】OmniAgent 终局生死战与退出评估',
    description: '创业三年，Alex 博士创办的 OmniAgent AI 迎来了决定生死与估值的终局大考。大模型算力大战进入白热化，资本市场正在对公司进行深度尽调与估值清算...',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '【全职合伙人结算】清算团队期权股权与终局退出命运',
        condition: (s) => !!s.story_flags?.joined_omniagent,
        hideIfUnavailable: true,
        effect: (s) => {
          const bullBonus = s.macro_economy === 'bull' ? 0.08 : s.macro_economy === 'bear' ? -0.06 : 0;
          const techBonus = s.leetcode >= 60 ? 0.05 : 0;
          const luckBonus = (s.luck || 20) / 1000;
          const ipoProb = Math.max(0.05, Math.min(0.25, 0.12 + bullBonus + techBonus + luckBonus));
          const acquiHireProb = 0.45;
          const rand = Math.random();

          if (rand < ipoProb) {
            return {
              cash: s.cash + 50,
              stocks: (s.stocks || 0) + 40,
              health: Math.min(100, s.health + 10),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【纳斯达克敲钟】OmniAgent 克服万难成功上市 (代码 $OMNI)！虽然经历了多轮股权稀释，但作为早期核心员工你的期权依然套现了 $50w 现金与 $40w 股票！'
            };
          } else if (rand < ipoProb + acquiHireProb) {
            return {
              cash: s.cash + 20,
              stocks: (s.stocks || 0) + 15,
              job_type: 'big_tech',
              company: 'google',
              level: s.level === 'L6 (Staff)' ? 'L6 (Staff)' : 'L5 (Senior)',
              tc: Math.max(s.tc, 34),
              health: Math.min(100, s.health + 5),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【巨头高溢价收购】Google 以 1.5 亿美元收购 OmniAgent 团队！作为早期技术骨干，你分到了 $20w 现金与 $15w 留任股票，并被吸纳入大厂担任 Senior 架构师！'
            };
          } else {
            return {
              job_type: 'unemployed',
              laid_off: true,
              tc: 0,
              leetcode: s.leetcode + 12,
              network: Math.min(100, (s.network || 10) + 8),
              health: Math.max(0, s.health - 6),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【算力链条断裂】大模型集群烧光了融资储备，公司进入破产清算。期权化为废纸，但你沉淀了硬核 AI 架构落地能力，在求职市场备受大厂抢夺！'
            };
          }
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_year_end_settlement'
      },
      {
        text: '【天使投资人结算】清算天使轮协议与投资回报',
        condition: (s) => !!s.story_flags?.angel_invest_omniagent,
        hideIfUnavailable: true,
        effect: (s) => {
          const bullBonus = s.macro_economy === 'bull' ? 0.08 : s.macro_economy === 'bear' ? -0.06 : 0;
          const ipoProb = Math.max(0.05, Math.min(0.25, 0.12 + bullBonus));
          const acquiHireProb = 0.45;
          const rand = Math.random();

          if (rand < ipoProb) {
            return {
              cash: s.cash + 30,
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【投资大捷】OmniAgent 纳斯达克挂牌上市，你的 $10w 天使轮投资获得了 3 倍退出回报 (净回款 $30w 现金)！'
            };
          } else if (rand < ipoProb + acquiHireProb) {
            return {
              cash: s.cash + 13,
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【收购退出】OmniAgent 被大厂收购清偿优先股，你的 $10w 天使投资拿回了 $13w 本金与少量收益。'
            };
          } else {
            return {
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【投资失利】OmniAgent 算力耗尽清算倒闭，你的 $10w 天使投资打了水漂，交了一笔昂贵的硅谷天使学费。'
            };
          }
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【朋友圈见证】在朋友圈转发 OmniAgent 商业新闻并为老友 Alex 点赞',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 1),
          story_flags: {
            ...(s.story_flags || {}),
            alex_ipo_done: true
          },
          message: '你在朋友圈见证了初创团队在 AI 浪潮中的商战起伏。Alex 看到后发来私信：“无论成败，感谢一路以来的建议与支持！”'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dave_retaliation_showdown': {
    id: 'dave_retaliation_showdown',
    title: '【绝地反击】Manager Dave 闭门考核摊牌战',
    description: '年度闭门考核会上，Manager Dave 故技重施，试图将跨部门核心基建成果归功于他自己，并以“跨组对齐不达标”为由在系统里给你打了 Needs Improvement。但他不知道，你早已布下了天罗地网！',
    choices: [
      {
        text: '【雷霆出击】向 HR 廉政合规组与 Skip-level VP 提交 40 页证据链 (反向击溃 Dave)',
        condition: (s) => !!s.story_flags?.has_dave_evidence,
        reqBadge: '需 掌握证据链',
        effect: (s) => {
          const cur = s.level || 'L4';
          const nextLvl = (cur === 'L3') ? 'L4' : (cur === 'L4') ? 'L5 (Senior)' : cur;
          return {
            tc: s.tc + 4.5,
            level: nextLvl,
            health: Math.min(100, s.health + 8),
            charm: Math.min(25, (s.charm || 10) + 3),
            npcs: {
              ...(s.npcs || {}),
              dave: { name: 'Manager Dave', role: 'manager', affinity: 0, status: 'nemesis', note: '职场宿敌，被你的审计证据直接击溃' }
            },
            story_flags: {
              ...(s.story_flags || {}),
              dave_defeated: true,
              dave_defeated_year: s.year
            },
            message: '【证据确凿】VP 亲自介入调查，确认 Dave 存在严重抢占成果与职场霸凌行为！Dave 被撤职调离，你因硬核技术与正直表现获得常规绩效调薪 +$4.5w！'
          };
        },
        nextEventId: 'promo_celebration'
      },
      {
        text: '【实力跳槽降维打击】手握扎实代码，连夜接下 Meta/Nvidia 的 L5 Senior Offer',
        condition: (s) => s.leetcode >= 45,
        effect: (s) => ({
          company: 'meta',
          job_type: 'big_tech',
          level: 'L5 (Senior)',
          tc: Math.max(s.tc + 3.5, 32),
          health: Math.min(100, s.health + 5),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 10, status: 'departed', note: '前组经理，已被你甩在身后' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            dave_defeated: true,
            dave_defeated_year: s.year
          },
          message: '【优雅离场】你当场甩出 2 周离职信，带走核心上下文跳槽 Meta！Dave 的烂摊子彻底无人收拾，在部门大会上狼狈不堪！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【据理力争】在闭门考核中据理力争驳斥不合理指标，虽未扳倒 Dave 但守住了底线',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          story_flags: {
            ...(s.story_flags || {}),
            dave_defeated: true,
            dave_defeated_year: s.year
          },
          message: '你用详实的工作日志据理力争，使得 Dave 不得不收敛了恶意针对。你保住了正常评级，并决定加快晋升或跳槽步伐。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dave_interview_veto': {
    id: 'dave_interview_veto',
    title: '【命运轮回】面试官桌对面的熟悉面孔',
    description: '作为技术委员会核心考官，你打开今天的 Staff 架构师候选人简历。当抬头看到推门进来的应聘者时，双方都愣住了——居然是头发稀疏、略显疲态的 Manager Dave！当年不可一世的他，如今在求职市场上辗转求生。',
    choices: [
      {
        text: '【一票否决 (Veto)】在系统写下 "Technical Depth 不足，Strong Reject"',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 3),
          health: Math.min(100, s.health + 10),
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '【天道好轮回】你在评语写道：“缺乏一线架构实战能力，倾向于 PPT 汇报，与团队技术文化不符。” 终面一票否决！多年怨气一扫而空！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【招入麾下】“准了！招进来当我的汇报下属，天天给我写对齐周报”',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 5),
          health: Math.min(100, s.health + 10),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 40, status: 'active', note: '如今成为向你汇报的下属' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '【攻守易形】Dave 诚惶诚恐地接了 Offer。现在轮到他每周五下午 4 点向你诚惶诚恐地汇报 1:1 了！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【客观包容】不带个人恩怨，就事论事客观评估技术表现',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 6),
          network: Math.min(100, (s.network || 10) + 10),
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '你展现了硅谷顶级技术领袖的从容格局。Dave 在面试结束后深深向你鞠躬致谢，对当年的行为悔恨不已。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'sam_garage_zero_day': {
    id: 'sam_garage_zero_day',
    title: '【黑客车库】极客 Sam 的 Zero-Day 漏洞探险',
    description: '当年一起在 ACM 赛场拼杀的怪才极客 Sam 突然给你发来加密 Telegram 消息：“哥们！我发现了一家头部 AI 算力云平台的底层集群权限逃逸漏洞 (Zero-Day)！按官方漏洞悬赏 (Bug Bounty) 规则能领 $6w 赏金！今晚来我车库一起把 PoC 跑通！”',
    choices: [
      {
        text: '【通宵协作】带上电脑去 Sam 车库通宵验证漏洞 PoC',
        condition: (s) => s.leetcode >= 25,
        effect: (s) => {
          const pass = (s.leetcode >= 40) || Math.random() < 0.65;
          return pass
            ? {
                cash: s.cash + 3.0,
                leetcode: s.leetcode + 8,
                health: Math.max(0, s.health - 8),
                npcs: {
                  ...(s.npcs || {}),
                  sam: { name: '极客 Sam', role: 'co_founder', affinity: 100, status: 'ally', note: '生死战友，安全黑客' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  sam_zero_day_done: true
                },
                message: '【提交成功】厂商安全团队半夜紧急修复并向你们转账 $6w 赏金！你与 Sam 五五分账，净入账 +$3w 现金！'
              }
            : {
                health: Math.max(0, s.health - 10),
                leetcode: s.leetcode + 4,
                story_flags: {
                  ...(s.story_flags || {}),
                  sam_zero_day_done: true
                },
                message: '厂商回复称该问题为“已知设计”，白喝了 6 罐无糖可乐，不过你与 Sam 的配合愈发默契。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '劝阻 Sam 并注意安全合规，专注于大厂正规架构工作',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          story_flags: {
            ...(s.story_flags || {}),
            sam_zero_day_done: true
          },
          message: '你提醒了 Sam 遵守合法披露准则。Sam 听从了你的建议，避免了潜在的法律风险。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
};
