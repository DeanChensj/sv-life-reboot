import { useState, useEffect } from 'react';

// Types
type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | 'O1 (杰出人才)' | '绿卡';

interface GameState {
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
  job_type?: 'big_tech' | 'startup' | 'ai_research' | 'quant' | 'unemployed';
  imageUrl?: string;
  has_housing: boolean;
  car?: 'none' | 'model_y' | 'porsche' | 'cybertruck';
  status: 'playing' | 'game_over' | 'win';
  message: string;
  ap: number;
  max_ap: number;
}

interface Choice {
  text: string;
  effect: (state: GameState) => Partial<GameState>;
  nextEventId: string | ((state: GameState) => string);
  condition?: (state: GameState) => boolean;
}

interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: Choice[];
}

// Initial State
export const generateInitialState = (): GameState => {
  const cached = localStorage.getItem('sv_life_initial_seed');
  let cash, charm, luck;
  if (cached) {
    const parsed = JSON.parse(cached);
    cash = parsed.cash;
    charm = parsed.charm;
    luck = parsed.luck;
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
    luck = Math.floor(Math.random() * 100);
    localStorage.setItem('sv_life_initial_seed', JSON.stringify({ cash, charm, luck }));
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
    year: 2018, // 默认，会被第一步覆盖
    gc_progress: 0,
    has_us_degree: false,
    school: '',
    is_phd: false,
    has_pet: false,
    luck,
    is_married: false,
    win_threshold: 1000,
    laid_off: false,
    has_housing: false,
    car: 'none',
    status: 'playing',
    message: bgMessage
  };
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
        effect: (s) => ({ leetcode: s.leetcode + 40, health: s.health - 20, win_threshold: 600 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【湾区海王】精通高端局社交，极其擅长拿捏人心，但一看到代码就犯困。',
        effect: (s) => ({ charm: Math.min(20, s.charm + 12), cash: Math.max(2, s.cash), leetcode: Math.max(0, s.leetcode - 5), win_threshold: 500 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【家里有矿】家里直接在湾区给你准备了买房首付，但天天蹦迪身体被彻底掏空。',
        effect: (s) => ({ cash: s.cash + 25, leetcode: Math.max(0, s.leetcode - 30), health: s.health - 20, win_threshold: 1000 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【天选之子】玄学护体，总能在关键时刻化险为夷，但日常总是笨手笨脚惹人嫌。',
        effect: (s) => ({ luck: 45, leetcode: s.leetcode + 10, charm: s.charm + 10, win_threshold: 400 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【小镇做题家】毫无波澜的普通面板，纯凭实力打拼。',
        effect: (s) => ({ win_threshold: 500 }),
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
        text: 'CMU 计算机本科 (四年总开销 30 万美元)',
        condition: (s) => s.cash >= 30,
        effect: (s) => ({ cash: s.cash - 30, visa: 'F1 (学生)', has_us_degree: true, school: 'cmu', age: s.age, leetcode: s.leetcode + 10, health: s.health - 5, message: '你坐上了飞往匹兹堡的航班。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: 'UC Berkeley 本科 (四年总开销 25 万美元)',
        condition: (s) => s.cash >= 25,
        effect: (s) => ({ cash: s.cash - 25, visa: 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age, leetcode: s.leetcode + 5, message: '你带着对湾区的憧憬降落在 SFO。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '美国普通公立大学 (四年总开销 15 万美元)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', has_us_degree: true, school: 'state', age: s.age, charm: s.charm + 2, message: '你飞往美国，准备开启无忧无虑的本科生活。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '在国内读本科 (四年总开销 2 万美元)',
        effect: (s) => ({ cash: s.cash - 2, age: s.age + 4 }),
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
    id: 'cn_college_year1',
    title: '陆本大一：百团大战',
    description: '进入了国内大学，开学百团大战，各种社团招新。',
    choices: [

      {
        text: '加入学生会，成为海王/海后',
        effect: (s) => ({ charm: s.charm + 2, health: s.health - 5, age: s.age + 2, message: '你在学生会混得风生水起，天天夜宵。' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '加入 ACM 算法集训队',
        effect: (s) => ({ leetcode: s.leetcode + 25, health: s.health - 15, age: s.age + 2, message: '天天刷题，虽然头发掉了一些，但算法突飞猛进。' }),
        nextEventId: 'cn_college_year3',
      }
    ]
  },
  'cn_college_year3': {
    id: 'cn_college_year3',
    title: '陆本大三：迷茫期',
    description: '大三了，周围人都在考研或出国。你的室友托福连挂三次。',
    choices: [

      {
        text: '报班死磕托福/GRE (为了出国)',
        effect: (s) => ({ cash: s.cash - 2, health: s.health - 10, age: s.age + 1, message: '考出了满意的托福成绩！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '佛系对待，每天在寝室打黑神话悟空',
        effect: (s) => ({ health: s.health + 10, leetcode: s.leetcode - 5, age: s.age + 1, message: '虽然很爽，但荒废了学业。' }),
        nextEventId: 'cn_undergrad_grad',
      }
    ]
  },
  'us_undergrad_grad': {
    id: 'us_undergrad_grad',
    title: '美本毕业',
    description: '四年过去了，你顺利从美国大学毕业，目前持有 OPT。现在是找工作还是继续深造？',
    choices: [
      {
        text: '申请北美顶尖 PhD (做 Research) (需 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => ({ cash: s.cash + 2, age: s.age + 1 }),
        nextEventId: 'phd_life',
      },

      {
        text: '直接找工作 (开始受苦)',
        effect: (s) => s.year === 2020 
          ? { message: '疫情爆发！各大公司全面冻结招聘，应届生根本找不到工作！你只能被迫继续留在学校延长毕业一年。', health: s.health - 10, year: s.year + 1, age: s.age + 1 }
          : { visa: 'OPT (实习)', leetcode: s.leetcode + 10, message: '你开始了漫漫求职路...' },
        nextEventId: (s) => (s.year === 2020 && s.year <= 2020) ? 'us_undergrad_grad' : 'job_hunt',
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
        text: '全奖直博美国 (北美学术民工) (需 LeetCode >= 30)',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => ({ cash: s.cash + 2, visa: 'F1 (学生)', age: s.age + 1 }),
        nextEventId: 'phd_life',
      },

      {
        text: '申请美国水硕 (为了留在湾区！)',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({ cash: s.cash - 10, visa: 'F1 (学生)', age: s.age }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '在国内大厂卷 (提前体验福报)',
        effect: (s) => ({ cash: s.cash + 10, health: s.health - 20, tc: 5, age: s.age + 3 }),
        nextEventId: 'cn_work',
      }
    ]
  },
  'us_undergrad_year1': {
    id: 'us_undergrad_year1',
    title: '美本前两年：适应期',
    description: '刚来美国，你对一切都很新奇。你决定怎么度过最初的两年？',
    choices: [
      {
        text: '加入兄弟会/姐妹会 (Frat/Sorority Party)',
        effect: (s) => ({ cash: s.cash - 2, charm: s.charm + 10, health: s.health - 10, age: s.age + 2, message: '每周喝到断片，但在啤酒乒乓桌上认识了一堆富二代朋友。' }),
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '泡在图书馆死磕 GPA 和算法',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 5, age: s.age + 2, message: '每天和电脑作伴，头发掉了不少，但代码能力突飞猛进。' }),
        nextEventId: 'us_undergrad_year3',
      },
      {
        text: '买辆二手车，周末去一号公路自驾游',
        effect: (s) => ({ cash: s.cash - 3, health: s.health + 10, charm: s.charm + 5, age: s.age + 2, message: '花了不少钱，但见识了加州的美景，心胸开阔。' }),
        nextEventId: 'us_undergrad_year3',
      }
    ]
  },
  'us_undergrad_year3': {
    id: 'us_undergrad_year3',
    title: '美本大三：实习焦虑',
    description: '转眼到了大三，周围的中国同学都在疯狂找暑期实习 (Summer Intern)。你打算怎么办？',
    choices: [
      {
        text: '海投 500 份简历，疯狂刷 LeetCode',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 10, age: s.age + 2, message: '你拿到了硅谷大厂的实习 Offer，为全职铺平了道路！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '躺平，在加州阳光下享受最后的青春',
        effect: (s) => ({ health: s.health + 10, charm: s.charm + 5, age: s.age + 2, message: '没有实习经历，但你度过了人生中最无忧无虑的一个夏天。' }),
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
        effect: (s) => ({ leetcode: s.leetcode + 25, health: s.health - 15, age: s.age + 2, message: 'GPA 擦边过，但你闭着眼睛都能写出红黑树的翻转。' }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '疯狂赶 Due，力保全 A (4.0 GPA)',
        effect: (s) => ({ leetcode: s.leetcode + 5, health: s.health - 10, age: s.age + 2, message: '你拿到了 4.0 的完美绩点！但是一去面试发现大厂根本不在乎成绩，只考算法。' }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '去硅谷大厂活动混脸熟要内推',
        effect: (s) => ({ cash: s.cash - 1, charm: s.charm + 10, age: s.age + 2, message: '你加了 50 个大厂学长学姐的 LinkedIn，虽然花了不少钱请客喝咖啡，但拿到了不少内推机会。' }),
        nextEventId: 'us_master_grad',
      }
    ]
  },
  'us_master_grad': {
    id: 'us_master_grad',
    title: '硕士毕业',
    description: '你拿到了硕士学位，OPT 已经激活。现在必须在三个月内找到工作，否则就要被送中了。',
    choices: [

      {
        text: '海投简历，疯狂刷题',
        effect: (s) => ({ health: s.health - 10, leetcode: s.leetcode + 30 }),
        nextEventId: 'job_hunt',
      },
      {
        text: '找ICC挂靠 (保底策略)',
        effect: (s) => ({ cash: s.cash - 1, tc: 6 }),
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
        nextEventId: (s) => s.cash >= 100 ? (s.has_housing ? 'sv_daily_life' : 'choose_housing') : 'job_hunt',
      }
    ]
  },
  'job_hunt': {
    id: 'job_hunt',
    title: '湾区求职季',
    description: '你迎来了惨烈的面试季。不同年份的市场难度天差地别...',
    choices: [
      {
        text: '靠 CMU 极客黑手党校友内推，空降大厂',
        condition: (s) => s.school === 'cmu',
        effect: (s) => ({ health: s.health - 30, tc: 25, cash: s.cash + 10, message: '学长直接把你拉进了核心组，钱多但每天要干到凌晨 2 点。' }),
        nextEventId: (s) => s.has_housing ? 'sv_daily_life' : 'choose_housing',
      },
      {
        text: '跟着 Berkeley 教授去搞 Web3/AI 创业',
        condition: (s) => s.school === 'ucb',
        effect: (s) => ({ cash: s.cash - 5, message: '你加入了教授的局，虽然没拿到大厂包裹，但感觉马上就要改变世界了。' }),
        nextEventId: 'startup_work',
      },
      {
        text: '通过兄弟会内推，加入当地中型养老公司',
        condition: (s) => s.school === 'state',
        effect: (s) => ({ tc: 15, health: s.health + 10, charm: s.charm + 2, job_type: 'big_tech', message: '工作轻松，每天下午 4 点下班去冲浪，但这辈子的 TC 估计也就这样了。' }),
        nextEventId: (s) => s.has_housing ? 'sv_daily_life' : 'choose_housing',
      },

      {
        text: '面试 FLAG 大厂 (Google/Apple 等养老厂)',
        effect: (s) => {
          let req = 50;
          if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30; // 疫情放水期
          return s.leetcode >= req 
            ? { tc: s.year >= 2023 ? 25 : 22, cash: s.cash + 5, health: s.health - 5, job_type: 'big_tech', message: `上岸！${s.year}年大厂要求LeetCode>${req}，你顺利通过。` }
            : { health: s.health - 10, message: `面试被挂了！${s.year}年市场要求LeetCode>${req}。` };
        },
        nextEventId: (s) => {
          let req = 50;
          if (s.year >= 2023) req = 70;
          else if (s.year >= 2020 && s.year <= 2022) req = 30;
          return s.leetcode >= req ? (s.has_housing ? 'sv_daily_life' : 'choose_housing') : 'job_hunt_fail';
        },
      },
      {
        text: '加入 Meta (传说中的卷王之王)',
        condition: (s) => s.leetcode >= 60,
        effect: (s) => ({ tc: 35, health: s.health - 20, cash: s.cash + 10, company: 'meta', job_type: 'big_tech', message: '你成功卷入了 Meta！虽然给的钱多，但是压力山大。' }),
        nextEventId: (s) => s.has_housing ? 'sv_daily_life' : 'choose_housing',
      },
      {
        text: '面试普通 Startup',
        effect: (s) => ({ tc: 12, health: s.health - 2, job_type: 'startup', message: '你加入了一家 Early Stage 的初创公司，虽然工资低，但老板给你画了巨大的大饼。' }),
        nextEventId: (s) => s.has_housing ? 'sv_daily_life' : 'choose_housing',
      },
      {
        text: '挑战顶级量化基金 (Quant)',
        effect: (s) => {
          const pass = Math.random() > 0.8;
          return pass 
            ? { tc: 40, cash: s.cash + 10, health: s.health - 30, job_type: 'quant', message: '奇迹发生！你拿下了华尔街顶级 Quant Fund 的 Offer，起薪 40 万美元！' }
            : { health: s.health - 15, message: '量化面试的数学题太难了，智商被按在地上摩擦...' };
        },
        nextEventId: (s) => s.tc >= 40 ? (s.has_housing ? 'sv_daily_life' : 'choose_housing') : 'job_hunt_fail',
      }
    ]
  },
  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '求职受挫',
    description: '由于迟迟找不到理想工作，你面临着巨大的生存和身份压力...',
    choices: [

      {
        text: '被迫回国',
        effect: (s) => {
          const reason = (s.visa === 'F1 (学生)' || s.visa === '无') ? 'OPT到期未能上岸' : ((s.visa === '绿卡' || s.visa === 'O1 (杰出人才)') ? '积蓄耗尽、心灰意冷' : 'H1B 60天失业期满未能找到新工作');
          return { status: 'game_over', message: reason + '，你最终遗憾登上了回国的航班。' };
        },
        nextEventId: 'end',
      },
      {
        text: '再读一个水硕维持身份 (Day 1 CPT)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== 'O1 (杰出人才)',
        effect: (s) => ({ cash: s.cash - 5, age: s.age + 1 }),
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
        effect: (s) => ({ rent: s.rent + 1, charm: s.charm + 10, health: s.health + 30, has_housing: true, message: '你领养了毛孩子！虽然每年要多花不少钱买猫粮/狗粮和看兽医，但每次下班回家看到它，你的疲惫都一扫而空，而且在相亲软件上放宠物照片让你大受欢迎！' }),
        nextEventId: 'big_tech_work'
      },

      {
        text: '豪华 1b1b (每年 4 万美元): 环境好，心情愉悦',
        effect: (s) => ({ rent: 4, charm: s.charm + 1, health: s.health + 10, has_housing: true, message: '你租下了带泳池的高级公寓，生活质量极高，相亲市场竞争力上升。' }),
        nextEventId: 'big_tech_work'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比高',
        effect: (s) => ({ rent: 2, has_housing: true, message: '你和朋友合租，偶尔会因为抢厕所和洗碗吵架，但省下了不少钱。' }),
        nextEventId: 'big_tech_work'
      },
      {
        text: '挂壁大客厅 (每年 1 万美元): 终极省钱',
        effect: (s) => ({ rent: 1, charm: s.charm - 2, health: s.health - 15, has_housing: true, message: '你睡在客厅，用帘子隔开。每天被室友做饭吵醒，毫无隐私，连相亲都不敢带人回家。' }),
        nextEventId: 'big_tech_work'
      }
    ]
  },
'big_tech_work': {
    id: 'big_tech_work',
    title: '开启打工生涯',
    description: '你正式开启了职场生涯，成为了光荣的湾区码农。接下来要面临第一道坎：H1B 抽签。',
    choices: [
      {
        text: '老老实实祈祷 H1B 中签 (免费)',
        effect: (s) => {
          const winRate = 0.25 + (s.luck / 100) * 0.4; // 幸运值越高越容易中签 (25% - 65%)
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', cash: s.cash, message: '人品爆发，今年H1B中签了！' }
            : { cash: s.cash, health: s.health - 10, message: '今年 H1B 没抽中！只能指望明年...' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b',
      },
      {
        text: '砸钱找最顶级的移民律师帮忙弄 O1 签证 (花费 2 万美元)',
        condition: (s) => s.cash >= 2,
        effect: (s) => {
          const winRate = 0.6 + (s.luck / 100) * 0.35; // O1 成功率 60% - 95%
          const win = Math.random() < winRate;
          return win
            ? { visa: 'H1B (工签)', cash: s.cash - 2, message: '律师非常给力，成功帮你申请到了 O1 杰出人才签证，效果等同于 H1B！' }
            : { cash: s.cash - 2, health: s.health - 15, message: '移民局觉得你水平不够，O1 签证被拒，两万美元打了水漂。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b',
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
    title: 'H1B 焦虑',
    description: 'OPT 还有时间，继续抽签吧...',
    choices: [

      {
        text: '继续抽！',
        effect: (s) => {
          const winRate = 0.15 + (s.luck / 100) * 0.3; // 海底捞概率 15% - 45%
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', cash: s.cash, message: '谢天谢地，海底捞中签了！' }
            : { cash: s.cash, status: 'game_over', message: 'H1B 彻底没抽中，被迫 Relocate 到加拿大，游戏结束。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'end',
      }
    ]
  },
  'sv_daily_life': {
    id: 'sv_daily_life',
    title: '湾区日常 (行动面板)',
    description: '又是新的一年。在等绿卡排期的日子里，你该如何分配今年的精力？',
    choices: [
      {
        text: '🏢 疯狂加班 (消耗 1 精力) - 疯狂表现，争取加薪',
        condition: (s) => s.ap > 0,
        effect: (s) => ({ ap: s.ap - 1, health: s.health - 15, tc: s.tc + 1, message: '你天天在公司熬到半夜吃免费晚饭。Manager 对你的态度变好了，甚至给你微调了底薪。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '💻 闭关刷题 (消耗 1 精力) - 备战跳槽',
        condition: (s) => s.ap > 0,
        effect: (s) => ({ ap: s.ap - 1, health: s.health - 10, leetcode: s.leetcode + 5, message: '你拒绝了所有社交，周末疯狂刷 LeetCode，算法能力精进了。' }),
        nextEventId: 'sv_daily_life',
      },
      {
         text: '🚗 周末跑 Uber / 送外卖赚外快 (消耗 1 精力)',
         condition: (s) => s.ap > 0 && s.cash <= 15,
         effect: (s) => ({ ap: s.ap - 1, cash: s.cash + 2, health: s.health - 20, message: '手头太紧了，你周末开车去送外卖，虽然赚了点辛苦钱，但累得腰酸背痛。' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '🏋️ 医美与私教 (消耗 1 精力, 3 万美元) - 提升魅力和健康',
         condition: (s) => s.ap > 0 && s.cash >= 3,
         effect: (s) => ({ ap: s.ap - 1, cash: s.cash - 3, health: Math.min(100, s.health + 20), charm: Math.min(25, s.charm + 2), message: '做全脸热玛吉，请硅谷最贵的私教。颜值和健康大幅飙升！' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '📱 经营小红书 (消耗 1 精力) - 卷“湾区精英”人设',
         condition: (s) => s.ap > 0,
         effect: (s) => {
            let winRate = 0.2;
            if (s.charm >= 12) winRate = 0.9;
            else if (s.charm >= 7) winRate = 0.6;
            const win = Math.random() < winRate;
            if (win) {
              if (s.charm >= 20 && Math.random() < 0.05) {
                 return { ap: s.ap - 1, cash: s.cash + 80, charm: Math.min(25, s.charm + 5), message: '极小概率的奇迹！你的小红书粉丝突破 100 万！获得了大牌广告代言费！' };
              }
              return { ap: s.ap - 1, cash: s.cash + 5, charm: s.charm + 2, health: s.health - 15, message: '接到了几笔软广赞助，涨了不少粉，但非常疲惫。' };
            } else {
              return { ap: s.ap - 1, cash: s.cash - 3, health: s.health - 20, message: '疯狂买装备拍 OOTD 却没人看，倒贴钱还心累。' };
            }
         },
         nextEventId: 'sv_daily_life',
      },
      {
         text: '🤖 搞 AI 独立开发 (消耗 1 精力, 2万美元) - 需要高强算法',
         condition: (s) => s.ap > 0 && s.cash >= 2 && s.leetcode >= 30,
         effect: (s) => {
            const jackpot = Math.random() < (0.05 + s.luck / 500); // 5% to 25% chance
            if (jackpot) return { ap: s.ap - 1, cash: s.cash + 50, leetcode: s.leetcode + 5, message: '你做出的套壳 AI 产品在 Product Hunt 上登顶了！有资本用 50 万美元收购了你的项目！' };
            return { ap: s.ap - 1, cash: s.cash - 2, leetcode: s.leetcode + 3, message: '你的产品上线后无人问津，几万美元的 API 费用和服务器费打了水漂，但你的技术变强了。' };
         },
         nextEventId: 'sv_daily_life'
      },
      {
         text: '🍸 参加高尔夫/游艇高端局 (消耗 1 精力, 5万美元) - 需要高魅力',
         condition: (s) => s.ap > 0 && s.cash >= 5 && s.charm >= 8,
         effect: (s) => {
            const success = Math.random() > 0.5;
            if (success) return { ap: s.ap - 1, cash: s.cash - 5, tc: s.tc + 5, charm: s.charm + 2, message: '你在游艇派对上认识了顶级风投大佬，对方一高兴直接把你塞进了他们刚投的明星公司，总包大涨！' };
            return { ap: s.ap - 1, cash: s.cash - 5, health: s.health - 10, message: '去派对当了气氛组，钱花了，酒喝多了，什么实质性人脉都没捞到。' };
         },
         nextEventId: 'sv_daily_life'
      },
      {
         text: '🚗 贷款分期购买白色 Tesla Model Y (消耗 1 精力, 4万) - 湾区最标准的民工街车',
         condition: (s) => s.ap > 0 && s.cash >= 4 && s.car !== 'model_y' && s.car !== 'porsche' && s.car !== 'cybertruck',
         effect: (s) => ({ ap: s.ap - 1, cash: s.cash - 4, car: 'model_y', charm: s.charm + 4, message: '你提了一台最标准的白色 Model Y。去 Cupertino 买奶茶在停车场发现身旁停了 6 台一模一样的车，你按半天钥匙开错别人的车门。' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '🏎️ 提一台保时捷 Porsche Macan / Taycan (消耗 1 精力, 12万) - 破防相亲圈',
         condition: (s) => s.ap > 0 && s.cash >= 12 && s.car !== 'porsche',
         effect: (s) => ({ ap: s.ap - 1, cash: s.cash - 12, car: 'porsche', charm: Math.min(25, s.charm + 12), health: s.health + 10, message: '开上保时捷的那一刻，你感觉自己脱离了普通码农的范畴！CMB 约会匹配率与游艇局待遇飙升！' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '📐 提一台赛博皮卡 Tesla Cybertruck (消耗 1 精力, 9万) - 科技硬核装逼',
         condition: (s) => s.ap > 0 && s.cash >= 9 && s.car !== 'cybertruck',
         effect: (s) => ({ ap: s.ap - 1, cash: s.cash - 9, car: 'cybertruck', charm: Math.min(25, s.charm + 8), leetcode: s.leetcode + 5, message: '开着硬核多边形皮卡上 237 公路，所有人都以为你是 Hayes Valley 刚拿到 A 轮融资的硬核 AI Founder！' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '❤️ 去 CMB 约会相亲 (消耗 1 精力)',
         condition: (s) => s.ap > 0 && !s.is_married,
         effect: (s) => ({ ap: s.ap - 1, message: '你去 Santana Row 喝了杯奶茶。' }),
         nextEventId: 'dating_market' 
      },
      {
         text: '🏖️ 宅家躺平打游戏 (消耗 1 精力) - 恢复大量健康',
         condition: (s) => s.ap > 0,
         effect: (s) => ({ ap: s.ap - 1, health: Math.min(100, s.health + 30), message: '整个周末都在家打黑神话：悟空，什么代码都不想写，虽然没进步，但是感觉重新活了过来。' }),
         nextEventId: 'sv_daily_life',
      },
      {
         text: '⏩ 放弃剩余精力，直接进入年底结算',
         condition: (s) => true,
         effect: (s) => ({ ap: 0 }),
         nextEventId: 'sv_year_end_settlement'
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
           const netIncome = (s.tc * 0.6) - s.rent - 4;
           const gcMsg = s.visa === '绿卡' 
             ? '你已持有美国绿卡，工作生活不受约束。' 
             : nextGc >= 5 
               ? '你的绿卡排期终于到了！' 
               : `距离拿到绿卡还差 ${Math.max(0, 5 - nextGc)} 年。`;
           return { 
              ap: s.max_ap !== undefined ? s.max_ap : 3, 
              age: s.age + 1, 
              gc_progress: nextGc, 
              cash: s.cash + netIncome, 
              message: `扣除房租和每年 4 万的生活费后，你今年的税后结余是 ${Math.max(0, netIncome).toFixed(1)} 万美元。${gcMsg}` 
           };
        },
        nextEventId: (s) => {
          if (s.status === 'win') return 'end';
          if (s.gc_progress >= 5 && s.visa !== '绿卡' && s.visa !== '无') return 'post_green_card';
          
          const rand = Math.random();
          
          // 5% chance of Macro Economic Crisis
          if (rand < 0.05) return 'stock_crash';
          
          // 35% chance of WORK related event based on job type
          if (rand >= 0.05 && rand < 0.4) {
             if (s.job_type === 'startup') return 'startup_crisis';
             if (s.job_type === 'ai_research') return 'ai_research_crisis';
             if (s.job_type === 'quant') return 'quant_stress';
             const bigTechRand = Math.random();
             if (bigTechRand < 0.33) return 'perf_review';
             if (bigTechRand < 0.66) return 'layoff_rumor';
             return 'friday_pip'; // big_tech default
          }
          
          // 60% chance of LIFE event
          const lifeRand = Math.random();
          if (lifeRand < 0.14) return s.is_married ? 'sv_daily_life' : 'dating_market';
          if (lifeRand < 0.24) return 'car_broken';
          if (lifeRand < 0.36) return (s.visa === '绿卡' || s.visa === 'O1 (杰出人才)') ? 'sv_daily_life' : 'visa_check';
          if (lifeRand < 0.48) return 'dental_emergency';
          if (lifeRand < 0.60) return 'crypto_scam';
          if (lifeRand < 0.08) return 'blind_team_tea';
          if (lifeRand < 0.16) return 'zoom_camera_off_leetcode';
          if (lifeRand < 0.24) return 'boba_inflation';
          if (lifeRand < 0.32) return 'rsu_vesting_crash';
          if (lifeRand < 0.40) return 'h1b_rfe_vs_parent_nag';
          if (lifeRand < 0.50) return 'xhs_boba'; // <--- Connected missing xhs_boba event!
          if (lifeRand < 0.80) return 'ai_wrapper_startup';
          if (lifeRand < 0.90) return 'biohacking_party';
          return 'burning_man_invite';
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
        condition: (s) => s.tc > 0
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
      }
    ]
  },
  'biohacking_party': {
    id: 'biohacking_party',
    title: 'Atherton 的长寿教徒',
    description: '在 Atherton 的一个豪宅派对上，主人戴着三个智能指环，宣称自己把生物钟逆转到了 18 岁。他递给你一杯绿色的不明液体，说是他独家研发的“细胞级抗衰老矩阵精华”，只要 $500 一杯。',
    choices: [
      {
        text: '花 50 万美元报名“长寿换血抗衰老”年度会员 (永久 +1 精力上限)',
        effect: (s) => ({ 
          cash: s.cash - 50, 
          max_ap: (s.max_ap || 3) + 1,
          health: 100,
          message: '你花了 50 万美元。每个月都会有私人医生上门给你注射定制干细胞。你的身体仿佛回到了 18 岁，每年能做更多的事情了！'
        }),
        nextEventId: 'sv_daily_life',
        condition: (s) => s.cash >= 50
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
    title: '年底 Perf Review',
    description: '又到了公司一年一度的绩效考核时间，大家都开始疯狂抢 Impact。',
    choices: [

      {
        text: '卷！周末也加班写文档！',
        effect: (s) => {
          const win = Math.random() > 0.7; // 30% 海底捞
          return win 
            ? { health: s.health - 20, tc: s.tc + 5, cash: s.cash, message: '卷赢了！你拿到了 Exceeds Expectations，涨薪 5 万美元！' }
            : { health: s.health - 20, cash: s.cash, message: '你辛辛苦苦写的文档被 Manager 拿去抢了功劳，还是个 Meets。白卷了。' };
        },
        nextEventId: (s) => (s.tc >= 50 && s.job_type === 'big_tech') ? 'meta_tlm' : 'sv_daily_life',
      },
      {
        text: '准点下班，躺平拿 Meets',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
'dating_market': {
    id: 'dating_market',
    title: '湾区婚恋市场 (CMB)',
    description: '家里疯狂催婚，你下载了 Coffee Meets Bagel (CMB) 并充值了高级会员，开始在湾区相亲市场上碰运气。',
    choices: [
      {
        text: '周末一天排满 3 个 Coffee Date (Santana Row 喝奶茶)',
        effect: (s) => s.charm >= 7 
          ? { cash: s.cash + Math.min(25, Math.floor(s.tc * 0.4)), health: s.health + 20, is_married: true, imageUrl: 'images/boba_date.jpg', message: '因为你主页挂了滑雪和宠物照片，成功吸引了一位大厂双职工！两人一拍即合，组成双职工核心家庭，资产直接翻倍！' }
          : { cash: s.cash - 0.2, health: s.health - 15, imageUrl: 'images/boba_date.jpg', message: '连喝了三杯 Boba，对方一听你还没抽到 H1B 且没买房，默默地在吃完饭后选择了 AA。你不仅花了钱还受到了真实伤害。' },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '算了吧，一个人挺好 (省钱省心)',
        effect: (s) => ({ health: s.health + 5, cash: s.cash + 0.5, message: '你卸载了交友软件，省下了周末喝奶茶和请客吃饭的钱，宅在家里打游戏，心情出奇地平静。' }),
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
  'post_green_card': {
    id: 'post_green_card',
    title: '绿卡到手：硅谷新篇章',
    description: '身份的枷锁解除后，你发现硅谷的烦恼并没有结束。现在的你面临着人生新的十字路口。',
    choices: [

      {
        text: '砸 300 万现金全款买下 Atherton 顶级学区豪宅！(消耗 300 万)',
        condition: (s) => s.cash >= 300,
        effect: (s) => ({ visa: '绿卡', cash: s.cash - 300, has_housing: true, charm: Math.min(25, s.charm + 15), health: 100, message: '你买下了传说中硅谷大佬们扎堆的 Atherton 豪宅！现在你周末可以在自己的大别野里开 Pool Party，享受真正的人生赢家生活！' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '加入抢房大战 (正常买房)',
        effect: (s) => ({ age: s.age + 1, visa: '绿卡', cash: s.cash + (s.tc * 0.6) - s.rent - 4 }),
        nextEventId: 'buy_house',
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
        effect: (s) => ({ age: s.age + 1, visa: '绿卡', cash: s.cash + (s.tc * 0.6) - s.rent - 4 }),
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
    title: '宇宙中心抢房大战',
    description: '你看中了一套 Sunnyvale 的老破小“学区房”，标价 $200w。Open House 现场挤满了带着支票簿的印度和中国码农，空气中弥漫着疯狂加价的硝烟。',
    choices: [

      {
        text: 'All in 现金，加价 $50w 硬抢！(需现金 >= 60w)',
        condition: (s) => s.cash >= 60,
        effect: (s) => ({ cash: s.cash - 60, rent: 1, has_housing: true, health: s.health + 10, imageUrl: 'images/house.jpg', message: '恭喜！你成功抢到了 Sunnyvale 的房子！每年固定房租大幅降低为微薄的持有成本。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '向国内父母求助（掏空六个钱包）',
        condition: (s) => s.cash < 80,
        effect: (s) => ({ cash: s.cash + 80, health: s.health - 20, message: '父母卖掉了老家的房子给你凑齐了首付，你背上了沉重的心理包袱和巨额房贷。' }),
        nextEventId: 'house_slave',
      },
      {
        text: '太卷了，我去东湾买新房',
        effect: (s) => ({ visa: '绿卡', cash: s.cash - 40, health: s.health + 10, message: '你搬到了偏远但宽敞的新房，每天通勤 2 小时，在 880 上堵到怀疑人生。' }),
        nextEventId: 'sv_daily_life',
      }
    ]
  },
  'house_slave': {
    id: 'house_slave',
    title: '沉重的房贷',
    description: '买房后，每个月的房贷压得你喘不过气来。你不敢生病，更不敢辞职。',
    choices: [
      {
        text: '小心翼翼地继续打工还贷',
        effect: (s) => ({ age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent - 4, health: s.health - 5 }),
        nextEventId: (s) => s.cash >= s.win_threshold ? 'end' : 'house_slave',
      },
      {
        text: '偷偷把次卧租给留学生赚点外快',
        effect: (s) => {
          const badTenant = Math.random() > 0.7;
          return badTenant
            ? { age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent - 4, health: s.health - 15, message: '留学生是个极品，不仅弄坏了你的烤箱，还带人开派对吵得你彻夜难眠。' }
            : { age: s.age + 1, cash: s.cash + 1.5 + (s.tc * 0.6) - s.rent - 4, message: '留学生很安静，按时交租，有效缓解了你的房贷压力。' };
        },
        nextEventId: 'house_slave',
      },
      {
        text: '断供卖房！回归租房生活的自由',
        condition: (s) => s.cash < 50,
        effect: (s) => ({ cash: s.cash + 35, has_housing: false, rent: 4, health: s.health + 10, message: '你最终无力支付房贷被迫卖房。虽砸了首付，但你卸下了沉重包袱，重新拿回流动资金。' }),
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
        effect: (s) => ({ tc: Math.max(20, s.tc - 20), company: 'google', health: s.health + 40, message: '你受够了 Meta 的高压，降薪跳槽去了以 WLB 著称的养老大厂。虽然包裹大幅缩水，但终于有了生活。' }),
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
    title: '不幸被裁',
    description: '你还是被裁了，H1B 只有 60 天 grace period。',
    choices: [

      {
        text: '利用高超的刷题技术迅速上岸',
        effect: (s) => s.leetcode > 60 
          ? { tc: 20, cash: s.cash - 2, health: s.health - 20, message: '有惊无险，火速入职了新公司保住身份。' }
          : { status: 'game_over', message: '没在60天内找到工作，遣返回国。' },
        nextEventId: (s) => s.leetcode > 60 ? 'sv_daily_life' : 'end',
      }
    ]
  },
  'cn_work': {
    id: 'cn_work',
    title: '国内大厂',
    description: '你在国内大厂疯狂 996，虽然赚了些钱，但感觉身体被掏空。',
    choices: [

      {
        text: '拼命卷！打工攒钱 (攒 5 万美元)',
        effect: (s) => ({ health: s.health - 25, cash: s.cash + 5, age: s.age + 1, message: '你扛着 996 的压力干了一年，拿命换来了 5 万存款。' }),
        nextEventId: (s) => s.health <= 25 ? 'cn_burnout' : 'cn_work',
      },
      {
        text: '拿着钱申请美国水硕 (逃离内卷)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', age: s.age }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '跳槽加入一家叫“字节跳动”的初创公司',
        condition: (s) => s.year <= 2018,
        effect: (s) => {
          const win = Math.random() < 0.25;
          return win 
            ? { cash: s.cash + 350, health: s.health - 25, message: '你赶上了移动互联网最肥美的一波红利！公司上市期权兑现，获得了巨额第一桶金！' }
            : { health: s.health - 40, message: '每天大小周熬到凌晨两点，公司上市受阻，身体反而落下一身病。' };
        },
        nextEventId: 'cn_burnout'
      }
    ]
  },
  'cn_burnout': {
    id: 'cn_burnout',
    title: '职场危机：ICU 警告',
    description: '你的身体因为长期 996 亮起了红灯，拿着体检报告，你感到前所未有的恐惧。',
    choices: [
      {
        text: '花钱治病保命 (花费 5 万美元)',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({ cash: s.cash - 5, health: s.health + 40, message: '在医院躺了半个月，捡回一条命，但存款缩水了。' }),
        nextEventId: 'cn_work'
      },
      {
        text: '拿着钱申请美国水硕 (逃离内卷)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', age: s.age, health: s.health + 20, message: '趁着还能走动，你赶紧跑路去了美国。' }),
        nextEventId: 'us_master_year1'
      },
      {
        text: '放弃治疗，遗憾退场',
        effect: (s) => ({ status: 'game_over', message: '你错过了最佳治疗时间，身体彻底垮掉，人生提前画上了句号。' }),
        nextEventId: 'end'
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
        effect: (s) => ({ leetcode: s.leetcode + 40, health: s.health - 20, age: s.age + 2 }),
        nextEventId: 'job_hunt',
      }
    ]
  },
  'startup_work': {
    id: 'startup_work',
    title: '初创公司风云',
    description: '你进入了/创办了一家 Startup，每天一个人干三个人的活。现在的风向变了，关于公司的方向：',
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
        nextEventId: (s) => (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型套壳',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: s.cash - 10, health: s.health - 20, message: `现在才 ${s.year} 年，你的 AI 理念太超前了！投资人觉得你不切实际，拒绝投资，公司倒闭。` };
          }
          const win = Math.random() < 0.18;
          return win 
            ? { cash: s.cash + 300, visa: '绿卡', message: '踩中 AI 风口！拿到巨额融资，你的期权大幅升值，顺便获得了 EB-1 杰出人才绿卡！' }
            : { cash: Math.max(0, s.cash - 10), health: s.health - 25, message: '转型太慢，被巨头连夜更新的接口直接背刺干死了...' };
        },
        nextEventId: (s) => (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
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
        nextEventId: (s) => (s.message.includes('夏威夷') ? 'phd_conference' : 'phd_life')
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
        text: '申请 OpenAI / Anthropic 核心研究员',
        effect: (s) => {
          const win = Math.random() > 0.4 || s.leetcode >= 80;
          return win
            ? { tc: 80, cash: s.cash + 20, health: s.health - 20, visa: 'O1 (杰出人才)', job_type: 'ai_research', message: '顶级 AI 公司直接用 $80w 的百万包裹和 O1 签证把你砸晕，你正式成为了硅谷新贵！' }
            : { health: s.health - 20, message: 'OpenAI 的面试太难了，不仅考手写 CUDA 还考偏门算法，你没能通过，只能重新找工作。' };
        },
        nextEventId: (s) => s.tc >= 80 ? (s.has_housing ? 'sv_daily_life' : 'choose_housing') : 'job_hunt_fail'
      },
      {
        text: '去大厂当 Applied Scientist (应用科学家)',
        effect: (s) => ({ tc: 45, cash: s.cash + 15, visa: 'O1 (杰出人才)', job_type: 'ai_research', message: '大厂的科学家岗位待遇丰厚，不用写 CRUD，直接解决核心算法问题，生活相对安稳。' }),
        nextEventId: (s) => s.has_housing ? 'sv_daily_life' : 'choose_housing'
      }
    ]
  },


  'startup_crisis': {
    id: 'startup_crisis',
    title: '初创危机',
    description: '你的 Startup 最近融资不太顺利，账上的钱只够发 3 个月工资了。',
    choices: [
      {
        text: '相信老板的 PPT，自愿降薪换取更多期权',
        effect: (s) => {
          const win = Math.random() < 0.12;
          return win 
            ? { cash: s.cash + 180, message: '奇迹发生！公司靠新一轮概念起死回生，最终被大厂并购，你的期权兑现！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s) => 'job_hunt',
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
          const win = Math.random() > 0.5;
          return win 
            ? { tc: s.tc + 10, cash: s.cash, charm: s.charm + 3, health: s.health - 20, message: '你的 Paper 被 NeurIPS 接收了！并且在推特上引起了轰动，公司立刻给你发了 Retention Bonus！' }
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
        text: '顶着高压，手动干预策略并加大杠杆！',
        effect: (s) => {
          const win = Math.random() > 0.6;
          return win 
            ? { cash: s.cash + 100, health: s.health - 25, message: '你赌对了！这波 V 型反转让你帮公司赚了上千万，年底直接发了巨额 Bonus！' }
            : { cash: s.cash - 20, health: s.health - 30, message: '你的手动干预导致策略彻底崩溃，亏损加剧。年终奖被砍没了，还被老板痛骂一顿。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '相信数学，不干预策略',
        effect: (s) => ({ health: s.health - 10, cash: s.cash, message: '虽然每天看着回撤心惊肉跳，但你还是忍住了干预的冲动。最终策略慢慢回本了。' }),
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
        effect: (s) => ({ cash: s.cash - 0.5, health: s.health + 10, message: '拔了两颗智齿，虽然有保险，但自付额还是高达 $5000，美国医疗名不虚传。' }),
        nextEventId: 'sv_daily_life'
      },
      {
        text: '买机票回国拔牙！',
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
            ? { charm: s.charm + 10, health: s.health + 10, cash: s.cash - 0.1, message: '排队 2 小时买到了。你随手拍的照片加了滤镜发到小红书，居然成了爆款！涨粉 1000 人，极大地满足了虚荣心。' }
            : { health: s.health - 10, cash: s.cash - 0.1, message: '在烈日下排队 2 小时，喝了一口发现又贵又难喝，纯纯智商税。' };
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
  'end': {
    id: 'end',
    title: '游戏结束',
    description: '',
    choices: [
]
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(generateInitialState);
  const [currentEventId, setCurrentEventId] = useState<string>('choose_trait');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentEventId]);

  const currentEvent = events[currentEventId];

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new state
    const newState = { ...gameState, message: '', laid_off: false, imageUrl: undefined }; // Clear old message, image and generic flags
    const effectResult = choice.effect(gameState);
    Object.assign(newState, effectResult); // Apply new effects
    
    // Auto increment year based on age difference, ONLY if year wasn't explicitly set
    if (effectResult.age !== undefined && effectResult.age > gameState.age) {
      if (effectResult.year === undefined) {
        newState.year = gameState.year + (effectResult.age - gameState.age);
      }
    }

    // Clamp stats
    newState.health = Math.max(0, Math.min(100, newState.health));
    newState.leetcode = Math.max(0, Math.min(100, newState.leetcode));
    newState.charm = Math.max(0, Math.min(25, newState.charm));

    // Check if health drops <= 0
    if (newState.health <= 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      if (!effectResult.message) newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
    }

    // Check if bankrupt
    if (newState.cash < 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      if (!effectResult.message) newState.message = '你破产了，无法支付账单，游戏结束！';
    }

    // Check FIRE win
    if (newState.cash >= newState.win_threshold && newState.status === 'playing') {
      newState.status = 'win';
      newState.message = `你的资产突破了 ${newState.win_threshold} 万美元！你正式达成了个人的 FIRE 目标（财务自由，提前退休）。你再也不需要看任何人的脸色，可以去做自己真正想做的事情了！`;
    }

    setGameState(newState);

    // 2. Transition to next event
    if (newState.status !== 'playing') {
      setCurrentEventId('end');
    } else {
      let nextId = typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;
      if (nextId === 'sv_daily_life' && newState.ap <= 0) {
        nextId = 'sv_year_end_settlement';
      }
      setCurrentEventId(nextId);
    }
  };

  const resetGame = () => {
    localStorage.removeItem('sv_life_initial_seed');
    setGameState(generateInitialState());
    setCurrentEventId('choose_trait');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Left Column: Sticky Status Panel */}
          <div className="lg:col-span-5 order-first lg:order-none lg:sticky lg:top-12 flex flex-col mb-6 lg:mb-0">
            {/* Header / Title */}
            <div className="mb-10">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-zinc-100 mb-3">
                硅谷模拟人生
              </h1>
              <p className="text-zinc-400 text-lg">
                A survival guide to the Bay Area.
              </p>
            </div>

            {/* Bento Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Cash & TC */}
              <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-1">现金资产 (Cash)</div>
                  <div className="text-4xl font-bold tracking-tight text-emerald-400">${gameState.cash.toFixed(1)}w</div>
                </div>
                <div className="text-right relative z-10">
                  <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-1">当前总包 (TC)</div>
                  <div className="text-2xl font-semibold tracking-tight text-zinc-200">${gameState.tc.toFixed(1)}w</div>
                </div>
              </div>
              
              {/* Action Points (AP) - Only shown if AP has been unlocked by entering the work loop */}
              {gameState.ap !== undefined && (currentEventId === 'sv_daily_life' || currentEventId === 'sv_year_end_settlement' || currentEventId === 'dating_market' || currentEventId === 'biohacking_party' || currentEventId === 'crypto_scam' || currentEventId === 'ai_wrapper_startup' || currentEventId === 'burning_man_invite' || currentEventId === 'stock_crash' || currentEventId === 'car_broken' || currentEventId === 'dental_emergency' || currentEventId === 'post_green_card' || currentEventId === 'layoff_rumor' || currentEventId === 'perf_review' || currentEventId === 'friday_pip' || currentEventId === 'visa_check') && (
              <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-6">
                <div className="flex-1">
                  <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-2">本年剩余精力 (AP)</div>
                  <div className="flex gap-2">
                    {Array.from({ length: gameState.max_ap || 3 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-3 flex-1 rounded-full transition-all duration-300 ${i < gameState.ap ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-zinc-800'}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-2xl font-bold tracking-tight text-indigo-400 whitespace-nowrap">
                  {gameState.ap} / {gameState.max_ap || 3}
                </div>
              </div>
              )}

              {/* Health */}
              <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-2">健康状态</div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold tracking-tight text-zinc-100">{Math.max(0, gameState.health)}</span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${gameState.health > 50 ? 'bg-emerald-500' : gameState.health > 20 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} 
                    style={{ width: `${Math.max(0, gameState.health)}%` }}></div>
                </div>
              </div>

              {/* LeetCode & Year */}
              <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between">
                <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-1">LeetCode</div>
                <div className="text-3xl font-bold tracking-tight text-zinc-100">{gameState.leetcode}</div>
              </div>
              
              {/* Timeline */}
              <div className="col-span-2 md:col-span-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-1">当前年份</div>
                  <div className="text-xl font-medium text-zinc-300">{gameState.year}</div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em] mb-1">年龄</div>
                  <div className="text-xl font-medium text-zinc-300">{gameState.age} 岁</div>
                </div>
              </div>

              {/* Car Status */}
              <div className="col-span-2 md:col-span-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center">
                <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em]">当前座驾</div>
                <div className="text-sm font-semibold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-full">
                  {gameState.car === 'porsche' ? '🏎️ 保时捷 Porsche' : gameState.car === 'cybertruck' ? '📐 赛博皮卡' : gameState.car === 'model_y' ? '🚗 特斯拉 Model Y' : '🚶 徒步/11路'}
                </div>
              </div>

              {/* Visa */}
              <div className="col-span-2 md:col-span-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center">
                <div className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.1em]">签证状态</div>
                <div className="text-sm font-medium text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full">{gameState.visa}</div>
              </div>
            </div>
          </div>

          {/* Right Column: Event Narrative */}
          <div className="lg:col-span-7 flex flex-col justify-center min-h-[60vh] lg:min-h-[80vh] lg:pl-8 xl:pl-16">
            
            {/* Message Banner */}
            {gameState.message && (
              <div aria-live="polite" role="status" className="border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 px-5 py-4 rounded-r-lg mb-8 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {gameState.message}
              </div>
            )}

            {/* Event Card */}
            <div key={currentEventId} className="bg-zinc-900/40 rounded-3xl p-8 md:p-12 border border-zinc-800 backdrop-blur-md transition-all duration-300 shadow-2xl animate-in fade-in duration-500 slide-in-from-bottom-2">
              {gameState.status === 'playing' && currentEvent ? (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-50 mb-6">{currentEvent.title}</h2>
                  
                  {gameState.imageUrl && (
                    <img 
                      src={`${import.meta.env.BASE_URL}${gameState.imageUrl}`} 
                      alt="Event Scene" 
                      className="w-full h-48 md:h-72 object-cover rounded-2xl mb-8 shadow-2xl border border-zinc-700/50 transition-all duration-500 ease-out"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}

                  <p className="text-zinc-400 mb-10 text-lg md:text-xl leading-relaxed">{currentEvent.description}</p>
                  
                  <div className="flex flex-col space-y-4">
                    {currentEvent.choices.map((choice, idx) => {
                      const isAvailable = !choice.condition || choice.condition(gameState);
                      
                      // Precise badge extraction from text
                      const costMatch = choice.text.match(/\((消耗|花费|每年|\$|成本).*?\)/);
                      const reqMatch = choice.text.match(/ - (.*)/) || choice.text.match(/\((需要|需|算法|高魅力|现金).*?\)/);
                      const mainText = choice.text
                        .replace(/\(.*?\)/g, '')
                        .replace(/ - .*/, '')
                        .replace(/[:：]\s*.*$/, '')
                        .trim();
                      
                      return (
                      <button
                        key={idx}
                        onClick={() => isAvailable && handleChoice(choice)}
                        disabled={!isAvailable}
                        className={`group w-full text-left px-6 py-5 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isAvailable 
                            ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 active:scale-[0.98]' 
                            : 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className={`font-medium text-lg transition-colors ${isAvailable ? 'text-zinc-300 group-hover:text-emerald-400' : 'text-zinc-600'}`}>
                          {mainText}
                        </span>
                        
                        <div className="flex flex-wrap gap-2 items-center">
                          {costMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${isAvailable ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                               {costMatch[1]}
                             </span>
                          )}
                          {reqMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${isAvailable ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                               {reqMatch[1]}
                             </span>
                          )}
                          {!isAvailable && (
                            <span className="text-xs px-2.5 py-1 rounded-md font-bold tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
                              条件未满足
                            </span>
                          )}
                        </div>
                      </button>
                    )})}
                  </div>
                </>
               ) : (
                <div className="py-8 animate-in fade-in duration-500">
                  <div className="text-center mb-8">
                    <span className={`text-xs font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border ${gameState.status === 'win' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {gameState.status === 'win' ? '🎉 FIRE 财务自由通关' : '💀 硅谷生存中断'}
                    </span>
                    <h2 className={`text-4xl md:text-5xl font-extrabold tracking-tight mt-4 mb-3 ${gameState.status === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.status === 'win' ? '人生巅峰：财务自由！' : '硅谷生存结语'}
                    </h2>
                    <p className="text-zinc-300 text-lg max-w-xl mx-auto leading-relaxed">
                      {gameState.message}
                    </p>
                  </div>

                  {/* Bento Medals & Stats Card */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-2xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center justify-between">
                      <span>🏆 你的硅谷生涯获得勋章 (Persona Medals)</span>
                      <span>{gameState.year} 年 | {gameState.age} 岁</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                      {gameState.leetcode >= 60 && (
                        <div className="bg-zinc-900/90 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">💻</span>
                          <div>
                            <div className="font-bold text-amber-300 text-sm">【做题神仙】</div>
                            <div className="text-xs text-zinc-400">LeetCode 算法真经通关，随时手撕 Hard 题</div>
                          </div>
                        </div>
                      )}
                      {gameState.charm >= 18 && (
                        <div className="bg-zinc-900/90 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">💃</span>
                          <div>
                            <div className="font-bold text-rose-300 text-sm">【南湾顶流名流】</div>
                            <div className="text-xs text-zinc-400">魅力值爆表，Santana Row 相亲收割机</div>
                          </div>
                        </div>
                      )}
                      {gameState.cash >= 300 && (
                        <div className="bg-zinc-900/90 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">💰</span>
                          <div>
                            <div className="font-bold text-emerald-300 text-sm">【Atherton 征服者】</div>
                            <div className="text-xs text-zinc-400">积攒重金，成功跨越硅谷阶级门槛</div>
                          </div>
                        </div>
                      )}
                      {gameState.car === 'cybertruck' && (
                        <div className="bg-zinc-900/90 border border-cyan-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">📐</span>
                          <div>
                            <div className="font-bold text-cyan-300 text-sm">【赛博朋克硬核族】</div>
                            <div className="text-xs text-zinc-400">驾驶多边形皮卡征服 237 号公路</div>
                          </div>
                        </div>
                      )}
                      {gameState.car === 'porsche' && (
                        <div className="bg-zinc-900/90 border border-purple-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">🏎️</span>
                          <div>
                            <div className="font-bold text-purple-300 text-sm">【脱离民工车鄙视链】</div>
                            <div className="text-xs text-zinc-400">告别街车 Model Y，开上保时捷震撼全场</div>
                          </div>
                        </div>
                      )}
                      {gameState.visa === '绿卡' && (
                        <div className="bg-zinc-900/90 border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">🇺🇸</span>
                          <div>
                            <div className="font-bold text-blue-300 text-sm">【上岸自由身】</div>
                            <div className="text-xs text-zinc-400">彻底甩开 USCIS 抽签与 H1B 签证枷锁</div>
                          </div>
                        </div>
                      )}
                      {gameState.status === 'game_over' && gameState.health <= 0 && (
                        <div className="bg-zinc-900/90 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">💀</span>
                          <div>
                            <div className="font-bold text-red-300 text-sm">【荣誉 Burnout 社畜】</div>
                            <div className="text-xs text-zinc-400">牺牲自我健康，照亮公司季度 OKR 交付</div>
                          </div>
                        </div>
                      )}
                      {gameState.status === 'game_over' && gameState.cash <= 0 && (
                        <div className="bg-zinc-900/90 border border-orange-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="text-2xl">💸</span>
                          <div>
                            <div className="font-bold text-orange-300 text-sm">【湾区月光大慈善家】</div>
                            <div className="text-xs text-zinc-400">把高额总包全额上交给了房东与 $13 奶茶</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats Summary Table */}
                    <div className="grid grid-cols-4 gap-2 bg-zinc-900/60 p-4 rounded-2xl text-center text-xs">
                      <div>
                        <div className="text-zinc-500 mb-1">最终现金</div>
                        <div className="font-bold text-emerald-400 text-base">${gameState.cash.toFixed(1)}w</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">峰值总包</div>
                        <div className="font-bold text-zinc-200 text-base">${gameState.tc}w</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">LeetCode</div>
                        <div className="font-bold text-zinc-200 text-base">{gameState.leetcode} 题</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">魅力指数</div>
                        <div className="font-bold text-rose-300 text-base">{gameState.charm} pts</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => {
                        const summaryText = `【硅谷模拟人生】我的生涯结语：\n${gameState.status === 'win' ? '🎉 成功实现 FIRE 财务自由通关！' : '💀 遗憾挂彩中断生存。'}\n最终资产: $${gameState.cash.toFixed(1)}万 | 年龄: ${gameState.age}岁 | 力扣: ${gameState.leetcode}题\n结语: ${gameState.message}\n来挑战你的硅谷人生！`;
                        navigator.clipboard.writeText(summaryText);
                        alert('已复制你的硅谷人生小红书/朋友圈分享文案！');
                      }}
                      className="px-8 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-base transition-all active:scale-[0.98]"
                    >
                      📋 复制我的战绩（发小红书/朋友圈）
                    </button>
                    <button
                      onClick={resetGame}
                      className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                    >
                      🔄 再次重开人生
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
