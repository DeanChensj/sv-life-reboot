import type { GameState, GameEvent } from '../types';

// Initial State
export const generateInitialState = (): GameState => {
  let savedSeed: { cash: number; charm: number; max_charm: number; luck: number } | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('sv_life_initial_seed');
      if (stored) savedSeed = JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
  }

  let cash: number, charm: number, max_charm: number, luck: number;

  if (savedSeed) {
    cash = savedSeed.cash;
    charm = savedSeed.charm;
    max_charm = savedSeed.max_charm;
    luck = savedSeed.luck;
  } else {
    const randCash = Math.random();
    if (randCash < 0.6) {
      cash = Math.floor(Math.random() * 8) + 2; // 2 - 10 万美元 (普通家庭)
    } else if (randCash < 0.9) {
      cash = Math.floor(Math.random() * 15) + 10; // 10 - 25 万美元 (小康中产)
    } else {
      cash = Math.floor(Math.random() * 25) + 25; // 25 - 50 万美元 (富裕家庭)
    }
    charm = Math.floor(Math.random() * 10) + 1; // 颜值 1-10
    max_charm = Math.min(30, Math.max(15, charm + Math.floor(Math.random() * 6) + 8));
    luck = Math.floor(Math.random() * 100);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sv_life_initial_seed', JSON.stringify({ cash, charm, max_charm, luck }));
      } catch (e) {
        console.error(e);
      }
    }
  }

  const ap = 3;
  const max_ap = 3;
  
  let bgMessage = '';
  if (cash > 60) bgMessage += '你出生在一个富裕的家庭，启动资金充足！';
  else if (cash < 20) bgMessage += '你出生在一个普通家庭，预算非常吃紧。';
  else bgMessage += '你出生在一个小康家庭。';

  if (charm >= 9) bgMessage += ' 顺便一提，你从小就长得像大明星，走到哪里都是焦点。';
  else if (charm <= 3) bgMessage += ' 长相平平无奇，是个实在人。';

  return {
    ap,
    max_ap,
    age: 18,
    cash,
    health: 100,
    leetcode: 10,
    visa: '无',
    tc: 0,
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
    status: 'playing',
    message: bgMessage
  };
};

// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Weaves in 1-2 random events before year-end settlement.
const midYearEventRouter = (s: GameState) => {
  const rand = Math.random();
  const isWorking = s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
  const isBigTech = s.job_type === 'big_tech' || s.job_type === 'amazon' || s.job_type === 'tiktok' || s.job_type === 'nvidia';

  if (s.year === 2022 && Math.random() < 0.15) return 'stock_crash';
  if (rand < 0.06) return 'stock_crash';
  if (rand >= 0.06 && rand < 0.46) {
     if (!isWorking) return 'job_hunt';
     if (s.job_type === 'startup') return 'startup_crisis';
     if (s.job_type === 'ai_research') return 'ai_research_crisis';
     if (s.job_type === 'quant') return 'quant_stress';
     const bigTechRand = Math.random();
     if (bigTechRand < 0.25) return 'perf_review';
     if (bigTechRand < 0.45) return 'layoff_rumor';
     if (bigTechRand < 0.60) return 'rto_wars';
     if (bigTechRand < 0.80) return 'meta_tlm';
     if (bigTechRand < 0.90) return 'h1b_rfe_vs_parent_nag';
     return 'friday_pip';
  }
  if (rand >= 0.46 && rand < 0.80) {
    const lifeEvents = [
      'pickleball_networking', 'dental_emergency', 'crypto_scam', 
      'boba_inflation', 'xhs_boba', 'ai_wrapper_startup', 'biohacking_party', 'tahoe_ski_blizzard', 
      'burning_man_invite', 'boardgame_dating', 'rock_climbing_event', 'tennis_networking', 'bay_area_hiking', 'hawaii_vacation',
      'credit_card_churning', 'vibe_coding_craze', 'ai_agent_startup'
    ];
    
    // Only working folks have Overemployed, blind gossips, and zoom camera off
    if (isWorking) {
        lifeEvents.push('overemployed', 'blind_team_tea', 'zoom_camera_off_leetcode');
    }
    
    // Only Big Tech folks have RSU crashes
    if (isBigTech) {
        lifeEvents.push('rsu_vesting_crash');
    }

    // 1. Green Card Holders ONLY: japan_trip (免签自由行)
    if (s.visa === '绿卡' && Math.random() < 0.20) {
      return 'japan_trip';
    }

    // 2. Non-Green Card H1B/O1 Holders ONLY: h1b_visa_stamping_crisis (回国续签查水表)
    if ((s.visa === 'H1B (工签)' || s.visa === 'O1 (杰出人才)') && Math.random() < 0.15) {
      return 'h1b_visa_stamping_crisis';
    }

    // 3. Luxury Car Owners ONLY: luxury_car_meet (豪车会跑山)
    if ((s.car === 'porsche' || s.car === 'cybertruck') && Math.random() < 0.20) {
      return 'luxury_car_meet';
    }

    // 4. Homeowners ONLY: house_warming_party (乔迁派对)
    const isRealHome = s.has_housing && s.housing_name && !['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
    if (isRealHome && Math.random() < 0.20) {
      return 'house_warming_party';
    }

    // 5. High Cash ($100w+) ONLY: startup_angel_investing (天使投资)
    if (s.cash >= 100 && Math.random() < 0.20) {
      return 'startup_angel_investing';
    }

    // 6. NVDA Surge (2023+ AI Boom)
    if (s.year >= 2023 && Math.random() < 0.18) {
      return 'nvidia_stock_surge';
    }

    // 7. Married Couples ONLY: bay_area_dink_vs_kids (DINK vs 鸡娃抢学区房)
    if ((s.is_married || s.relationship_status === 'married') && Math.random() < 0.20) {
      return 'bay_area_dink_vs_kids';
    }

    // 8. Late Game Crises (Age >= 35 or Year >= 2024 or Homeowners)
    if (s.age >= 35 && (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') && Math.random() < 0.25) {
      return 'midlife_management_pivot';
    }
    if (s.year >= 2024 && isWorking && Math.random() < 0.20) {
      return 'ai_disruption_existential';
    }
    if (isRealHome && s.age >= 32 && Math.random() < 0.20) {
      return 'property_hoa_special_assessment';
    }
    if (s.age >= 35 && s.health <= 60 && Math.random() < 0.25) {
      return 'health_burnout_warning';
    }

    // Only non-Green Card / non-US workers face visa checks
    if (s.visa !== '绿卡' && s.visa !== '无') {
        lifeEvents.push('visa_check');
    }

    // Married or Dating folks can get breakup crisis!
    if (s.is_married || s.relationship_status === 'married' || s.relationship_status === 'dating') {
        lifeEvents.push('breakup_crisis');
    } else {
        // Single / Matched / Dating folks can play boardgame dating
        lifeEvents.push('boardgame_dating');
    }

    // STRICTLY NON-MARRIED ONLY for dating_market (20% rebalanced rate)
    if (!s.is_married && s.relationship_status !== 'married' && Math.random() < 0.20) {
        return 'dating_market';
    }

    if (s.car && s.car !== 'none' && Math.random() < 0.25) return 'car_broken';
    return lifeEvents[Math.floor(Math.random() * lifeEvents.length)];
  }
  return 'sv_year_end_settlement';
};

// Events Engine
export const events: Record<string, GameEvent> = {

  'choose_trait': {
    id: 'choose_trait',
    title: '重新投胎 (选择天赋)',
    description: '在转生到硅谷之前，上帝给了你一次选择天赋的机会。每个天赋都有独特的加成，也伴随着相应的代价。',
    choices: [
      {
        text: '【卷王之王】天生做题家，算法天赋极高，但体质较弱，极易过劳猝死。',
        effect: (s) => ({ trait_title: '卷王之王', leetcode: s.leetcode + 25, health: s.health - 25, network: 5, win_threshold: 400 }),
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
    title: '选择你的时代 (难度选择)',
    description: '宏观周期决定了个人命运。请选择你高中毕业、开启人生的年份：',
    choices: [

      {
        text: '2014年入学 (目标2018届毕业生)：黄金时代，风口起飞。',
        effect: (s) => ({ year: 2014 }),
        nextEventId: 'choose_school',
      },
      {
        text: '2018年入学 (目标2022届毕业生)：即将经历疫情放水与过山车般的裁员潮。',
        effect: (s) => ({ year: 2018 }),
        nextEventId: 'choose_school',
      },
      {
        text: '2019年入学 (目标2023届毕业生)：毕业即遇AI狂潮与地狱级卷王市场。',
        effect: (s) => ({ year: 2019 }),
        nextEventId: 'choose_school',
      }
    ]
  },
  'choose_school': {
    id: 'choose_school',
    title: '第一步：人生十字路口',
    description: '恭喜你高中毕业！拿着家里的启动资金，你现在面临择校的选择：',
    choices: [
      {
        text: '北美CS四大 (Stanford/MIT/CMU/UCB) (四年总开销 30 万美元)',
        condition: (s) => s.cash >= 30,
        effect: (s) => ({ cash: s.cash - 30, visa: 'F1 (学生)', has_us_degree: true, school: 'cmu', age: s.age, leetcode: s.leetcode + 5, health: s.health - 5, housing_name: '四大 校内宿舍', message: '你步入了世界计算机最高学府。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '理工强校大U (如 UIUC/UW/UMich) (四年总开销 25 万美元)',
        condition: (s) => s.cash >= 25,
        effect: (s) => ({ cash: s.cash - 25, visa: 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age, leetcode: s.leetcode + 5, housing_name: '大U 校内宿舍', message: '你来到了全美顶尖理工强校，准备体验硬核课业。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '美国普通公立大学 (四年总开销 15 万美元)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', has_us_degree: true, school: 'state', age: s.age, charm: s.charm + 2, housing_name: '美大U 校内宿舍', message: '你飞往美国，准备开启无忧无虑的本科生活。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '在国内读本科 (四年总开销 2 万美元)',
        effect: (s) => ({ cash: s.cash - 2, housing_name: '国内大学宿舍' }),
        nextEventId: 'cn_college_grad',
      },
      {
        text: '不上大学了！拿着启动资金直接创业',
        effect: (s) => ({ age: s.age + 2, message: '你辍学创业，体验了社会的毒打。' }),
        nextEventId: 'startup_work',
      }
    ]
  },
  'cn_college_grad': {
    id: 'cn_college_grad',
    title: '陆本大一/大二：百团大战与多维探索',
    description: '进入了国内大学，开学百团大战，各种社团、比赛与创业社招新。你打算如何安排这最初的两年？',
    choices: [
      {
        text: '加入 ACM 算法集训队 (硬核代码与刷题路线)',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 15, age: s.age + 1, message: '天天在机房死磕图论与动态规划，算法能力大幅提升！' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【金融/创投】参加全国大学生商业创投挑战赛',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 6), luck: Math.min(99, s.luck + 4), age: s.age + 1, message: '商业计划书打动了校外评委，拿到了创业鼓励金与名企实习推荐！' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【文娱自媒体】担任社团主唱 / 运营大学生活 VLOG',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), cash: s.cash + 0.8, health: Math.min(100, s.health + 5), age: s.age + 1, message: '你的网游/校园 VLOG 在 B站和小红书小火，涨粉数千并吸引了不少粉丝打赏！' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '加入学生会与外联部 (锻炼人际社交与组织能力)',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: s.health - 5, age: s.age + 1, message: '你在学生会拉赞助混得风生水起，结识了一圈活跃朋友。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【大厂暑期实习】抢到了国内一线互联网大厂实习',
        effect: (s) => ({ cash: s.cash + 2, leetcode: s.leetcode + 8, health: s.health - 8, age: s.age + 1, message: '在厂里体验了硬核工程落地，提前积累了实战经验。' }),
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
    description: '代表学校参加程序设计竞赛，比赛倒计时 15 分钟，核心题目评测机突然返回 Time Limit Exceeded (TLE)！',
    choices: [
      {
        text: '冷静打印 Code，用笔手写推导复杂度',
        effect: (s) => ({ leetcode: s.leetcode + 8, message: '你抓出了隐藏的 $O(N^2)$ 死循环！修改后封榜前压线 AC，拿到了银牌！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '狂换算法！重写线段树数据结构',
        effect: (s) => {
          const win = Math.random() < 0.45 + (s.leetcode / 200);
          return win
            ? { leetcode: s.leetcode + 12, cash: s.cash + 0.5, message: '逆天改命！最后一分钟提交绿色 Accepted！全队欢呼，拿下了比赛奖金！' }
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
        effect: (s) => ({ cash: s.cash + 1.2, charm: Math.min(25, s.charm + 6), message: '🎉 斩获金奖！评委大赞你的商业逻辑极具实战价值，当场颁发了 $1.2w 比赛项目奖金！' }),
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
    title: '陆本大三：迷茫期与抉择',
    description: '大三了，周围人都在考研、秋招、准备出国或直接创业。你的室友托福连挂三次，气氛格外紧张。',
    choices: [
      {
        text: '报班死磕托福/GRE (准备申请美国 CS 硕士)',
        effect: (s) => ({ cash: Math.max(0, s.cash - 2), health: s.health - 10, age: s.age + 1, message: '付出了巨大汗水，终于考出了满意的托福/GRE 分数！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【提前批秋招】冲击国内大厂提前批 Offer',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 10, age: s.age + 1, message: '凭着扎实的算法手撕，提前斩获了国内大厂的 SSP 保底 Offer！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【金融/咨询实习】投递顶级外企咨询与券商行研实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(25, s.charm + 6), health: s.health - 8, age: s.age + 1, message: '获得了极佳的金融行研锻炼，简历含金量大增！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '佛系对待，每天在寝室打黑神话悟空',
        effect: (s) => ({ health: Math.min(100, s.health + 10), leetcode: Math.max(0, s.leetcode - 5), age: s.age + 1, message: '虽然精神很愉悦，但放慢了备战的脚步。' }),
        nextEventId: 'cn_undergrad_grad',
      }
    ]
  },
  'us_undergrad_grad': {
    id: 'us_undergrad_grad',
    title: '美本毕业',
    description: '四年过去了，你顺利从美国大学毕业，目前持有 OPT。现在是找工作还是继续深造？',
    imageUrl: 'images/stanford_graduation.jpg',
    choices: [
      {
        text: '申请北美顶尖 PhD (录取率低, 需 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => {
          const pass = Math.random() < (0.30 + (s.school === 'cmu' ? 0.25 : 0) + (s.leetcode >= 70 ? 0.20 : 0));
          return pass 
            ? { cash: s.cash + 2, age: s.age + 1, is_phd: true, housing_name: '美国 博士实验室', message: '大喜讯！你战胜了数千名申请者，斩获北美顶级 CS 全奖 PhD Offer！' }
            : { health: s.health - 15, age: s.age + 1, message: '今年 CS 顶校 PhD 全奖录取率极低，你的推荐信被审稿人刷了，惨遭拒信。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'job_hunt',
      },

      {
        text: '直接找工作 (开始受苦)',
        effect: (s) => s.year === 2020 
          ? { message: '疫情爆发！各大公司全面冻结招聘，应届生找工作异常艰难！你被迫留在学校延长毕业一年。', health: s.health - 10, year: s.year + 1, age: s.age + 1 }
          : { visa: 'OPT (实习)', leetcode: s.leetcode + 10, message: '你开始了漫漫求职路...' },
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
    title: '陆本毕业',
    description: '四年过去了，你在国内大学打下了坚实的代码基础。接下来去哪里？',
    choices: [
      {
        text: '全奖直博美国 (录取率地狱级, 需 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => {
          const pass = Math.random() < (0.25 + (s.leetcode >= 80 ? 0.30 : 0));
          return pass
            ? { cash: s.cash + 2, visa: 'F1 (学生)', age: s.age + 1, is_phd: true, housing_name: '美国 博士实验室', message: '奇迹！凭着陆本顶尖算法功底，你跨海斩获了美国 CS 全奖直博 Offer！' }
            : { health: s.health - 15, visa: 'F1 (学生)', age: s.age + 1, message: '美国顶尖博士项目全墨！因为没有美本强推被卡，只能转投国内大厂或申请水硕。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'cn_work',
      },

      {
        text: '申请美国 CS 硕士 (自筹资金 / 积蓄 $5w 即可申请)',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({ cash: s.cash - 5, visa: 'F1 (学生)', age: s.age, housing_name: '美硕 校外公寓' }),
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
              visa: 'F1 (学生)', 
              age: s.age, 
              housing_name: '美硕 校外公寓', 
              message: '🎉 申请成功！凭借扎实的本科算法基础与良好的背景，你成功获得了无抵押留学贷款与校内 TA 助教资格！' 
            };
          } else {
            return { 
              health: s.health - 10, 
              message: '❌ 申请被拒！银行与校方审核认为你的本科 GPA/算法基础不足，无抵押贷款被驳回！你只能选择在国内打工攒钱或自筹资金。' 
            };
          }
        },
        nextEventId: (s: GameState) => (s.message || '').includes('申请成功') ? 'us_master_year1' : 'cn_undergrad_grad',
      },
      {
        text: '在国内大厂打工攒钱 (积累工作经验)',
        effect: (s) => ({ cash: s.cash + 8, health: Math.max(30, s.health - 12), tc: 8, age: s.age + 1, housing_name: '国内 厂区单间' }),
        nextEventId: 'cn_work',
      }
    ]
  },
  'us_undergrad_year1': {
    id: 'us_undergrad_year1',
    title: '美本前两年：适应期与多元探索',
    description: '刚来北美，你对一切都很新奇。你决定怎么度过最初的两年？',
    choices: [
      {
        text: '【硬核刷题】泡在图书馆死磕 GPA 和算法',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 5, age: s.age + 1, message: '每天和电脑作伴，代码实力突飞猛进！' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【华尔街探索】加入校内量化/学生投资俱乐部 (Quant & Trading Club)',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 5), health: s.health - 3, age: s.age + 1, message: '在模拟盘实盘操作中大获全胜，赚到了第一笔金融交易收益！' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【竞技体育】加入校队竞技体育 (网球/抱石/橄榄球)',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(25, s.charm + 5), cash: Math.max(0, s.cash - 1), age: s.age + 1, message: '高强度体育训练拉满！体能与气场全面大爆发！' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【音乐与社团】组建校园摇滚乐队举办草坪音乐节',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: Math.min(100, s.health + 5), cash: Math.max(0, s.cash - 1), age: s.age + 1, message: '你在音乐节上作为主唱震撼全场，成为了校园里的风云人物！' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '加入兄弟会/姐妹会 (Frat Party 社交局)',
        condition: (s) => s.cash >= 2,
        effect: (s) => ({ cash: s.cash - 2, charm: Math.min(25, s.charm + 8), health: s.health - 10, age: s.age + 1, message: '每周 Party，在啤酒乒乓桌上认识了一堆富二代与校友朋友。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      }
    ]
  },

  // 北美大学随机事件
  'college_hackathon_boom': {
    id: 'college_hackathon_boom',
    title: '【校园突发】全美 Hackathon AI 助手爆发',
    description: '大二下学期，你组队参加全美大学黑客松。比赛倒计时 2 小时，你们的项目因为并发逻辑出现卡顿！',
    choices: [
      {
        text: '紧急接入 Claude/Cursor 重新优化 Agent 调度层',
        effect: (s) => ({ leetcode: s.leetcode + 12, cash: s.cash + 1.5, message: '🚀 逆天夺冠！你们的 AI Agent 演示震撼全场，拿下了冠军并获得了 $1.5w 奖金！' }),
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '砍掉复杂并发功能，专注于写精致的前端 Demo 演示',
        effect: (s) => ({ charm: Math.min(25, s.charm + 5), cash: s.cash + 0.5, message: '演示极其流畅！评委夸赞你们具备产品经理思维，获得了最佳人气奖！' }),
        nextEventId: 'us_undergrad_year3',
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
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '找学霸室友通宵抱大腿，共同解出作业与例题',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), health: s.health + 2, message: '成功靠团队协作渡过难关，保住了 3.8+ 的优异 GPA！' }),
        nextEventId: 'us_undergrad_year3',
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
        effect: (s) => ({ cash: s.cash + 2, charm: Math.min(25, s.charm + 5), message: '🎉 拿到种子轮支票！VC 现场为你开出了 $2w 创业启动扶持资金！' }),
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '讲出动人的愿景故事，拉满现场演示舞台感染力',
        effect: (s) => ({ charm: Math.min(25, s.charm + 6), luck: Math.min(99, s.luck + 5), message: '全场爆发出欢呼！虽然没要投资，但结识了一圈顶级投资圈高管人脉！' }),
        nextEventId: 'us_undergrad_year3',
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
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '礼貌道谢：“谢谢夸奖，我还要去机房调代码”',
        effect: (s) => ({ leetcode: s.leetcode + 5, charm: Math.min(25, s.charm + 2), message: '高冷风范！你潇洒地背起吉他走向机房，成为了传说中的冷酷吉他手！' }),
        nextEventId: 'us_undergrad_year3',
      }
    ]
  },

  'us_undergrad_year3': {
    id: 'us_undergrad_year3',
    title: '美本大三：实习焦虑与方向选择',
    description: '转眼到了大三，周围的中国同学都在疯狂准备 Summer Intern。你打算怎么办？',
    choices: [
      {
        text: '海投 500 份简历，疯狂刷 LeetCode',
        effect: (s) => ({ leetcode: s.leetcode + 12, health: s.health - 10, age: s.age + 1, message: '你拿到了硅谷大厂的暑期实习 Offer，为全职转正铺平了道路！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【华尔街/金融实习】冲击纽约投资银行/量化基金 Quant 实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(25, s.charm + 5), health: s.health - 10, age: s.age + 1, message: '成功斩获纽约名企实习！年薪高昂，履历含金量暴涨！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '【学术科研】跟教授进 AI 实验室做 Research (冲全奖 PhD)',
        effect: (s) => ({ leetcode: s.leetcode + 10, charm: Math.min(25, s.charm + 4), health: s.health - 8, age: s.age + 1, is_phd: true, message: '你拿到了顶尖教授的强力推荐信，具备了申请顶尖 PhD 的资本！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '去硅谷大厂 Career Fair 活动混脸熟要内推',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: s.cash - 1, charm: Math.min(25, s.charm + 8), age: s.age + 1, message: '你加了几十位大厂校友，拿到不少内推机会。' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '躺平，在加州阳光下享受最后的青春',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: Math.min(25, s.charm + 5), age: s.age + 1, message: '虽然没有实习经历，但你度过了人生中最无忧无虑的一个夏天。' }),
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
        text: '翘课刷题！(力扣大军)',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 12, age: s.age + 1, message: 'GPA 擦边过，但你闭着眼睛都能手撕红黑树与动态规划。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '【量化/风控求职】准备 Wall Street Quant / 风控与投资面试',
        effect: (s) => ({ cash: s.cash + 2.5, leetcode: s.leetcode + 8, charm: Math.min(25, s.charm + 4), age: s.age + 1, message: '在 Quant 笔试与数学思维面试中顺利过关，拿到高薪 Offer！' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '疯狂赶 Due，力保全 A (4.0 GPA)',
        effect: (s) => ({ leetcode: s.leetcode + 6, health: s.health - 8, charm: Math.min(25, s.charm + 3), age: s.age + 1, message: '你拿到了 4.0 的完美绩点！展现了极其严谨的学业能力。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
      },
      {
        text: '去硅谷大厂活动混脸熟要内推',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: s.cash - 1, charm: Math.min(25, s.charm + 10), age: s.age + 1, message: '你加了 50 个大厂学长学姐的 LinkedIn，拿到了不少直通面试机会。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(Math.random() * 4)],
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
        effect: (s) => ({ health: s.health - 10, leetcode: s.leetcode + 12 }),
        nextEventId: 'job_hunt',
      },
      {
        text: '找ICC挂靠 (保底策略)',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({ cash: s.cash - 1, tc: 6, job_type: 'unemployed' }),
        nextEventId: 'icc_work',
      },
      {
        text: '加入一家刚成立的 AI 初创公司 (高风险高回报)',
        condition: (s) => s.year >= 2023,
        effect: (s) => {
          const win = Math.random() < 0.08;
          return win 
            ? { tc: 25, health: s.health - 20, cash: s.cash + 100, visa: 'O1 (杰出人才)', message: '天选之子！你盲狙的公司获得核心突破并由资本巨额注资，你分到了高额股票！' }
            : { tc: 10, health: s.health - 30, message: '公司烧光了投资人的钱，不到半年就倒闭了。期权变成了废纸，你只能连夜更新简历。' };
        },
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
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
        effect: (s) => ({ health: s.health - 15, tc: 25, laid_off: false, cash: s.cash + 10, job_type: 'big_tech', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '学长直接把你拉进了核心组，开启了高压生活。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
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
        text: '【强力人脉 Referral】凭借学长/熟人总监直通大厂面试 (需人脉 >= 25)',
        reqBadge: '需人脉>=25',
        condition: (s) => (s.network || 0) >= 25,
        effect: (s) => ({
          tc: s.year >= 2023 ? 32 : 28,
          laid_off: false,
          cash: s.cash + 6,
          job_type: 'big_tech',
          level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'),
          network: Math.min(100, (s.network || 0) + 5),
          message: '🎉 凭借强大人脉网络 (Referral)，熟人总监直接将你推荐给了 Hiring Manager，免除第一轮简历筛选无缝上岸！'
        }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '通过兄弟会内推，加入当地中型养老公司',
        condition: (s) => s.school === 'state',
        effect: (s) => ({ tc: 15, laid_off: false, health: s.health + 10, charm: s.charm + 2, job_type: 'big_tech', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '工作轻松，每天下午 4 点下班去冲浪，但这辈子的 TC 估计也就这样了。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },

      {
        text: '面试 FLAG 大厂 (Google/Apple 等养老厂)',
        effect: (s) => {
          let req = 50;
          if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30; // 疫情放水期
          return s.leetcode >= req 
            ? { tc: s.year >= 2023 ? 30 : 26, laid_off: false, cash: s.cash + 5, health: s.health - 5, job_type: 'big_tech', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: `上岸！${s.year}年大厂要求LeetCode>${req}，你顺利通过。` }
            : { health: s.health - 10, message: `面试被挂了！${s.year}年市场要求LeetCode>${req}。` };
        },
        nextEventId: (s: GameState) => {
          let req = 50;
          if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30;
          if (s.leetcode < req) return 'job_hunt_fail';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Meta (传说中的卷王之王) - (需要 LeetCode >= 60)',
        condition: (s) => s.leetcode >= 60,
        effect: (s) => ({ tc: 38, laid_off: false, health: s.health - 10, cash: s.cash + 10, company: 'meta', job_type: 'big_tech', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '你成功卷入了 Meta！虽然给的钱多，但是压力山大。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '面试普通 Startup',
        effect: (s) => ({ tc: 18, laid_off: false, health: s.health - 2, job_type: 'startup', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '你加入了一家 Early Stage 的初创公司，虽然工资低，但老板给你画了巨大的大饼。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },

      {
        text: '加入 TikTok (传说中的拿命换钱) - (需要 LeetCode >= 45)',
        condition: (s) => s.leetcode >= 45,
        effect: (s) => ({ tc: s.year >= 2023 ? 40 : 30, laid_off: false, health: s.health - 10, cash: s.cash + 15, company: 'tiktok', job_type: 'tiktok', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '你成功入职了字节跳动！虽然期权是废纸且中美跨时区开会到凌晨 2 点，但现金包裹极其雄厚！' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Amazon (门槛较低，但入职即签生死状) - (需要 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => ({ tc: 24, laid_off: false, health: s.health - 5, cash: s.cash + 5, company: 'amazon', job_type: 'amazon', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '你通过了亚麻的面试！体验到了真正的 Frugality，没有免费食堂且随时可能被 PIP。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '加入 Nvidia (需要系统底层经验 / LeetCode >= 40)',
        condition: (s) => s.leetcode >= 40,
        effect: (s) => ({ tc: s.year >= 2023 ? 60 : 26, laid_off: false, health: s.health - 5, cash: s.cash + 5, company: 'nvidia', job_type: 'nvidia', level: s.level ? s.level : (s.is_phd ? 'L4' : 'L3'), message: '你披上了黑色皮衣！如果这是 2023 年，你的包裹因为股票暴涨将达到 60w 的恐怖数字！' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '挑战顶级量化基金 (Quant) (极高门槛, 力扣>=75提高胜率)',
        effect: (s) => {
          const winRate = 0.18 + (s.leetcode >= 75 ? 0.27 : s.leetcode >= 50 ? 0.12 : 0) + (s.luck / 100) * 0.12;
          const pass = Math.random() < winRate;
          return pass 
            ? { tc: 40, laid_off: false, cash: s.cash + 10, health: s.health - 15, job_type: 'quant', level: 'Quant', message: '数学与算法功底发威！你击败了众多常春藤金融数学 PhD，拿下了顶级 Quant Fund 百万包裹 Offer！' }
            : { health: s.health - 10, message: '量化基金的随机微积分与高频对冲数学题太烧脑了，你遗憾落选...' };
        },
        nextEventId: (s: GameState) => {
          if (s.tc < 40) return 'job_hunt';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      }
    ]
  },
  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '求职受挫',
    description: '由于迟迟找不到理想工作，你面临着巨大的生存和身份压力...',
    choices: [

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
        effect: (s) => ({ status: 'win', imageUrl: 'images/dali_relax.jpg', message: '你带着几万美元的积蓄去了大理。每天喝咖啡、看苍山洱海。虽然彻底脱离了硅谷的内卷，但你找到内心的平静！(躺平结局)' }),
        nextEventId: 'end',
      },
      {
        text: '被迫回国',
        effect: (s) => {
          const reason = (s.visa === 'F1 (学生)' || s.visa === '无') ? 'OPT到期未能上岸' : ((s.visa === '绿卡' || s.visa === 'O1 (杰出人才)') ? '积蓄耗尽、心灰意冷' : 'H1B 60天失业期满未能找到新工作');
          return { status: 'game_over', message: reason + '，你最终遗憾登上了回国的航班。' };
        },
        nextEventId: 'end',
      },
      {
        text: '再读一个水硕维持身份 (Day 1 CPT) - (消耗 $5w, +25 力扣)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== 'O1 (杰出人才)' && s.cash >= 5,
        effect: (s) => ({ cash: s.cash - 5, age: s.age + 1, leetcode: Math.min(100, s.leetcode + 25), message: '你在读 Day 1 CPT 水硕期间狂刷 250 道 Hard 题，算法功力大增！准备重回战场！' }),
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
        text: '领养一只布偶猫/金毛 (每年额外花费 1w)',
        condition: (s) => s.rent >= 2, // Needs at least a 2b2b to have space
        effect: (s) => ({ rent: s.rent + 1, charm: Math.min(25, s.charm + 5), health: Math.min(100, s.health + 20), has_housing: true, housing_name: s.housing_name || 'San Jose 公寓', has_pet: true, pet_name: '布偶猫', message: '你领养了毛孩子布偶猫！虽然每年要多花不少钱买猫粮与看兽医，但每次下班回家看到它，你的疲惫都一扫而空，而且在相亲软件上放宠物照片让你大受欢迎！' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      },

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
            ? { visa: 'H1B (工签)', cash: s.cash, imageUrl: 'images/h1b_lottery_win.jpg', message: '人品爆发，今年H1B中签了！' }
            : { cash: s.cash, health: s.health - 10, message: '今年 H1B 没抽中！只能指望明年...' };
        },
        nextEventId: (s) => (s.visa === 'H1B (工签)' || s.visa === 'O1 (杰出人才)') ? 'sv_daily_life' : 'big_tech_work_no_h1b',
      },
      {
        text: '砸钱找最顶级的移民律师帮忙弄 O1 签证 (花费 8 万美元)',
        condition: (s) => s.cash >= 8,
        effect: (s) => {
          const winRate = 0.6 + (s.luck / 100) * 0.35; // O1 成功率 60% - 95%
          const win = Math.random() < winRate;
          return win
            ? { visa: 'O1 (杰出人才)', cash: s.cash - 8, message: '律师非常给力，成功帮你申请到了 O1 杰出人才签证！彻底摆脱了抽签大坑！' }
            : { cash: s.cash - 8, health: s.health - 15, message: '移民局觉得你水平不够，O1 签证被拒，八万美元打了水漂。' };
        },
        nextEventId: (s) => (s.visa === 'H1B (工签)' || s.visa === 'O1 (杰出人才)') ? 'sv_daily_life' : 'big_tech_work_no_h1b',
      },
      {
        text: '和美国公民闪婚拿绿卡 (高风险)',
        effect: (s) => {
          const fake = Math.random() > 0.7; // 30% fake marriage caught
          return fake
            ? { status: 'game_over', message: '移民局家访时发现你们是商婚，你被当场遣返回国并终身禁入美国，游戏结束！' }
            : { visa: '绿卡', cash: s.cash, message: '你通过婚姻顺利拿到了绿卡，直接跨过了最大的槛！' }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'post_green_card',
      }
    ]
  },
  'big_tech_work_no_h1b': {
    id: 'big_tech_work_no_h1b',
    title: 'H1B 焦虑 (第二年抽签)',
    description: '前第一年未抽中，好在申请了 STEM OPT 两年延期，这是你第二年的抽签机会...',
    imageUrl: 'images/visa_denied.jpg',
    choices: [
      {
        text: '参与第二轮 H1B 抽签！',
        effect: (s) => {
          const winRate = 0.3 + (s.luck / 100) * 0.3;
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', cash: s.cash, message: '第二年抽签人品爆发，终于中签了！' }
            : { cash: s.cash, health: s.health - 15, message: '第二年还是没抽中...只剩最后一年 STEM OPT 机会了！' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b_final',
      }
    ]
  },
  'big_tech_work_no_h1b_final': {
    id: 'big_tech_work_no_h1b_final',
    title: 'H1B 绝境 (最后一年抽签与拯救对策)',
    description: 'STEM OPT 最后一年来临！如果今年未抽中，你必须从以下拯救策略中做出抉择：',
    choices: [
      {
        text: '赌上所有气运，进行这辈子最后一次 H1B 抽签！',
        effect: (s) => {
          const winRate = 0.35 + (s.luck / 100) * 0.35;
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', cash: s.cash, gc_progress: Math.min(5, (s.gc_progress || 0) + 1), message: '奇迹发生！在最后一年绝境中神奇海底捞中签！公司已顺便为你启动了 PERM 绿卡申请！' }
            : { cash: s.cash, health: s.health - 20, message: '很遗憾，第三年 H1B 依然未中签！好在公司 HR 允许你选择外派加拿大或挂靠 Day 1 CPT。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'h1b_fallback_options',
      },
      {
        text: '【公司外派】申请 Relocate 到温哥华/多伦多 Office (L1 签证曲线救国)',
        costBadge: '免费外派',
        effect: (s) => ({ visa: 'L1 (外派)', l1_relocated: true, message: '你转到了温哥华分公司，以 L1 身份工作。一年后公司把你调回了湾区 Headquarters，成功保住硅谷高薪！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【学校挂靠】紧急注册 Day 1 CPT 大学 (消耗 $1.5w)',
        costBadge: '花费 $1.5w',
        condition: (s) => s.cash >= 1.5,
        effect: (s) => ({ visa: 'Day 1 CPT', cash: s.cash - 1.5, cpt_used: true, message: '你成功挂靠了 Day 1 CPT，虽然边上班边写作业极其辛苦，但你成功留在湾区继续工作！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【杰出人才】凭借算法功力与技术影响力，申办 O1 签证 (需算法>=50或PhD)',
        reqBadge: '算法>=50或PhD',
        condition: (s) => s.leetcode >= 50 || s.is_phd,
        effect: (s) => ({ visa: 'O1 (杰出人才)', cash: s.cash - 4, message: '凭硬核算法与发表的硬核技术文章，移民局批复了你的 O1 杰出人才签证！彻底甩开抽签束缚！' }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'h1b_fallback_options': {
    id: 'h1b_fallback_options',
    title: 'H1B 拯救绝境对策',
    description: '抽签未能中签，但你还有最后自救机会，请选择你的拯救路线：',
    choices: [
      {
        text: '【杰出人才自救】凭硬核算法功力/PhD 学位直接申请 O1 签证 (需算法>=60或PhD)',
        reqBadge: '算法>=60或PhD',
        condition: (s) => s.leetcode >= 60 || s.is_phd,
        effect: (s) => ({ visa: 'O1 (杰出人才)', health: Math.max(10, s.health - 10), message: '凭硬核算法实力与发表的技术论文，移民局批复了你的 O1 杰出人才签证！成功自救！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【钞能力投资自救】全额出资申办 EB-5 投资移民绿卡 (花费 $50w)',
        reqBadge: '现金>=50w',
        condition: (s) => s.cash >= 50,
        effect: (s) => ({ visa: '绿卡', cash: s.cash - 50, message: '凭雄厚资金实力，加急办妥了 EB-5 投资移民绿卡！彻底甩开所有身份枷锁！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '申请 Relocate 到温哥华 Office 办 L1 签证 (曲线救国)',
        effect: (s) => ({ visa: 'L1 (外派)', l1_relocated: true, message: '你外派加拿大一年后凭 L1 签证顺利调回湾区总部！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '紧急挂靠 Day 1 CPT 水硕 (花费 $1.5w)',
        condition: (s) => s.cash >= 1.5,
        effect: (s) => ({ visa: 'Day 1 CPT', cash: s.cash - 1.5, cpt_used: true, message: '白天写代码，晚上做作业，你凭 Day 1 CPT 成功维持了合法工作身份！' }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'sv_daily_life': {
    id: 'sv_daily_life',
    title: '湾区日常 (行动面板)',
    description: '又是新的一年。每年湾区都会涌现出不同的限时行业机遇，合理分配你的精力吧！',
    choices: [
      // 1. 【今年限时机会】 (不消耗年度重心)
      {
        text: '【限时机会】 Stanford 师兄拉你组队冲 AI Hackathon ($0.5w)',
        condition: (s) => s.cash >= 0.5 && (s.year % 6 === 0 || s.year % 6 === 3) && !s.message.includes('Hackathon'),
        hideIfUnavailable: true,
        effect: (s) => {
          const win = Math.random() < (0.35 + s.leetcode / 300);
          return win
            ? { cash: s.cash + 22, leetcode: s.leetcode + 10, charm: s.charm + 3, message: '【Hackathon 夺冠】比赛通宵 48 小时！你们的 Demo 拿下了全场总冠军！硅谷顶级天使投资人现场开出 $35w 支票支持你们继续研发！' }
            : { cash: s.cash - 0.5, health: s.health - 15, leetcode: s.leetcode + 8, message: '【Hackathon 陪跑】连续通宵两天喝了 8 罐红牛，虽然Demo演示时服务器崩了没拿奖，但你结识了一群大牛。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 抢购 NVIDIA GTC 大会 VIP 门票进场见皮衣黄 ($1.5w)',
        condition: (s) => s.cash >= 1.5 && (s.year % 6 === 1) && !(s.message || '').includes('GTC'),
        hideIfUnavailable: true,
        effect: (s) => ({
          cash: s.cash - 1.5,
          charm: Math.min(25, s.charm + 6),
          luck: Math.min(45, s.luck + 15),
          message: '【参加 GTC】你在 GTC 大会前排拿到了黄仁勋签名的黑色皮衣同款折扇！玄学气运值大增，接下来的投资和求职将获得强运加持！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机会】 提交大厂云系统 Zero-Day 漏洞获取 Bug Bounty 赏金 (需 LeetCode >= 35)',
        condition: (s) => s.leetcode >= 35 && (s.year % 6 === 5) && !(s.message || '').includes('漏洞'),
        hideIfUnavailable: true,
        effect: (s) => {
          const success = Math.random() < 0.25;
          return success
            ? { cash: s.cash + 8, leetcode: s.leetcode + 5, message: '【提交漏洞】安全部门确认了你提交的高危提权漏洞！向你的账户汇入了 $8w 漏洞赏金！' }
            : { health: s.health - 10, message: '【提交漏洞】安全团队回应称这是“预期设计 (Works as Intended)”，白白研究了三天。' };
        },
        nextEventId: 'sv_daily_life',
      },

      // 2. 【年度重心】(点击后直接进入年底结算或对应事件流)
      {
        text: '【年度重心：疯狂内卷】拼命加班冲 Perf，争取加薪与升职',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age || (s.is_phd ? 24 : 22);
          const yearsInGrade = s.age - lastPromoAge;
          
          const baseWinRate = 0.15 + (s.leetcode / 300) + (s.charm * 0.02) + (s.luck * 0.001);
          const pass = Math.random() < Math.min(0.7, baseWinRate);

          if (curLevel === 'L3') {
            if (s.leetcode < 30) return { health: Math.max(10, s.health - 25), tc: s.tc + 0.5, message: 'Manager 指出你的代码产出与算法基础还不够扎实，建议多提升技术硬实力。' };
            if (yearsInGrade >= 1 && pass) return { health: Math.max(10, s.health - 30), tc: s.tc + 3.5, level: 'L4', last_promo_age: s.age, message: '🎉 恭喜！你的 Perf 拿下 EE 绩效，成功晋升至 L4 工程师！总包调薪 +$3.5w！' };
          } else if (curLevel === 'L4') {
            if (s.leetcode < 50) return { health: Math.max(10, s.health - 25), tc: s.tc + 1.0, message: '晋升委员会认为你的技术深度还不到 Senior 级别。' };
            if (yearsInGrade >= 1 && pass) return { health: Math.max(10, s.health - 35), tc: s.tc + 6.5, level: 'L5 (Senior)', last_promo_age: s.age, message: '🎉 轰动全组！你顺利通过升职委员会评审，正式晋升为 L5 Senior！' };
          } else if (curLevel === 'L5 (Senior)') {
            if (s.leetcode >= 70 && s.health >= 40 && s.tc >= 30 && pass) return { health: Math.max(10, s.health - 45), tc: s.tc + 15, level: 'L6 (Staff)', last_promo_age: s.age, message: '🎉 奇迹登顶！你打破了硅谷码农最大天堑，成功晋升为 L6 Staff 架构师！' };
          }
          const meritBonus = Math.random() < 0.35 ? 2.0 : 1.0;
          return { mid_year: true, health: Math.max(10, s.health - 25), tc: s.tc + meritBonus, message: `你拼命熬夜写代码，拿到了项目奖金 (+${meritBonus}w TC)！Manager：“今年大厂升职 Quota 紧张，明年一定为你申请！”` };
        },
        nextEventId: (s) => (s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : ((s.message || '').includes('🎉') ? 'promo_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【年度重心：闭关修炼】死磕算法与系统设计，尝试跳槽拿大包',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => {
          if (s.leetcode < 50) {
            return { health: s.health - 20, leetcode: s.leetcode + 15, message: '你拒绝了所有社交，疯狂刷题一整年。虽然面了几家都挂了，但算法突飞猛进。' };
          }
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const isFromAI = curLevel === 'MTS' || s.job_type === 'ai_research';
          
          if (isFromAI) return { mid_year: true, health: s.health - 25, tc: Math.max(s.tc + 25, 65), level: 'L6 (Staff)', job_type: 'big_tech', message: '顶级光环！你带着 OpenAI/AI 实验室背景跳槽大厂，对方直接送上 L6 Staff 包裹！TC 暴涨！' };
          if (curLevel === 'L3') return { mid_year: true, health: s.health - 25, tc: s.tc + 8, level: 'L4', message: '跳槽成功！凭借硬核算法面试，斩获 L4 Offer，TC +$8w！' };
          if (curLevel === 'L4') return { mid_year: true, health: s.health - 25, tc: s.tc + 12, level: 'L5 (Senior)', message: '跳槽成功！拿下了对方大厂的 Senior 岗位，顺利跳槽升至 L5 (Senior)！' };
          if (curLevel === 'L5 (Senior)' || curLevel === 'L5') return { mid_year: true, health: s.health - 30, tc: s.tc + 18, level: 'L6 (Staff)', message: '跳槽爆拉！凭借多年系统架构积累与算法表现，拿到 L6 Staff 包裹！' };
          return { mid_year: true, health: s.health - 20, tc: Math.floor(s.tc * 1.15), message: '跳槽成功！你跳到了另一家大厂，获得了 15% 的 package 提升！' };
        },
        nextEventId: (s) => (s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【年度重心：拓展副业】经营小红书与独立开发',
        condition: (s) => true,
        effect: (s) => {
          if (s.leetcode >= 40 && Math.random() < (0.05 + s.luck / 500)) {
            return { cash: s.cash + 35, leetcode: s.leetcode + 5, health: s.health - 15, message: '你做出的套壳 AI 产品在 Product Hunt 上登顶了！有资本用 50 万美元收购了你的项目！' };
          }
          let winRate = s.charm >= 12 ? 0.9 : (s.charm >= 7 ? 0.6 : 0.2);
          if (Math.random() < winRate) {
            if (s.charm >= 20 && Math.random() < 0.05) return { cash: s.cash + 48, charm: Math.min(25, s.charm + 5), health: s.health - 10, message: '极小概率的奇迹！你的小红书粉丝突破 100 万！获得了大牌广告代言费！' };
            return { mid_year: true, cash: s.cash + 8, charm: s.charm + 2, health: s.health - 15, message: '接到了几笔软广赞助，涨了不少粉，但非常疲惫。' };
          }
          return { mid_year: true, cash: Math.max(0, s.cash - 2), health: s.health - 20, message: '独立开发没人用，小红书没人看，倒贴钱还心累。' };
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '【年度重心：活跃社交】参加派对聚会，扩充人脉与寻觅良缘',
        condition: (s) => true,
        effect: (s) => ({
          mid_year: true,
          health: s.health - 10,
          charm: Math.min(25, s.charm + 3),
          message: '你把今年的精力都花在了社交上，颜值打扮都有所提升。'
        }),
        nextEventId: (s) => !s.is_married ? 'dating_market' : midYearEventRouter(s),
      },
      {
        text: '【年度重心：佛系躺平】宅家打游戏养生，不管世事',
        condition: (s) => true,
        effect: (s) => ({
          mid_year: true,
          health: Math.min(100, s.health + 18),
          message: '这一年你彻底躺平，除了上班摸鱼外，回家就是打黑神话悟空。什么职场焦虑都没了，身体恢复了生机！'
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
           const nextGc = s.visa === '绿卡' ? s.gc_progress : s.gc_progress + 1;
           const isHomeowner = ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(s.housing_name || '');
           const housingExpense = s.rent !== undefined 
             ? s.rent 
             : (isHomeowner ? (s.housing_name === 'Atherton 顶级豪宅' ? 5.0 : 2.0) : 4.0);
           const carExpense = s.car === 'porsche' ? 2.5 : s.car === 'cybertruck' ? 2.0 : s.car === 'model_y' ? 1.0 : 0.3;
           const livingExpense = 3.0;
           const totalExpense = housingExpense + carExpense + livingExpense;

           const preTaxTC = s.tc > 0 ? s.tc : 0;
           const postTaxIncome = preTaxTC * 0.75; 
           const netIncome = postTaxIncome - totalExpense;
           
           let healthDrain = 0;
           let companyMsg = '';
           if (!s.laid_off && s.job_type !== 'unemployed') {
             if (s.job_type === 'tiktok') { healthDrain = 15; companyMsg = ' 字节的连轴转让你身心俱疲 (健康 -15)。'; }
             else if (s.job_type === 'quant') { healthDrain = 12; companyMsg = ' 高频交易的每一秒都在燃烧你的生命 (健康 -12)。'; }
             else if (s.company === 'meta') { healthDrain = 8; companyMsg = ' Meta 的 PSC 压力让你掉光了头发 (健康 -8)。'; }
             else if (s.job_type === 'amazon') { healthDrain = 5; companyMsg = ' 亚麻的 PIP 文化让你每天提心吊胆 (健康 -5)。'; }
             else if (s.job_type === 'startup') { healthDrain = 5; companyMsg = ' 创业公司的混乱让你心力交瘁 (健康 -5)。'; }
             else if (s.job_type === 'big_tech') { healthDrain = -5; companyMsg = ' 养老厂的 WLB 让你养精蓄锐 (健康 +5)。'; }
           }
           
           const newHealth = Math.max(0, s.health - healthDrain);
           
           const gcMsg = s.visa === '绿卡' 
             ? '你已持有美国绿卡，工作生活不受约束。' 
             : nextGc >= 5 
               ? '你的绿卡排期终于到了！' 
               : `距离拿到绿卡还差 ${Math.max(0, 5 - nextGc)} 年。`;

            // H1B 年底自动抽签逻辑
            let h1bMsg = '';
            let newVisa = s.visa;
            let newAttempts = s.h1b_attempts || 0;

            if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && !s.laid_off && s.job_type && s.job_type !== 'unemployed') {
              newAttempts += 1;
              const winRate = 0.35 + (s.luck / 100) * 0.3;
              const win = Math.random() < winRate;
              if (win) {
                newVisa = 'H1B (工签)';
                h1bMsg = ` 🎉 人品大爆发！在第 ${newAttempts} 年 H1B 抽签中成功中签，正式获得 H1B 身份！`;
              } else {
                if (newAttempts === 1) {
                  h1bMsg = ' 💔 第一年 H1B 未中签！已开启 STEM OPT 2 年延期，明年还有抽签机会！';
                } else if (newAttempts === 2) {
                  h1bMsg = ' 💔 第二年 H1B 依然未中签！只剩最后一年 STEM OPT 抽签机会，压力山大！';
                } else {
                  h1bMsg = ' 💥 警告：三年 H1B 抽签均未能中签！身份即将在今年到期，面临离境危机！';
                }
              }
            }

            // Merit raise / RSU refresh check (45% chance)
            let updatedTC = s.tc;
            let meritMsg = '';
            const isWorking = !s.laid_off && s.job_type && s.job_type !== 'unemployed';
            if (isWorking && Math.random() < 0.45) {
              const refreshAmt = Math.random() < 0.3 ? 3.5 : 2.0;
              updatedTC = s.tc + refreshAmt;
              meritMsg = ` 📈 凭本年度表现获得了公司 Merit Raise 调薪与 RSU 股票 Refresh (+${refreshAmt.toFixed(1)}w TC)！`;
            }

           return { 
              mid_year: false,
              ap: s.max_ap !== undefined ? s.max_ap : 3, 
              age: s.age + 1, 
              year: s.year + 1,
              visa: newVisa,
              h1b_attempts: newAttempts,
              gc_progress: nextGc, 
              cash: s.cash + netIncome,
              tc: updatedTC,
              health: newHealth,
              message: `扣除所得税、房租/房贷与生活账单支出 ${totalExpense.toFixed(1)} 万后，本年净结余 ${netIncome >= 0 ? '+' + netIncome.toFixed(1) : netIncome.toFixed(1)} 万美元。${gcMsg}${companyMsg}${h1bMsg}${meritMsg}` 
           };
        },
        nextEventId: (s) => {
          if (s.status === 'win') return 'end';
          if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && (s.h1b_attempts || 0) >= 3) {
            return 'h1b_final_crisis';
          }
          if (s.gc_progress >= 5 && s.visa !== '绿卡' && s.visa !== '无') return 'post_green_card';
          
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
        nextEventId: 'sv_daily_life',
      },
      {
        text: '极度恐慌！连夜关摄像头，边开全员大会边狂刷 LeetCode 备战跳槽',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: s.health - 15, message: '你吓得半夜爬起来刷了 6 道动态规划困难题，咖啡因过量导致心率达到了 130。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '私信发帖人“同在湾区可以加微信交流吗”，结果发现是隔壁工位的同胞',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), cash: Math.max(0, s.cash - 0.2), message: '你们在 Palo Alto 密谋了一下午抱团取暖指南，并交换了彼此的 Referral 资源库。' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life',
      },
      {
        text: '手滑点错！把力扣 Hard 解题窗口共享给了全公司 60 个人！',
        effect: (s) => ({ health: s.health - 15, charm: Math.min(25, s.charm + 8), cash: s.cash + 10, message: '会议室内一片死寂。你把自己的社死截图匿名发到小红书《全员大会手滑投影了力扣Hard怎么破？》，收获 3 万点赞和 200 条求职 Referral 软广费！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '3 秒把问题扔给 ChatGPT，照着读“High throughput, horizontal scalability, zero-cost abstractions”',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 5), tc: s.tc + 2, message: '高管赞叹你的技术深度，当场决定下季度让你负责这个高风险架构重组。' }),
        nextEventId: 'sv_daily_life',
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
        effect: (s) => ({ tc: Math.max(10, s.tc - 5), health: s.health - 10, message: '你含泪跳槽去了一家给钱更少但至少股价底部的公司，重新开始坐 4 年股票牢。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '拍小红书 VLOG《28岁硅谷码农资产蒸发 60%，带你体验极简挂壁生活》',
        effect: (s) => ({ cash: s.cash + 15, charm: Math.min(25, s.charm + 4), message: '网友太喜欢看硅谷中产受苦了！你的小红书粉丝暴涨，光是电竞椅和挂壁盒饭的广告费就填补了股票亏损。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '死扛信仰！每天去大华超市买促销打折盒饭，熬到中东主权基金收购',
        effect: (s) => ({ health: s.health - 12, luck: Math.min(45, s.luck + 8), message: '你开启了硅谷极简苦行僧模式，胃功能下降了，但心智磨砺得坚不可催。' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life',
      },
      {
        text: '痛快点击 25%，拍照发朋友圈：“湾区物价让硅谷 L5 活得不如国内县城中产 [流泪]”',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(25, s.charm + 2), message: '你的朋友圈成功引起了老同学的围观和暗酸，完成了标准的硅谷式哭穷炫耀。' }),
        nextEventId: 'sv_daily_life',
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
        effect: (s) => ({ health: Math.max(10, s.health - 25), visa: 'H1B (工签)', message: '你用极具创造性的学术废话打动了移民局官员，获得了 3 年 H1B！但你的头发掉了三分之一。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '直接把 RFE 截屏发给老妈：“妈，我在美国连狗都不如，随时可能被遣返，别催了，祈祷我别回老家啃老吧”',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: s.charm + 1, message: '电话那头沉默了。老妈第二天默默给你转了 5000 人民币并附言：“儿子，实在不行咱们回省城考公”。耳朵清静了半年！' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life',
        condition: (s) => s.cash >= 1
      },
      {
        text: '冷笑一声，继续刷我的 LeetCode',
        effect: (s) => ({ 
          leetcode: s.leetcode + 5, 
          charm: s.charm - 1,
          message: '你懒得理他，默默 AC 了一道 Hard 题。'
        }),
        nextEventId: 'sv_daily_life'
      }
    ]
  },
  'friday_pip': {
    id: 'friday_pip',
    title: '周五下午四点的 1:1',
    description: '你的 Manager 突然在周五下午 4 点给你发了个 "Quick Sync" 的日历邀请。会上，他用着毫无感情的 corporate 语调表示你的 "impact" 没有 "move the needle"，并将你放入了为期 30 天的 Focus/PIP 计划。',
    choices: [
      {
        text: '认怂疯狂加班，证明自己的 Synergy',
        effect: (s) => {
          const survived = Math.random() > 0.5;
          return survived
            ? { health: s.health - 30, message: '你每天工作 16 小时，终于 survive 了 PIP！但你的头发少了一半。' }
            : { health: s.health - 20, tc: 0, laid_off: true, message: '你熬了几个通宵，最后还是被 Manager 找借口开除了。' };
        },
        nextEventId: (s) => s.tc === 0 ? 'job_hunt' : 'sv_daily_life'
      },
      {
        text: '直接开摆，拿 Severance 走人，在家刷题',
        effect: (s) => ({ 
          cash: s.cash + (s.tc / 12) * 2, 
          tc: 0, 
          laid_off: true,
          leetcode: s.leetcode + 15,
          health: s.health + 10,
          message: '你选择了 quiet quitting，拿着两个月遣散费每天去海边散步刷题，心情大好。'
        }),
        nextEventId: 'job_hunt'
      },
      {
        text: '🤝 启动 60 天 H1B Grace Period 紧急挂靠：找外包公司办理 H1B Transfer (消耗 $2w)',
        condition: (s) => s.cash >= 2 && s.visa !== '绿卡',
        effect: (s) => ({
          cash: s.cash - 2,
          tc: Math.max(10, Math.floor(s.tc * 0.55)),
          health: s.health - 15,
          message: '外包中介急用低薪码农，连夜为你开具了紧急 Offer 办理了 H1B Transfer！虽然总包大幅跳水，但你的 60 天合法身份警报成功解除！'
        }),
        nextEventId: 'sv_daily_life'
      }
    ]
  },
  'biohacking_party': {
    id: 'biohacking_party',
    title: 'Atherton 的长寿教徒',
    description: '在 Atherton 的一个豪宅派对上，主人戴着三个智能指环，宣称自己把生物钟逆转到了 18 岁。他递给你一杯绿色的不明液体，说是他独家研发的“细胞级抗衰老矩阵精华”，只要 $500 一杯。',
    choices: [
      {
        text: '报名“长寿换血抗衰老”年度会员 (消耗 $50w) - (永久 +1 精力上限，最大上限 5 AP)',
        effect: (s) => ({ 
          cash: s.cash - 50, 
          max_ap: Math.min(5, (s.max_ap || 3) + 1),
          health: 100,
          message: '你花了 50 万美元。每个月都会有私人医生上门给你注射定制干细胞。你的身体仿佛回到了 18 岁，精力极其充沛！'
        }),
        nextEventId: 'sv_daily_life',
        condition: (s) => s.cash >= 50 && (s.max_ap || 3) < 5
      },
      {
        text: '买！一杯“细胞级精华” ($500) 尝尝鲜',
        effect: (s) => ({ 
          cash: s.cash - 0.05, 
          health: Math.min(100, s.health + 5),
          message: '你花了 $500 喝下这杯用香菜和不知名粉末榨的汁。别说，第二天在办公室写代码确实不困了。'
        }),
        nextEventId: 'sv_daily_life',
        condition: (s) => s.cash >= 0.05
      },
      {
        text: '拒绝，并去厨房找多力多滋和可乐',
        effect: (s) => ({ 
          health: s.health - 2,
          charm: s.charm - 2, 
          message: '你在这个满是生酮饮食者的派对里大嚼碳水，被大家用异样的眼光注视。'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '跟他探讨脑机接口，看能不能弄点融资',
        effect: (s) => ({ 
          charm: s.charm + 3,
          cash: s.cash + 10,
          message: '你成功用一些炫酷的词汇忽悠了他，他当场决定给你打钱让你帮他开发一个“量子睡眠追踪”App。'
        }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life',
        condition: (s) => s.cash >= 1.5
      },
      {
        text: '算了吧，我还要在家 On-Call',
        effect: (s) => ({ 
          health: s.health + 5,
          cash: s.cash + (s.tc / 12),
          message: '你因为顶替他们做了假期的 On-Call 拿到了额外的 Bonus。但看着他们朋友圈的末日废土风照片，你流下了社畜的眼泪。'
        }),
        nextEventId: 'sv_daily_life'
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
        effect: (s) => ({ tc: Math.floor(s.tc * 0.8), health: s.health - 15, message: '打开券商账户看了一眼，你决定今年圣诞节不去夏威夷了，改去家里蹲。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '此时不博何时博？加杠杆抄底！(需现金 > 30w)',
        condition: (s) => s.cash >= 30,
        effect: (s) => {
           const winRate = 0.2 + (s.luck / 100) * 0.4; // 抄底成功率 20% - 60%
           const win = Math.random() < winRate;
           return win 
             ? { tc: Math.floor(s.tc * 0.8), cash: s.cash + 50, message: '虽然工资跌了，但你成功抄到底部，反弹吃满，大赚一笔！' }
             : { tc: Math.floor(s.tc * 0.8), cash: s.cash - 25, health: s.health - 30, message: '抄底抄在半山腰，现金和工资惨遭双杀，痛不欲生。' };
        },
        nextEventId: 'sv_daily_life'
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
          const cur = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          return cur === 'L3' || cur === 'L4';
        },
        effect: (s) => {
          const win = Math.random() < 0.45;
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          const isL3 = cur === 'L3';
          const tcIncrease = isL3 ? 3.5 : 6.5;
          const nextLevel = isL3 ? 'L4' : 'L5 (Senior)';
          return win 
            ? { health: Math.max(10, s.health - 12), tc: s.tc + tcIncrease, level: nextLevel, last_promo_age: s.age, message: `🎉 卷赢了！你拿到了 EE 绩效，成功晋升至 ${nextLevel}，总包调薪 +${tcIncrease} 万美元！` }
            : { health: Math.max(10, s.health - 12), message: '你辛辛苦苦写的文档被 Manager 拿去抢了功劳，还是个 Meets。白卷了。' };
        },
        nextEventId: (s) => ((s.message || '').includes('🎉') ? 'promo_celebration' : 'sv_daily_life'),
      },
      {
        text: '【冲击 L6 Staff 架构师】主导跨组核心架构设计 (L5 升 L6 专属高门槛)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L5 (Senior)' || cur === 'L5') && s.leetcode >= 70 && s.health >= 40 && s.tc >= 30;
        },
        reqBadge: '需 当前职级为L5 & 算法≥70 & 健康≥40 & TC≥30w',
        costBadge: '消耗健康与极高精力',
        effect: (s) => {
          const winRate = 0.15 + (s.leetcode / 100) * 0.15; // 15% - 30% hard chance
          const win = Math.random() < winRate;
          return win 
            ? { level: 'L6 (Staff)', tc: s.tc + 15, health: Math.max(10, s.health - 22), last_promo_age: s.age, message: '🎉 奇迹破局！你在晋升委员会 (Promo Committee) 手撕核心架构，打破了 35 岁天花板顺利晋升为 L6 Staff Engineer！总包 (TC) 暴涨 +15 万美元！' }
            : { health: Math.max(10, s.health - 18), message: '晋升委员会否决了你的 L6 Staff 申请，认为你的系统架构跨组 Impact 还不足以支撑 L6 职级。白卷了一整年。' };
        },
        nextEventId: (s) => (s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : ((s.message || '').includes('🎉') ? 'promo_celebration' : 'sv_daily_life')),
      },
      {
        text: '准点下班，躺平拿 Meets (保重身体)',
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'promo_celebration': {
    id: 'promo_celebration',
    title: '🎉 职级大晋升喜报！PROMOTION UNLOCKED',
    description: '轰动部门！鉴于你在公司核心业务中的突出 Impact，晋升委员会 (Promo Committee) 官方批准了你的职级晋升！',
    choices: [
      {
        text: '【欢呼庆祝】请团队喝 Boba 奶茶 & 继续奋斗 (健康 +5)',
        effect: (s) => ({ health: Math.min(100, s.health + 5), charm: s.charm + 1, message: `在全组同事的喝彩中，你正式挂上了 ${s.level} 的职级头衔，包裹与职场地位同步跃升！` }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'l6_staff_celebration': {
    id: 'l6_staff_celebration',
    title: '🏆 突破硅谷天花板！晋升 L6 Staff 架构师',
    description: '轰动全公司！你突破了 35 岁天花板与硅谷码农最大天堑，正式晋升为 L6 Staff Engineer 架构师！手握跨组技术决策权，年薪总包与期权迈入顶级行业前列。',
    choices: [
      {
        text: '【大摆宴席】在 Santana Row 举办全组升职庆功宴 (消耗 $0.5w, 魅力/健康加成)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          health: Math.min(100, s.health + 20),
          charm: Math.min(25, s.charm + 5),
          message: '全组同事与 VP 亲临现场向你祝贺！你挂上了 L6 Staff 的终极胸牌，成为了湾区技术圈里的传奇神仙！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【深藏功名】保持低调，发小红书“L5 升 L6 心得与系统架构面经”',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 6),
          luck: Math.min(45, s.luck + 10),
          message: '干货面经收割了数千赞！你被尊称为小红书与 Blind 上大佬级技术导师！'
        }),
        nextEventId: 'sv_daily_life',
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
        text: '【初识匹配】周末 Santana Row 喝奶茶 Coffee Date (单身 / 寻求 Match)',
        condition: (s) => !s.relationship_status || s.relationship_status === 'single',
        effect: (s) => {
          const winRate = 0.35 + (s.charm * 0.02) + (s.luck * 0.002) + (s.has_pet ? 0.20 : 0);
          const pass = Math.random() < winRate;
          return pass 
            ? { relationship_status: 'matched', charm: Math.min(25, s.charm + 2), imageUrl: 'images/boba_date.jpg', message: '【CMB 匹配成功 (Matched)】因为主页挂了滑雪和宠物照片，你成功匹配到了一位大厂同行！双方加了微信，聊得非常投机，进入互称 Matched 的匹配阶段！' }
            : { cash: Math.max(0, s.cash - 0.2), health: s.health - 5, imageUrl: 'images/boba_date.jpg', message: '连喝了三杯 Boba，对方一听你还没买房且身份未定，默默选择了 AA。你不仅花了钱还受到了真实伤害。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【情感升温】邀请匹配对象 (Matched) 一起去 Lake Tahoe 滑雪 (升温至 Dating)',
        condition: (s) => s.relationship_status === 'matched',
        reqBadge: '阶段：Matched 匹配中',
        effect: (s) => {
          const pass = Math.random() < 0.65;
          return pass
            ? { relationship_status: 'dating', charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: '【正式确立恋爱关系 (Dating)】Tahoe 的雪景与小木屋篝火让两人的感情迅速升温！你们正式官宣成为湾区甜甜蜜蜜的恋爱情侣 (Dating)！' }
            : { relationship_status: 'single', health: s.health - 10, message: '滑雪途中因为路线分配和谁洗碗产生了严重分歧，氛围降到冰点。回到湾区后双方互删退回单身。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【走进婚姻】与恋爱伴侣 (Dating) 在 Santa Clara 法院登记领证 (领证结婚)',
        condition: (s) => s.relationship_status === 'dating',
        reqBadge: '阶段：Dating 热恋中',
        effect: (s) => ({
          relationship_status: 'married',
          is_married: true,
          cash: s.cash + 20,
          message: '【领证结婚 (Married)】恭喜！你们在 Santa Clara 县法院正式登记结婚！两人合并了存款与工资 (+$20w 现金)，正式晋升为湾区神仙双职工家庭！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【豪车米其林开局】直奔米其林，豪车接送 (直接跨越至 Dating 热恋)',
        reqBadge: '豪车/高现金加成',
        condition: (s) => (s.cash >= 10 && (s.car === 'porsche' || s.car === 'cybertruck' || s.cash >= 30)) && (s.relationship_status === 'single' || !s.relationship_status),
        effect: (s) => {
          const hasLuxuryCar = s.car === 'porsche' || s.car === 'cybertruck';
          const winRate = (hasLuxuryCar ? 0.75 : 0.45) + (s.charm * 0.02);
          const pass = Math.random() < winRate;
          return pass
            ? { relationship_status: 'dating', cash: s.cash - 0.5, charm: Math.min(25, s.charm + 4), health: Math.min(100, s.health + 15), message: '【快速进入热恋 (Dating)】在豪华座驾与米其林的双重加持下，对方对你极其满意！两人跳过漫长拉扯，直接官宣确立了恋爱情侣关系 (Dating)！' }
            : { cash: s.cash - 0.5, health: s.health - 10, message: '你花了重金请吃米其林，结果发现对方只是来蹭饭打卡的“湾区海王/海后”。你成为了提款机，心痛不已！' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【婚姻维系】与伴侣 (Married) 享受双职工家庭生活 (已婚)',
        condition: (s) => s.relationship_status === 'married' || s.is_married,
        reqBadge: '阶段：Married 已婚',
        effect: (s) => ({
          health: Math.min(100, s.health + 20),
          cash: s.cash + 5,
          message: '你们关闭了工作提醒，享受了惬意的家庭时光。双职工互相扶持，家庭财务与身心状态稳步上升！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '算了吧，一个人挺好 (省钱省心)',
        effect: (s) => ({ health: Math.min(100, s.health + 5), cash: s.cash + 0.5, message: '你卸载了交友软件，省下了周末喝奶茶和请客吃饭的钱，宅在家里打游戏，心情出奇地平静。' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life',
      },
      {
        text: '定位电脑，勇闯奥克兰黑市！',
        effect: (s) => {
          const win = Math.random() > 0.7;
          return win 
            ? { charm: s.charm + 2, cash: s.cash, message: '你像叶问一样一打十，从黑帮手里夺回了电脑，成为了湾区传说！' }
            : { health: s.health - 30, cash: Math.max(0, s.cash - 0.5), message: '你不仅没找回电脑，还被打了一顿，医药费花了好几千。' };
        },
        nextEventId: 'sv_daily_life',
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
        effect: (s) => ({ health: s.health - 30, cash: s.cash, imageUrl: 'images/visa_denied.jpg', message: '你昼夜颠倒地干了两个月，头发掉光了，但保住了工作。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '管他呢，直接请无薪假在国内到处旅游！',
        condition: (s) => s.cash >= 20,
        effect: (s) => ({ cash: s.cash - 20, health: s.health + 30, leetcode: s.leetcode - 10, imageUrl: 'images/visa_denied.jpg', message: '你顺便打卡了三亚和新疆，身体是养好了，但是现金流大幅缩水，算法也生疏了。' }),
        nextEventId: 'sv_daily_life',
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
            : { health: s.health - 10, cash: s.cash, laid_off: true, message: '不管你怎么卷，你们整个组都被端了。你被裁员了！' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : 'sv_daily_life',
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
        text: '砸 $8w 现金找顶尖律师紧急加急办理 O1 杰出人才签证 (需要现金 >= $8w)',
        condition: (s) => s.cash >= 8,
        effect: (s) => {
          const pass = Math.random() < (0.65 + (s.is_phd ? 0.25 : 0) + (s.leetcode >= 60 ? 0.1 : 0));
          return pass
            ? { cash: s.cash - 8, visa: 'O1 (杰出人才)', message: '律师极其硬核！通过挖掘你在论文和项目中的亮点，成功压线批准了 O1 签证！绝地求生！' }
            : { cash: s.cash - 8, health: s.health - 20, message: '移民局驳回了 O1 申请，$8w 律师费打了水漂...' };
        },
        nextEventId: (s: GameState) => s.visa === 'O1 (杰出人才)' ? 'sv_daily_life' : 'h1b_final_crisis',
      },
      {
        text: '【钞能力自救】全额出资办理 EB-5 投资移民绿卡 (花费 $40w)',
        reqBadge: '现金>=40w',
        condition: (s) => s.cash >= 40,
        effect: (s) => ({ visa: '绿卡', cash: s.cash - 40, message: '在绝境中你果断出资办妥 EB-5 投资移民绿卡！彻底解决在美身份枷锁！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '紧急闪婚领证 (靠公民/绿卡对象救急)',
        effect: (s) => {
          const fake = Math.random() > 0.8;
          return fake
            ? { status: 'game_over', message: '移民局严肃调查判定为虚假婚姻，你被当场遣返回国并终身禁入美国，游戏结束！' }
            : { visa: '绿卡', is_married: true, message: '在绝境中你与对象紧急领证结婚，顺理成章提交了婚姻绿卡申请，拯救了身份！' };
        },
        nextEventId: (s: GameState) => s.status === 'game_over' ? 'end' : 'post_green_card',
      },
      {
        text: '接受外派温哥华/多伦多 L1 办公室 (曲线救国)',
        costBadge: '免费外派',
        effect: (s) => ({
          visa: 'L1 (外派)',
          l1_relocated: true,
          message: '你转到了温哥华分公司，凭 L1 签证曲线救国保住了工作！一年后顺利申请调回湾区 Headquarters！'
        }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'post_green_card': {
    id: 'post_green_card',
    title: '绿卡到手：硅谷新篇章',
    description: '身份的枷锁解除后，你发现硅谷的烦恼并没有结束。现在的你面临着人生新的十字路口。',
    choices: [

      {
        text: '砸 300 万现金全款买下 Atherton 顶级学区豪宅！(消耗 300 万)',
        condition: (s) => s.cash >= 300,
        effect: (s) => ({ visa: '绿卡', cash: s.cash - 300, rent: 0, has_housing: true, housing_name: 'Atherton 顶级豪宅', charm: Math.min(25, s.charm + 15), health: 100, message: '你买下了传说中硅谷大佬们扎堆的 Atherton 豪宅！现在你周末可以在自己的大别野里开 Pool Party，享受真正的人生赢家生活！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '继续在 Open House 现场观望挑房 (回到日常行动)',
        effect: (s) => ({ visa: '绿卡', message: '你看了一圈全现金竞价的疯狂现场，决定再冷静观察观察宏观降息走向。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '搞副业炒股：梭哈英伟达 (NVDA)！',
        effect: (s) => {
          const winProb = 0.25 + (Math.min(45, s.luck) / 150);
          const win = Math.random() < winProb;
          return win
            ? { visa: '绿卡', cash: s.cash + Math.min(120, Math.floor(s.cash * 0.6)), message: '皮衣黄刀法精准！英伟达业绩大超预期，你的股票投资获得了巨额收益！' }
            : { visa: '绿卡', cash: Math.max(1, Math.floor(s.cash * 0.6)), health: s.health - 15, message: '买在了高位... 监管禁令导致大厂股票大幅回撤。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '辞职！凭多年大厂的技术积累直接搞 AI Startup',
        effect: (s) => {
          const success = s.leetcode >= 50 && Math.random() < 0.3;
          return success
            ? { visa: '绿卡', age: s.age + 1, cash: s.cash + 200, tc: 0, rent: 4, message: '你带着前沿的 AI 理念获得了顶级风投 A 轮融资！手里的股权市值飙升！' }
            : { visa: '绿卡', age: s.age + 1, cash: Math.max(0, s.cash - 20), health: s.health - 20, message: '创业太烧钱了，大模型算力成本高昂，产品还没盈利资金见底，你只能重回大厂。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '不再唯唯诺诺，开始在职场上重拳出击',
        effect: (s) => ({ visa: '绿卡', charm: Math.min(25, s.charm + 3), message: '你拿着身份特权不再受气，在组会上直接反驳不合理的 Deadline。' }),
        nextEventId: 'office_politics',
      },
      {
        text: '彻底摆烂，佛系上班',
        effect: (s) => ({ visa: '绿卡', health: Math.min(100, s.health + 30), cash: s.cash + 10, age: s.age + 2, message: '你开始掌握精湛的职场太极，每天做最少的工作拿足额工资，把精力花在周末去 Tahoe 滑雪上。' }),
        nextEventId: 'sv_daily_life',
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
        text: '🏠 抢 Sunnyvale 70年代加州单层老破小 SFH (首付 $45w, 每年地税/房贷消耗低) - 湾区做题家神房',
        condition: (s) => s.cash >= 45,
        effect: (s) => ({ cash: s.cash - 45, rent: 1.5, has_housing: true, housing_name: 'Sunnyvale 老破小', health: s.health + 10, imageUrl: 'images/house.jpg', message: '虽说是 1974 年木板老破小且地板走起来吱吱响，但地大 7500 尺能开辟菜园种葱，去 Apple Park 和 Googleplex 只要 12 分钟！做题家终极神房落地！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '🏢 买 North San Jose 现代挑高高密度 Townhouse (首付 $40w, 年供折算 $2.5w) - 颜值极高的小红书美宅',
        condition: (s) => s.cash >= 40,
        effect: (s) => ({ cash: s.cash - 40, rent: 2.5, has_housing: true, housing_name: 'North San Jose 联排', charm: Math.min(25, s.charm + 5), message: '全套智能家电、石英石大理石中岛！虽然贴着 neighbor 抽油烟机且每月要上缴 $550 恶心 HOA 费，但每天拍 home decor 发小红书点赞爆表！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '🏫 攻下 Fremont Mission San Jose 9分顶配学区房 (首付 $65w, 年负担 $4.5w) - 卷二代的终极战场',
        condition: (s) => s.cash >= 65,
        effect: (s) => ({ cash: s.cash - 65, rent: 4.5, has_housing: true, housing_name: 'Fremont 学区房', charm: Math.min(25, s.charm + 4), luck: s.luck + 10, message: '为了娃彻底豁出去了！隔壁邻居全是高强度卷 AMC10 和卡内基梅隆机器人夏令营的硅谷老爹，社区图书馆周末全是解题小孩，神教合一！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '向国内父母紧急开支票（掏空六个钱包跨国电汇凑齐首付）',
        condition: (s) => s.cash < 45 && !s.parents_helped_house,
        effect: (s) => ({ cash: 0, has_housing: true, housing_name: 'Sunnyvale 老破小', health: s.health - 15, parents_helped_house: true, message: '父母卖掉了国内老家二线城市的房子跨国电汇给你凑齐了 Sunnyvale 首付，你背上了深沉的愧疚包袱与巨额房贷。' }),
        nextEventId: 'house_slave',
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
        effect: (s) => ({ rent: 2.2, has_housing: true, housing_name: 'Sunnyvale 老破小', health: Math.max(10, s.health - 5), message: '你把心安在了加州木板老破小里，虽然房贷沉重，但每次看到属于自己的草坪，干劲又回来了！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '把次卧与车库偷偷出租给转码留学生（每年回血 $1.5w 外快）',
        effect: (s) => {
          const badTenant = Math.random() > 0.65;
          return badTenant
            ? { rent: 1.2, has_housing: true, housing_name: 'Sunnyvale 老破小', health: Math.max(10, s.health - 15), message: '留学生搞加密货币挖矿弄跳闸了电闸还开派对，虽然收了租金，但把你折腾得够呛。' }
            : { rent: 0.8, has_housing: true, housing_name: 'Sunnyvale 老破小', cash: s.cash + 1.5, message: '好运！留学生是 CMU 学霸，安静极少下厨还按时交租，把你的实际每年房贷净支出压到了底线！' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '断供卖房！回归租房生活的自由',
        condition: (s) => s.cash < 50,
        effect: (s) => ({ cash: s.cash + 35, has_housing: false, housing_name: '普通合租单间', rent: 2, health: s.health + 10, message: '你最终无力支付房贷被迫断供卖房。虽亏掉了前期本金，但你卸下了深沉包袱，重新拿回流动资金回到出租屋。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '感觉人生一眼望到头，卖房去创业！(要求 100 万现金)',
        condition: (s) => s.cash >= 100,
        effect: (s) => ({ cash: s.cash - 50, message: '你受够了温水煮青蛙，卖了房子拿着巨资投入到了创业大潮中！' }),
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
        text: '硬着头皮睡后备箱！启动特斯拉营地模式把暖气拉满硬扛',
        effect: (s) => ({
          health: Math.max(15, s.health - 10),
          cash: Math.max(0, s.cash - 0.2),
          luck: Math.min(45, s.luck + 6),
          message: '你在后备箱睡袋里吃着打折冷蛋白棒堵了整整 9 个小时。第二天早晨 7:30 铲雪车终于打通道路，你抢到了 Heavenly 缆车头把梯，在大草海滑到了无痕绝美头粉！'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '识时务者为俊杰！果断掉头在 Sacramento 找快捷酒店吃自热火锅',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 15),
          charm: s.charm + 1,
          message: '你看着微信群同学在雪里冻得瑟瑟发抖求援救援车，自己在大床房里吃着海底捞自热火锅打黑神话，完成了最明智标准的湾区反向避险骚操作。'
        }),
        nextEventId: 'sv_daily_life'
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
        effect: (s) => {
          const win = Math.random() > 0.3; // 70% 成功率
          return win 
            ? { tc: s.tc + 30, cash: s.cash + s.tc, health: s.health - 20, imageUrl: 'images/burnout.jpg', message: `你干掉了同组的竞争对手，成功拿到了顶格绩效并升职！当前 TC 达到 ${s.tc + 30}w，包裹极大，但你的身体严重透支。` }
            : { health: s.health - 15, imageUrl: 'images/burnout.jpg', message: '辛辛苦苦卷了一年，名额却被空降的 VP 亲信抢走了。' };
        },
        nextEventId: (s) => s.health <= 0 ? 'end' : 'sv_daily_life',
      },
      {
        text: '太累了，降薪跳槽去 Google/Apple 养老',
        effect: (s) => ({ tc: Math.max(20, s.tc - 20), company: 'google', health: Math.min(100, s.health + 20), message: '你受够了 Meta 的高压，降薪跳槽去了以 WLB 著称的养老大厂。虽然包裹大幅缩水，但终于有了生活。' }),
        nextEventId: 'sv_daily_life',
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
        effect: (s) => ({ health: s.health - 30, message: 'Raj 用你写的代码做了一份精美的 PPT 向上汇报，他获得了晋升。你被边缘化了。', status: 'game_over' }),
        nextEventId: 'end',
      },
      {
        text: '放下 IDE，打开 PPT 开始高强度向上管理',
        effect: (s) => s.charm >= 12
          ? { tc: s.tc + 15, cash: s.cash + 15, charm: Math.min(25, s.charm + 2), message: '你顿悟了硅谷“向上管理”的精髓，精美 PPT 加上社交手腕打动了 VP，成功升职加薪！' }
          : { health: s.health - 25, charm: Math.max(0, s.charm - 2), message: '缺乏社交情商，你的汇报被对手挑出毛病，功劳全被同事占了。' },
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'layoff_hit': {
    id: 'layoff_hit',
    title: '不幸被裁 (裁员风暴)',
    description: '不幸遭遇了湾区科技公司大厂裁员潮，你抱着个人物品箱退出了 Slack。',
    imageUrl: 'images/layoff_box.jpg',
    choices: [
      {
        text: '【绿卡玩家专属】领取 Severance 遣散费，全职刷题无忧备战',
        condition: (s) => s.visa === '绿卡',
        effect: (s) => ({
          cash: s.cash + 8,
          laid_off: false,
          health: Math.min(100, s.health + 15),
          leetcode: Math.min(100, s.leetcode + 15),
          message: '手握绿卡无所畏惧！你拿到了 3 个月包 Severance 遣散费 (+$8w)，在家一边散步一边刷题，从容准备下一家大厂 Offer！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【绿卡玩家专属】申请加州 EDD 失业金，休假半年放空身心',
        condition: (s) => s.visa === '绿卡',
        effect: (s) => ({
          cash: s.cash + 3,
          laid_off: false,
          health: Math.min(100, s.health + 25),
          message: '领着加州 EDD 官方失业补贴，你顺便休假半年去 Lake Tahoe 滑雪，心态极度放松！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【强力人脉救援】联系 LinkedIn 熟人总监直通内部免试 referral 上岸 (需人脉 >= 35)',
        reqBadge: '需人脉>=35',
        condition: (s) => (s.network || 0) >= 35,
        effect: (s) => ({
          tc: Math.max(20, s.tc),
          laid_off: false,
          health: Math.min(100, s.health + 10),
          network: Math.min(100, (s.network || 0) + 5),
          message: '🎉 人脉爆破！你的熟人总监收到求助后连夜开绿灯将你内推拉入团队，跳过倒计时直接上岸，成功保住身份！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【工签身份】利用 60 天 H1B Grace Period 刷题限时上岸',
        condition: (s) => s.visa !== '绿卡',
        effect: (s) => s.leetcode > 60 
          ? { tc: 20, laid_off: false, cash: Math.max(0, s.cash - 2), health: s.health - 20, message: '有惊无险！凭高超算法在 60 天限期内火速入职新公司保住 H1B 身份！' }
          : { status: 'game_over', message: '没能在 60 天 H1B Grace Period 内找到支持 Visa Transfer 的新工作，身份到期被迫登机遣返回国。' },
        nextEventId: (s) => s.leetcode > 60 ? 'sv_daily_life' : 'end',
      }
    ]
  },
  'cn_work': {
    id: 'cn_work',
    title: '国内大厂体验期',
    description: '你在国内大厂打工攒钱，积累硬核工程经验与算法能力，为后续赴美做准备。',
    choices: [
      {
        text: '【打工攒钱】积累赴美存款 (积累 $8w 存款, 提高算法)',
        effect: (s) => ({ health: Math.max(25, s.health - 12), cash: s.cash + 8, age: s.age + 1, leetcode: s.leetcode + 15, message: '你打工一年攒下了 8 万美金存款，算法与硬核项目经验有了显著提升！' }),
        nextEventId: (s) => s.health <= 25 ? 'cn_burnout' : 'cn_work',
      },
      {
        text: '【申请美硕】拿着积蓄申请美国 CS 硕士 (顺利赴美)',
        condition: (s) => s.cash >= 4,
        effect: (s) => ({ cash: s.cash - 4, visa: 'F1 (学生)', age: s.age, message: '拿着打工攒下的第一桶金，你顺利通过签证与录取，踏上了赴美求学之路！' }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【跨海直投】凭硬核算法直接面北美大厂 Offer (需 LeetCode >= 50)',
        condition: (s) => s.leetcode >= 50,
        effect: (s) => ({ visa: 'OPT (实习)', tc: 22, cash: s.cash + 5, age: s.age + 1, message: '陆本硬核算法发威！你跨海面过了北美大厂并拿到签证 Offer，直接飞往硅谷！' }),
        nextEventId: 'job_hunt',
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
        effect: (s) => ({ cash: Math.max(0, s.cash - 1), health: Math.min(100, s.health + 40), age: s.age + 1, message: '在医保绝大部分报销后，你休养了半个月恢复了健康！' }),
        nextEventId: 'cn_work'
      },
      {
        text: '趁机申请美硕离开 (留学贷款 + TA 助教，需评估项目背景与算法)',
        reqBadge: '需算法/背景评估',
        effect: (s) => {
          const pass = (s.leetcode >= 20) || (Math.random() < 0.50 + (s.luck / 200));
          return pass
            ? { cash: Math.max(0, s.cash - 2), visa: 'F1 (学生)', age: s.age, health: Math.min(100, s.health + 20), message: '🎉 申请成功！凭借在国内大厂积累的工程项目经历，你顺利通过无抵押贷款审核与 Master 录取，开启赴美新生活！' }
            : { health: s.health - 10, message: '❌ 申请被拒！留学贷款机构与校方评估认为你负债风险过高，贷款未获批准。你只能留在本地继续调养或打工。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('赴美新生活') ? 'us_master_year1' : 'cn_work'
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
    description: '你进入了/创办了一家 Startup，每天一个人干三个人的活。现在的风向变了，关于公司的方向：',
    imageUrl: 'images/ai_startup.jpg',
    choices: [

      {
        text: '坚守传统赛道 (如 SaaS / Web3)',
        effect: (s) => {
          let winRate = 0.15;
          if (s.year >= 2020 && s.year <= 2022) winRate = 0.35;
          const win = Math.random() < winRate; 
          return win 
            ? { cash: s.cash + 150, message: '奇迹发生！公司靠稳扎稳打被大厂收购了，你的期权兑现了大笔现金！' }
            : { cash: Math.max(0, s.cash - 5), health: s.health - 15, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸。' };
        },
        nextEventId: (s) => (s.message || '').includes('收购') ? 'sv_daily_life' : (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型套壳',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: s.cash - 10, health: s.health - 20, message: `现在才 ${s.year} 年，你的 AI 理念太超前了！投资人觉得你不切实际，拒绝投资，公司倒闭。` };
          }
          const win = Math.random() < 0.18;
          return win 
            ? { cash: s.cash + 300, visa: '绿卡', imageUrl: 'images/ai_startup.jpg', message: '踩中 AI 风口！拿到巨额融资，你的期权大幅升值，顺便获得了 EB-1 杰出人才绿卡！' }
            : { cash: Math.max(0, s.cash - 10), health: s.health - 25, imageUrl: 'images/layoff_box.jpg', message: '转型太慢，被巨头连夜更新的接口直接背刺干死了...' };
        },
        nextEventId: (s) => (s.message || '').includes('绿卡') ? 'sv_daily_life' : (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
      }
    ]
  },
  'dropout_fail': {
    id: 'dropout_fail',
    title: '创业梦碎',
    description: '你的公司倒闭了，你不仅没有学历，也没有签证。',
    choices: [

      {
        text: '灰溜溜回国啃老',
        effect: (s) => ({ status: 'game_over', message: '你带着失败的经历回到国内，成为了亲戚眼中的笑话。' }),
        nextEventId: 'end'
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
          const pass = Math.random() > 0.3;
          return pass 
            ? { age: s.age + 2, health: s.health - 15, leetcode: s.leetcode + 20, message: '两年的昼夜颠倒，你的论文终于有了一些突破性的进展，老板决定带你去夏威夷参加顶级学术会议！' }
            : { age: s.age + 2, health: s.health - 20, message: '论文被拒了无数次，实验数据全崩，你陷入了深深的自我怀疑。' };
        },
        nextEventId: (s) => ((s.message || '').includes('夏威夷') ? 'phd_conference' : 'phd_life')
      },
      {
        text: '老板太坑了，我要 Master Out (拿个硕士跑路求职)',
        effect: (s) => ({ age: s.age + 2, health: s.health + 10, message: '你及时止损，认清了自己不适合做学术，拿着硕士学位重回求职大军。' }),
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
            ? { tc: 80, cash: s.cash + 20, health: s.health - 20, visa: 'O1 (杰出人才)', job_type: 'ai_research', level: 'MTS', message: '震撼硅谷！你攻克了 AGI 前沿推理大模型面试，OpenAI 直接用 $80w 顶配包裹和 O1 签证把我聘为核心研究员！' }
            : { health: s.health - 20, message: 'OpenAI 核心研究员面试太残酷了！不仅手撕 Triton 算子还深考系统对齐论文，你很遗憾没能拿到 Offer。好在顶级大厂抢着要你的 PhD 光环！' };
        },
        nextEventId: (s: GameState) => {
          if (s.tc < 45 && !s.job_type) return 'job_hunt';
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
          return (s.has_housing && !isDorm) ? 'sv_daily_life' : 'choose_housing';
        },
      },
      {
        text: '去大厂当 Applied Scientist (应用科学家)',
        effect: (s) => ({ tc: 45, cash: s.cash + 15, visa: 'O1 (杰出人才)', job_type: 'ai_research', level: 'L5', message: '大厂的科学家岗位待遇丰厚，不用写 CRUD，直接解决核心算法问题，生活相对安稳。' }),
        nextEventId: (s: GameState) => {
          const isDorm = !s.housing_name || ['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(s.housing_name);
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
        text: '相信老板的 PPT，自愿降薪换取更多期权 (15% 概率获得天价收购)',
        effect: (s) => {
          const win = Math.random() < 0.15;
          return win 
            ? { cash: s.cash + 400, status: 'win', message: '🎉 奇迹爆发！公司被大厂以 $20 亿美金天价收购，你的期权直接兑现 $400w！直接实现财务自由 (FIRE) 爆破通关！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s: GameState) => s.status === 'win' ? 'end' : 'job_hunt',
      },
      {
        text: '【带资领投】自己掏 $10w 领投公司 Seed 轮自救',
        reqBadge: '现金>=10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => {
          const win = Math.random() < 0.4;
          return win
            ? { cash: s.cash + 120, tc: s.tc + 20, message: '你带资入组！公司靠你的资金撑到了 A 轮融资并估值大暴涨，你的 TC 与期权收益双双爆表！' }
            : { cash: s.cash - 10, tc: 0, laid_off: true, health: s.health - 20, message: '砸进去的 $10w 没能挽救寒冬，公司还是倒闭了...你不仅没了工作还心痛不已。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : 'sv_daily_life',
      },
      {
        text: '偷偷骑驴找马，准备跑路',
        effect: (s) => ({ health: s.health - 5, tc: 0, cash: s.cash, laid_off: true, message: '你一边假装努力工作，一边偷偷刷题。不久后公司果然资金链断裂，你不得不重新找工作。' }),
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
            ? { tc: s.tc + 25, cash: s.cash + 30, visa: 'O1 (杰出人才)', charm: Math.min(25, s.charm + 4), health: s.health - 20, message: '🌟 论文斩获 NeurIPS Best Paper！你提出的推理大模型架构震惊学术界与工业界！公司立刻发了 $30w Retention Bonus 并协助加急批复了 O1 签证！' }
            : { health: s.health - 25, cash: s.cash, message: '熬了半个月，结果撞车了别人的工作被直接 Reject，心态炸裂。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '佛系跟进，不争不抢',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '反正公司也不差你这一个项目，你按时下班，每天看着同事们卷生卷死。' }),
        nextEventId: 'sv_daily_life',
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
            ? { cash: s.cash + 250, health: s.health - 25, message: '🚀 华尔街之狼！这波疯狂杠杆让你单月帮基金出海捕捞暴赚！老板亲手为你颁发了 $250w 美金的年终 Bonus 巨额支票！' }
            : { cash: Math.max(0, s.cash - 15), health: s.health - 30, laid_off: true, message: '黑天鹅爆发！杠杆爆仓导致策略穿仓，不仅 Bonus 归零，你还收到了 HR 的解雇协议。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : 'sv_daily_life',
      },
      {
        text: '相信数学，不干预策略 (求稳退守)',
        effect: (s) => ({ health: s.health - 10, cash: s.cash + 15, message: '虽然每天看着回撤心惊肉跳，但你还是忍住了干预的冲动。最终策略慢慢回本，年底拿到了小额 Bonus。' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '买机票回国拔牙！',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: s.cash - 0.2, health: s.health + 20, message: '机票 $1500，拔牙只要 200 块人民币！顺便还能吃顿火锅，身心愉悦！' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '吃布洛芬硬抗 (免费)',
        effect: (s) => ({ health: s.health - 20, message: '为了省钱你选择了硬抗，结果引发了感染，痛不欲生。' }),
        nextEventId: 'sv_daily_life'
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
            ? { cash: s.cash + 60, message: '你买的土狗币居然真的小火了一把！你在高点果断卖出提现，狠赚了一笔！' }
            : { cash: Math.max(0, s.cash - 5), health: s.health - 15, imageUrl: 'images/crypto_crash.jpg', message: '经典的杀猪盘。项目方第二天就跑路了，你的钱全都变成了空气币。' };
        },
        nextEventId: 'sv_daily_life'
      },
      {
        text: '天上不会掉馅饼，退群保平安',
        effect: (s) => ({ charm: s.charm + 1, message: '你敏锐地察觉到了这是骗局，并且在小红书上发帖曝光，获得了不少点赞。' }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life',
      },
      {
        text: '去大厂食堂薅羊毛拿免费气泡水',
        effect: (s) => ({ health: s.health + 2, cash: s.cash + 0.1, message: '你拒绝被消费主义洗脑。周末假装去公司加班，从 Pantry 顺走了两罐 La Croix 气泡水和几包零食，完美解决下午茶。' }),
        nextEventId: 'sv_daily_life',
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比极高的湾区中产标准',
        effect: (s) => ({ rent: 2, housing_name: 'Cupertino 2b2b合租', message: '你搬进了 Cupertino 经典的双主卧合租公寓，省钱又方便。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '挂壁大客厅隔间 (每年 1 万美元): 极致压低开销狂攒首付/防破产',
        effect: (s) => ({ rent: 1, charm: Math.max(0, s.charm - 2), health: Math.max(10, s.health - 10), housing_name: '客厅屏风隔间', message: '你搬回了客厅屏风隔间，将每年固定的房租开销砍到了极致。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '🎒 终极挂壁：连夜退租！搬进特斯拉/租用 Van 里睡车顶 (房租归零 $0/年)',
        condition: (s) => !!(s.car && s.car !== 'none'),
        effect: (s) => ({ rent: 0, housing_name: '特斯拉 睡车顶', health: Math.max(10, s.health - 15), message: '你把睡袋卡式炉扔进车后备箱，正式开启硬核湾区车顶睡袋生活！房租彻底归零！' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '↩️ 算了，目前的房子住得挺好，不搬了',
        effect: (s) => ({ message: '你打消了搬家念头。' }),
        nextEventId: 'sv_daily_life'
      }
    ]
  },
  'end': {
    id: 'end',
    title: '游戏结束',
    description: '',
    choices: [
]
  },

  'rto_wars': {
    id: 'rto_wars',
    title: 'RTO (Return to Office) 查考勤大战',
    description: 'CEO 突然宣布全员每周必须在办公室打卡 3 天，否则直接取消奖金甚至开除！你之前为了省房租偷偷搬到了便宜的外州/偏远地区，现在面临极大危机。',
    choices: [
      {
        text: '老老实实搬回湾区租昂贵的公寓 (房租重置为 4w)',
        effect: (s) => ({ rent: 4, health: s.health - 15, message: '你极不情愿地回到了湾区，每个月的房租让你心如刀割，但至少保住了工作。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '淘宝买物理点击器+找同事代刷工牌 (高风险)',
        effect: (s) => {
          const caught = Math.random() < 0.3;
          return caught
            ? { tc: 0, laid_off: true, health: s.health - 30, message: '你的代刷工牌行为被 HR 发现，直接以违纪名义当天开除！' }
            : { cash: s.cash + 5, charm: s.charm + 2, message: '成功瞒天过海！你一边拿着加州的工资，一边享受着外州的低物价。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_daily_life'
      },
      {
        text: '硬刚 Manager：“要么让我 Remote，要么我走人！”',
        effect: (s) => {
          const win = s.leetcode >= 70 && Math.random() < 0.5;
          return win
            ? { tc: s.tc + 2, charm: Math.min(25, s.charm + 5), message: '由于你是团队的核心骨干（High Performer），Manager 妥协了，给你申请了特殊的 Remote Exception！' }
            : { tc: 0, laid_off: true, message: 'Manager 冷笑一声：“现在是买方市场，门在那边。” 你被解雇了。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_daily_life'
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
            ? { tc: 0, laid_off: true, health: Math.max(10, s.health - 40), message: '你在 J1 的架构会上忘记静音，突然用 J2 的称呼回答了问题！两家公司的 HR 连夜拉平信息，你被双双开除！' }
            : { cash: s.cash + s.tc, health: Math.max(10, s.health - 30), leetcode: s.leetcode + 5, message: '你用两台电脑同时开会，成功拿到了双倍工资！但是巨大的上下文切换让你精神分裂。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_daily_life'
      },
      {
        text: '算了吧，安分守己',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你拒绝了高危的诱惑，每天下午 3 点准时躺在沙发上看 Netflix，这就是 WLB。' }),
        nextEventId: 'sv_daily_life'
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
        effect: (s) => ({
          tc: s.tc + 6,
          charm: Math.min(25, s.charm + 5),
          health: Math.min(100, s.health + 15),
          message: '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！一位科技基金合伙人主动拉你组队打双打，并现场推荐你去了顶级 AI 独角兽团队！'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '花 $1w 买全套顶级装备去混圈子',
        condition: (s) => s.cash >= 1,
        effect: (s) => {
          const win = Math.random() > 0.5;
          return win
            ? { cash: s.cash - 1, tc: s.tc + 5, charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), message: '你的球技极佳，在场上和一位 VC 成了双打搭档，对方随手把你推荐给了一家明星公司，总包大涨！' }
            : { cash: s.cash - 1, health: Math.max(10, s.health - 15), message: '你用力过猛拉伤了跟腱，不仅没混到圈子，还在家躺了半个月。' };
        },
        nextEventId: 'sv_daily_life'
      },
      {
        text: '不去，宅在家打黑神话',
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你拒绝了无效社交，在家又通关了一次二郎神，神清气爽。' }),
        nextEventId: 'sv_daily_life'
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
        effect: (s) => ({ cash: s.cash / 2, is_married: false, relationship_status: 'single', health: Math.max(10, s.health - 20), message: '你们平静地签了字。由于湾区共同财产法，你分走了一半的共同资产，重新搬回了单身公寓。你的生活瞬间空虚了许多。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '花 $10w 请湾区顶级离婚律师打官司 (高风险)',
        condition: (s) => s.cash >= 15,
        effect: (s) => {
          const win = Math.random() > 0.5;
          return win
            ? { cash: (s.cash - 10) * 0.9, is_married: false, relationship_status: 'single', health: Math.max(10, s.health - 30), message: '律师非常给力！你成功保住了 90% 的婚内资产，但漫长的官司让你心力交瘁，头发白了一半。' }
            : { cash: (s.cash - 10) * 0.3, is_married: false, relationship_status: 'single', health: Math.max(10, s.health - 40), message: '律师是个水货！不仅花了高昂的律师费，你还被判决失去了 70% 的资产，你直接崩溃了！' };
        },
        nextEventId: 'sv_daily_life'
      },
      {
        text: '痛哭流涕挽留，发誓每天准时 5 点下班做饭',
        effect: (s) => {
          const win = s.charm >= 10 && Math.random() > 0.5;
          return win
            ? { tc: Math.max(0, s.tc - 5), health: Math.min(100, s.health + 10), message: '对方心软了。你为了家庭减少了工作投入，甚至放弃了升职机会，虽然职场发展受阻，但保住了这个家。' }
            : { cash: s.cash / 2, is_married: false, relationship_status: 'single', health: Math.max(10, s.health - 30), message: '破镜难重圆。对方觉得你只是在画大饼，依然坚决离开了你。你被动平分了资产。' };
        },
        nextEventId: 'sv_daily_life'
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
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), leetcode: Math.min(100, s.leetcode + 5), message: '你逻辑严密，把全场玩伴的漏洞指得一清二楚，带领好人阵营完胜！但是大家觉得你太有压迫感了，活动结束后没一个人加你微信。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '装小白疯狂给人递水，主打情绪价值',
        effect: (s) => {
          const win = Math.random() > 0.5;
          return win
            ? { charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 10), relationship_status: 'dating', message: '你全程温柔体贴，虽然游戏输了，但成功撩到了一个同样来相亲的大厂同行！你们聊得火热，互加微信并确立了恋爱关系 (Dating)！' }
            : { charm: Math.min(25, s.charm + 1), health: s.health + 5, cash: Math.max(0, s.cash - 0.2), message: '你跑前跑后伺候大家，当了一整天的“沸羊羊”，虽然交了几个普通朋友，但并没有人看上你。' };
        },
        nextEventId: 'sv_daily_life'
      },
      {
        text: '发现场地的老板正在招全栈工程师，去聊聊',
        effect: (s) => {
          const win = s.leetcode >= 50;
          return win
            ? { tc: s.tc + 3, cash: s.cash + 2, message: '你没去相亲，反而帮老板解决了一个支付系统的 Bug！老板塞给你一份兼职外包合同，赚了点外快。' }
            : { message: '你和老板聊了半天，发现对方只是想白嫖你写个订餐小程序，你礼貌地拒绝了。' };
        },
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '与旁边脱下镁粉袋的老哥交流动态跳跃 (尝试搭讪拓展人脉)',
        effect: (s) => {
          const win = Math.random() < 0.45;
          return win
            ? {
                tc: s.tc + 5,
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
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '打温和拉球，场下与搭档畅聊 AI 风口与美股',
        effect: (s) => ({
          cash: s.cash + 4,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, s.charm + 2),
          message: '打完球后大家在场边喝电解质水，搭档大佬随口指点了你几只算力概念股，你果断跟进，随后获得了 $4w 美金的短期投资回报！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '中途在草地上躺平休养，呼吸湾区新鲜空气',
        effect: (s) => ({
          health: Math.min(100, s.health + 18),
          message: '阳光洒在身上，看着远处的牛群与红木山谷，你久违地感受到了灵魂的放松与惬意。'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '海景酒店阳台躺平，听海浪声睡三整天 (花费 $0.4w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 22),
          message: '彻底关闭 Slack 和 Outlook 提醒！在海浪声中睡到了自然醒，Burnout 症状被完美治愈。'
        }),
        nextEventId: 'sv_daily_life'
      }
    ]
  },
  'japan_trip': {
    id: 'japan_trip',
    title: '【绿卡自由行】东京羽田/京都赏枫度假',
    description: '彻底摆脱了 H1B 返美签 Stamp 审查与 AP 跑路纸的心理阴影，你拿到了美国绿卡，买了一张旧金山直飞东京羽田的头等舱机票！',
    choices: [
      {
        text: '银座狂买 & 奢华怀石料理/米其林 (消耗 $1.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.5),
          health: Math.min(100, s.health + 15),
          charm: Math.min(25, s.charm + 5),
          message: '你享受了最高规格的日式招待！品尝了顶配和牛与怀石料理，在银座彻底放空身心！'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '富士山小木屋温泉私汤连泡 5 天 (消耗 $0.8w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.8),
          health: Math.min(100, s.health + 20),
          message: '望着富士山雪景泡温泉，热气腾腾中所有的湾区职场焦虑烟消云散！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '下场 17-Mile 沿海公路体验极限跑山 (消耗 $0.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          charm: Math.min(25, s.charm + 5),
          health: Math.max(10, s.health - 5),
          message: '引擎轰鸣，推背感拉满！你在湾区跑车圈名声大噪！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '拍摄全套 Home Decor 发小红书“湾区买房心得”',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 5),
          luck: Math.min(45, s.luck + 5),
          message: '爆款文章收割了上千点赞！你成为了小红书湾区家居/房产圈的顶流 Blogger！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '观望不投，只去品尝顶级红酒与交流网络',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 2),
          health: Math.min(100, s.health + 5),
          message: '你保持了理智，蹭到了昂贵的红酒并拓展了资本圈高管人脉。'
        }),
        nextEventId: 'sv_daily_life'
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
        effect: (s) => ({
          health: Math.max(10, s.health - 15),
          message: '你白加黑倒时差工作了两周，终于等到了 Passport 带着 Stamp 寄回！成功惊险返美！'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '联系公司法务开具紧急加急信 (Expedite Request)',
        effect: (s) => {
          const pass = Math.random() < 0.55;
          return pass 
            ? { health: Math.min(100, s.health + 5), message: '加急信生效！领事馆提早批复了你的 Visa Stamp，你顺利搭上返美航班！' }
            : { health: s.health - 10, cash: Math.max(0, s.cash - 1), message: '领事馆回复“标准审查无法加急”，你被迫在加州时间深夜远程办公，精疲力竭。' };
        },
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【DoorDash 薅羊毛】研究 Uber Eats / DoorDash 满减优惠券',
        effect: (s) => ({
          cash: s.cash + 0.3,
          message: '虽然每天在不同 App 里切账号领优惠券只省了几百刀，但薅到羊毛的成就感让你乐此不疲！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【生成式 AI 幻觉】全信 AI 自动生成的代码，未审核直接 Push 到 Production 生产环境！',
        effect: (s) => {
          const win = Math.random() < 0.45;
          return win
            ? { luck: Math.min(45, s.luck + 5), cash: s.cash + 2, message: '产线竟然零报错无缝运行！用户量大增，领导夸赞你产出惊人！' }
            : { health: Math.max(10, s.health - 15), message: 'AI 幻觉写出了逻辑死锁导致大厂全网宕机 2 小时！你半夜被 PagerDuty 电话叫醒去改底层 C++！' };
        },
        nextEventId: 'sv_daily_life'
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
          cash: s.cash + 50,
          charm: Math.min(25, s.charm + 6),
          job_type: 'startup',
          message: 'a16z 领投 $50 万美金！你登上了 TechCrunch 头条，成为硅谷最炙手可热的 AI Agent 创业明星！'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【开源上星】在 GitHub 开源该项目，收割 15k Stars',
        effect: (s) => ({
          charm: Math.min(25, s.charm + 5),
          luck: Math.min(45, s.luck + 8),
          leetcode: Math.min(100, s.leetcode + 10),
          message: '项目登上了 GitHub Trending 榜首！全球几万开发者给你送 Star，连 Sam Altman 都转发了你的 Tweet！'
        }),
        nextEventId: 'sv_daily_life'
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
          health: Math.max(10, s.health - 20),
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          message: '你升任了 EM 管理岗！TC 飙升，但每天要在各类汇报与背 PIP 的沉重压力下度过，白头发暴增。'
        }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【死守 IC 架构师】做纯粹的技术专家，拒绝开扯皮管理会',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          health: Math.min(100, s.health + 10),
          message: '你守住了纯粹技术人的尊严！虽然放弃了管理岗加薪，但工作与生活恢复了健康平衡！'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【死守传统底层系统】强调 Legacy Code 维护的重要性与安全性',
        effect: (s) => {
          const win = Math.random() < 0.40;
          return win
            ? { health: s.health + 5, message: '老系统发生重大产线事故，全球只有你懂得如何救火！你成功凭借稀缺性保住了铁饭碗！' }
            : { laid_off: true, health: s.health - 15, message: '部门最终决定整体重组裁撤！你拿着 Severance 遣散费步入了中年求职市场。' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【加入 HOA 业委会抗争】在社区业主大会上与 HOA 主席展开大战',
        effect: (s) => ({
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          health: Math.max(10, s.health - 15),
          message: '你在邻居群里化身意见领袖，成功把摊派金额砍到了 $1.5w！虽然省了钱，但整整三个星期都在和业委会扯皮，身心俱疲。'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【轻伤不下火线】吃降压药硬抗，继续为下一个 Promotable Project 拼命',
        effect: (s) => ({
          health: Math.max(10, s.health - 20),
          tc: s.tc + 5,
          message: '你靠吃药硬撑过了 Q4 冲刺！虽然顺利拿到了加薪，但腰椎间盘的剧痛让你每天只能躺在地上看代码。'
        }),
        nextEventId: 'sv_daily_life'
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
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【抢学区房鸡娃】买 Fremont 10 分学区房，报名卡内基梅隆机器人夏令营',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 15),
          health: s.health - 10,
          rent: 4.5,
          has_housing: true,
          housing_name: 'Fremont 10分学区房',
          message: '你步入了湾区老爹鸡娃正轨！社区邻居全是高强度卷 AMC10 的硅谷大佬，每天陪娃解题虽然辛苦但充实。'
        }),
        nextEventId: 'sv_daily_life'
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
          const win = Math.random() < 0.65;
          return win
            ? { cash: s.cash + 15, luck: Math.min(99, s.luck + 5), message: '英伟达股价再创历史新高！你的股票账户直接起飞，净资产暴涨！' }
            : { cash: Math.max(0, s.cash - 5), message: '追高在阶段性山顶，大盘短期回调，你被套牢了部分现金。' };
        },
        nextEventId: 'sv_daily_life'
      },
      {
        text: '【落袋为安抛售套现】把归属的 RSU 及时 Sell，锁住现金买国债/S&P500',
        effect: (s) => ({
          cash: s.cash + 8,
          message: '你稳健落袋为安！拿着现金稳稳躺赚高息，理财心态稳如老狗。'
        }),
        nextEventId: 'sv_daily_life'
      }
    ]
  }
};
