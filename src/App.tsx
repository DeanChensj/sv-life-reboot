import { useState, useEffect } from 'react';

// Types
type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | '绿卡';

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
  laid_off: boolean;
  status: 'playing' | 'game_over' | 'win';
  message: string;
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
const generateInitialState = (): GameState => {
  const cash = Math.floor(Math.random() * 80) + 10; // 10 到 90 万美元不等
  const charm = Math.floor(Math.random() * 10) + 1; // 颜值 1-10
  
  let bgMessage = '';
  if (cash > 60) bgMessage += '你出生在一个富裕的家庭，启动资金充足！';
  else if (cash < 20) bgMessage += '你出生在一个普通家庭，预算非常吃紧。';
  else bgMessage += '你出生在一个小康家庭。';

  if (charm >= 9) bgMessage += ' 顺便一提，你从小就长得像大明星，走到哪里都是焦点。';
  else if (charm <= 3) bgMessage += ' 长相平平无奇，是个实在人。';

  return {
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
    laid_off: false,
    status: 'playing',
    message: bgMessage,
  };
};

// Events Engine
const events: Record<string, GameEvent> = {
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
        effect: (s) => ({ cash: s.cash - 30, visa: 'F1 (学生)', has_us_degree: true, school: 'cmu', age: s.age + 4, leetcode: s.leetcode + 40, health: s.health - 20, message: '你在匹兹堡经过四年的魔鬼训练，你的编程能力冠绝全场，但因为长期熬夜，健康大幅下降。' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: 'UC Berkeley 本科 (四年总开销 25 万美元)',
        condition: (s) => s.cash >= 25,
        effect: (s) => ({ cash: s.cash - 25, visa: 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age + 4, leetcode: s.leetcode + 25, health: s.health - 10, message: '每天在 Telegraph 街防抢劫的同时学 EECS，练就了强大的抗压心理素质。' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '美国普通公立大学 (四年总开销 15 万美元)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', has_us_degree: true, school: 'state', age: s.age + 4, charm: s.charm + 2, leetcode: s.leetcode + 5, message: '你度过了愉快的四年，参加了各种派对，享受了多元文化，但代码没写几行。' }),
        nextEventId: 'us_undergrad_grad',
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
        text: '申请北美顶尖 PhD (做 Research)',
        effect: (s) => ({ cash: s.cash + 2, age: s.age + 1 }),
        nextEventId: 'phd_life',
      },

      {
        text: '直接找工作 (开始受苦)',
        effect: (s) => s.year === 2020 
          ? { message: '疫情爆发！各大公司全面冻结招聘，应届生根本找不到工作！你只能被迫继续读书。', health: s.health - 10 }
          : { visa: 'OPT (实习)', leetcode: s.leetcode + 10, message: '你开始了漫漫求职路...' },
        nextEventId: (s) => s.year === 2020 ? 'us_undergrad_grad' : 'job_hunt',
      },
      {
        text: '申请大U硕士 (刷题进厂预备役 / 避避风头)',
        effect: (s) => ({ cash: s.cash - 10, age: s.age + 2, leetcode: s.leetcode + 10, message: '你决定去读个硕士提升一下学历。' }),
        nextEventId: 'us_master_grad',
      }
    ]
  },
  'cn_undergrad_grad': {
    id: 'cn_undergrad_grad',
    title: '陆本毕业',
    description: '四年过去了，你在国内大学打下了坚实的代码基础。接下来去哪里？',
    choices: [
      {
        text: '全奖直博美国 (北美学术民工)',
        effect: (s) => ({ cash: s.cash + 2, visa: 'F1 (学生)', age: s.age + 1 }),
        nextEventId: 'phd_life',
      },

      {
        text: '申请美国水硕 (为了留在湾区！)',
        effect: (s) => ({ cash: s.cash - 10, visa: 'F1 (学生)', age: s.age + 2 }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '在国内大厂卷 (提前体验福报)',
        effect: (s) => ({ cash: s.cash + 10, health: s.health - 20, tc: 5, age: s.age + 3 }),
        nextEventId: 'cn_work',
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
          const win = Math.random() > 0.9; // Only 10% chance to pick the right one
          return win 
            ? { tc: 15, health: s.health - 20, cash: s.cash + 500, visa: 'O1 (杰出人才)', status: 'win', message: '天选之子！你居然盲狙到了下一个 Anthropic！公司估值暴涨，你手里的期权直接变现，原地财富自由起飞！' }
            : { tc: 10, health: s.health - 30, message: '公司烧光了投资人的钱，不到半年就倒闭了。期权变成了废纸，你只能连夜更新简历。' };
        },
        nextEventId: (s) => {
          // If we want to evaluate the same win/loss logic for routing without duplicating Math.random, 
          // we should ideally compute it once. But since effect runs before nextEventId in our engine,
          // we can check if they won by checking if status === 'win' or cash > 400.
          return s.status === 'win' ? 'end' : 'job_hunt';
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
        text: '靠 CMU 极客黑手党校友内推，空降大厂',
        condition: (s) => s.school === 'cmu',
        effect: (s) => ({ health: s.health - 30, tc: 25, cash: s.cash + 10, message: '学长直接把你拉进了核心组，钱多但每天要干到凌晨 2 点。' }),
        nextEventId: 'choose_housing',
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
        effect: (s) => ({ tc: 15, health: s.health + 10, charm: s.charm + 2, message: '工作轻松，每天下午 4 点下班去冲浪，但这辈子的 TC 估计也就这样了。' }),
        nextEventId: 'choose_housing',
      },,

      {
        text: '面试 FLAG 大厂 (Google/Apple 等养老厂)',
        effect: (s) => {
          let req = 50;
          if (s.year >= 2023) req = 80;
          else if (s.year >= 2020 && s.year <= 2022) req = 30; // 疫情放水期
          return s.leetcode >= req 
            ? { tc: s.year >= 2023 ? 20 : 18, cash: s.cash + 5, health: s.health - 10, message: `上岸！${s.year}年大厂要求LeetCode>${req}，你顺利通过。` } 
            : { health: s.health - 20, message: `面试被挂了！${s.year}年市场要求LeetCode>${req}。` };
        },
        nextEventId: (s) => {
          let req = 50;
          if (s.year >= 2023) req = 80;
          else if (s.year >= 2020 && s.year <= 2022) req = 30;
          return s.leetcode >= req ? 'choose_housing' : 'job_hunt_fail';
        },
      },
      {
        text: '加入 Meta (传说中的卷王之王)',
        condition: (s) => s.leetcode >= 60,
        effect: (s) => ({ tc: 35, health: s.health - 40, cash: s.cash + 10, company: 'meta', message: '你成功卷入了 Meta！虽然给的钱多，但是压力山大。' }),
        nextEventId: 'choose_housing',
      },
      {
        text: '面试普通 Startup',
        effect: (s) => ({ tc: 12, health: s.health - 5 }),
        nextEventId: 'startup_work',
      },
      {
        text: '挑战顶级量化基金 (Quant)',
        effect: (s) => {
          const pass = Math.random() > 0.8;
          return pass 
            ? { tc: 40, cash: s.cash + 10, health: s.health - 30, message: '奇迹发生！你拿下了华尔街顶级 Quant Fund 的 Offer，起薪 40 万美元！' }
            : { health: s.health - 15, message: '量化面试的数学题太难了，智商被按在地上摩擦...' };
        },
        nextEventId: (s) => s.tc >= 40 ? 'choose_housing' : 'job_hunt_fail',
      }
    ]
  },
  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '求职受挫',
    description: '由于迟迟找不到理想工作，你的 OPT 时间越来越少...',
    choices: [

      {
        text: '被迫回国',
        effect: (s) => ({ status: 'game_over', message: 'OPT到期未能上岸，遗憾回国。' }),
        nextEventId: 'end',
      },
      {
        text: '再读一个水硕维持身份 (Day 1 CPT)',
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
        effect: (s) => ({ rent: s.rent + 1, charm: s.charm + 10, health: s.health + 30, message: '你领养了毛孩子！虽然每年要多花不少钱买猫粮/狗粮和看兽医，但每次下班回家看到它，你的疲惫都一扫而空，而且在相亲软件上放宠物照片让你大受欢迎！' }),
        nextEventId: 'big_tech_work'
      },

      {
        text: '豪华 1b1b (每年 4 万美元): 环境好，心情愉悦',
        effect: (s) => ({ rent: 4, charm: s.charm + 1, health: s.health + 10, message: '你租下了带泳池的高级公寓，生活质量极高，相亲市场竞争力上升。' }),
        nextEventId: 'big_tech_work'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比高',
        effect: (s) => ({ rent: 2, message: '你和朋友合租，偶尔会因为抢厕所和洗碗吵架，但省下了不少钱。' }),
        nextEventId: 'big_tech_work'
      },
      {
        text: '挂壁大客厅 (每年 1 万美元): 终极省钱',
        effect: (s) => ({ rent: 1, charm: s.charm - 2, health: s.health - 15, message: '你睡在客厅，用帘子隔开。每天被室友做饭吵醒，毫无隐私，连相亲都不敢带人回家。' }),
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
          let winRate = 0.2; // 20% win rate
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, message: '人品爆发，今年H1B中签了！' }
            : { age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, health: s.health - 10, message: '今年 H1B 没抽中！只能指望明年...' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b',
      },
      {
        text: '砸钱找最顶级的移民律师帮忙弄 O1 签证 (花费 2 万美元)',
        condition: (s) => s.cash >= 2,
        effect: (s) => {
          const win = Math.random() > 0.4; // 60% chance for O1
          return win
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent - 2, message: '律师非常给力，成功帮你申请到了 O1 杰出人才签证，效果等同于 H1B！' }
            : { age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent - 2, health: s.health - 15, message: '移民局觉得你水平不够，O1 签证被拒，两万美元打了水漂。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b',
      },
      {
        text: '和美国公民闪婚拿绿卡 (高风险)',
        effect: (s) => {
          const fake = Math.random() > 0.7; // 30% fake marriage caught
          return fake
            ? { status: 'game_over', message: '移民局家访时发现你们是商婚，你被当场遣返回国并终身禁入美国，游戏结束！' }
            : { visa: '绿卡', age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你通过婚姻顺利拿到了绿卡，直接跨过了最大的槛！' }
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
          const win = Math.random() > 0.7; // 30% 海底捞 
          return win 
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, message: '谢天谢地，海底捞中签了！' }
            : { age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, status: 'game_over', message: 'H1B 彻底没抽中，被迫 Relocate 到加拿大，游戏结束。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'end',
      }
    ]
  },
  'sv_daily_life': {
    id: 'sv_daily_life',
    title: 'H1B 挂壁日常',
    description: '时间过得飞快，一转眼又是一年。在等绿卡排期的日子里，你每天都在经历硅谷的魔幻日常。除了按部就班，你也可以选择铤而走险。',
    choices: [

      {
        text: '老老实实搬砖，开启新的一年',
        effect: (s) => ({ age: s.age + 1, gc_progress: s.gc_progress + 1, message: `距离拿到绿卡还差 ${5 - (s.gc_progress + 1)} 年。` }),
        nextEventId: (s) => {
          if (s.gc_progress >= 5) return 'post_green_card';
          
          const rand = Math.random();
          if (rand < 0.12) return 'perf_review';
          if (rand < 0.24) return 'dating_market';
          if (rand < 0.36) return 'car_broken';
          if (rand < 0.48) return 'visa_check';
          if (rand < 0.60) return 'layoff_rumor';
          if (rand < 0.72) return 'dental_emergency';
          if (rand < 0.85) return 'crypto_scam';
          return 'xhs_boba';
        },
      },
      {
        text: '周末去体验湾区三俗 (滑雪/攀岩/桌游) 拓展圈子',
        effect: (s) => {
          const rand = Math.random();
          if (rand < 0.1) {
            return { age: s.age + 1, gc_progress: s.gc_progress + 1, cash: s.cash - 10, health: s.health - 30, message: '周末去 Tahoe 滑雪，为了装杯飞大跳台摔断了腿。叫了一次救护车，扣除保险后依然收到了 $10k 的天价医疗账单。' };
          }
          if (rand < 0.3) {
            return { age: s.age + 1, gc_progress: s.gc_progress + 1, charm: s.charm + 10, health: s.health + 20, message: '在狼人杀局上认识了心动嘉宾，你们一起去了优胜美地 Hiking，成功脱单！生活焕发了新生！' };
          }
          return { age: s.age + 1, gc_progress: s.gc_progress + 1, cash: s.cash - 1, health: s.health + 5, charm: s.charm + 1, message: '花了不少门票钱和油钱，局上全是单身男码农，什么浪漫的事都没发生，你只是变成了更强壮的单身狗。' };
        },
        nextEventId: (s) => {
          if (s.gc_progress >= 5) return 'post_green_card';
          
          const rand = Math.random();
          if (rand < 0.12) return 'perf_review';
          if (rand < 0.24) return 'dating_market';
          if (rand < 0.36) return 'car_broken';
          if (rand < 0.48) return 'visa_check';
          if (rand < 0.60) return 'layoff_rumor';
          if (rand < 0.72) return 'dental_emergency';
          if (rand < 0.85) return 'crypto_scam';
          return 'xhs_boba';
        },
      },
      {
        text: '太孤独了，领养一只宠物 (每年房租/开销增加 1w)',
        condition: (s) => s.rent >= 2 && !s.has_pet,
        effect: (s) => ({ rent: s.rent + 1, charm: s.charm + 10, health: s.health + 30, has_pet: true, message: '你领养了毛孩子！虽然每年要多花不少钱，但在相亲软件上放宠物照片让你大受欢迎，疲惫的心也被彻底治愈了！' }),
        nextEventId: 'sv_daily_life'
      },,
      {
        text: '受够了！不要身份了，裸辞 All in AI 创业！',
        condition: (s) => s.year >= 2022,
        effect: (s) => {
           if (s.leetcode >= 80) {
             return { cash: s.cash + 1000, visa: 'O1 (杰出人才)', status: 'win', message: '你凭借硬核的底层技术拿到了顶级风投，顺便搞定了 O1 签证！公司估值过亿，你提前跳出了打工人的宿命！' };
           }
           return { cash: s.cash - 20, status: 'game_over', message: '辞职后立刻失去了 H1B 身份，而你的套壳项目根本拉不到风投。60天后你被无情遣返，功亏一篑。' };
        },
        nextEventId: 'end'
      },
      {
        text: '打工太慢了，拿所有积蓄去炒期权/末日 Call！',
        effect: (s) => {
           const win = Math.random() > 0.95; // 极低概率暴富
           return win 
            ? { cash: s.cash * 10, status: 'win', message: '奇迹降临！你买的期权一夜之间翻了十倍！你第二天直接把辞职信甩在 Manager 脸上，财富自由了！' }
            : { cash: 0, health: s.health - 50, message: '爆仓了...你多年的积蓄一秒清零，精神崩溃。你只能在旧金山的街头流浪。', status: 'game_over' }
        },
        nextEventId: 'end'
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
            ? { health: s.health - 20, tc: s.tc + 5, cash: s.cash + (s.tc * 0.6) - s.rent, message: '卷赢了！你拿到了 Exceeds Expectations，涨薪 5 万美元！' }
            : { health: s.health - 20, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你辛辛苦苦写的文档被 Manager 拿去抢了功劳，还是个 Meets。白卷了。' };
        },
        nextEventId: (s) => (s.company === 'meta' && s.tc >= 50) ? 'meta_tlm' : 'sv_daily_life',
      },
      {
        text: '准点下班，躺平拿 Meets',
        effect: (s) => ({ health: s.health + 10, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
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
          ? { cash: s.cash + s.tc, health: s.health + 20, message: '因为你主页挂了滑雪和宠物照片，成功吸引了一位大厂双职工！两人一拍即合，组成双职工核心家庭，资产直接翻倍！' }
          : { cash: s.cash - 0.2, health: s.health - 15, message: '连喝了三杯 Boba，对方一听你还没抽到 H1B 且没买房，默默地在吃完饭后选择了 AA。你不仅花了钱还受到了真实伤害。' },
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
        effect: (s) => ({ cash: s.cash - 5 + s.tc, health: s.health - 10, message: '警察让你填了个表就没下文了，你花了 $5000 换玻璃和买新电脑。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '定位电脑，勇闯奥克兰黑市！',
        effect: (s) => {
          const win = Math.random() > 0.7;
          return win 
            ? { charm: s.charm + 2, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你像叶问一样一打十，从黑帮手里夺回了电脑，成为了湾区传说！' }
            : { health: s.health - 30, cash: s.cash - 5 + s.tc, message: '你不仅没找回电脑，还被打了一顿，医药费花了好几千。' };
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
        effect: (s) => ({ health: s.health - 30, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你昼夜颠倒地干了两个月，头发掉光了，但保住了工作。' }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '管他呢，直接请无薪假在国内到处旅游！',
        effect: (s) => ({ cash: s.cash - 20, health: s.health + 30, leetcode: s.leetcode - 10, message: '你顺便打卡了三亚和新疆，身体是养好了，但是现金流大幅缩水，算法也生疏了。' }),
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
            ? { health: s.health - 20, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你没日没夜地干活，终于在这个裁员季活了下来，但距离 Burnout 只有一步之遥。' }
            : { health: s.health - 10, cash: s.cash + (s.tc * 0.6) - s.rent, laid_off: true, message: '不管你怎么卷，你们整个组都被端了。你被裁员了！' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : 'sv_daily_life',
      },
      {
        text: '立刻开始刷题，准备后路',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 10, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你偷偷在上班时间刷题。果不其然，你被裁了，但你已经做好了准备。' }),
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
        text: '加入抢房大战 (买房)',
        effect: (s) => ({ age: s.age + 1 }),
        nextEventId: 'buy_house',
      },
      {
        text: '搞副业炒股：梭哈英伟达 (NVDA)！',
        effect: (s) => {
          const win = Math.random() > 0.4; // 60% chance to win with NVDA
          return win
            ? { cash: s.cash * 3, message: '皮衣黄刀法精准！英伟达市值突破天际，你直接财富自由了！', status: 'win' }
            : { cash: s.cash / 2, health: s.health - 20, message: '买在了高位... 股票腰斩，只能继续回去打工了。' };
        },
        nextEventId: (s) => s.cash > 200 ? 'end' : 'post_green_card',
      },
      {
        text: '辞职！凭多年大厂的技术积累直接搞 AI Startup',
        effect: (s) => s.leetcode >= 60
          ? { cash: s.cash + 500, tc: 0,
    rent: 4, status: 'win', message: '你带着前沿的 AI 理念获得了顶级风投 $50M 融资！成为了下一代独角兽 CEO！' }
          : { cash: s.cash - 50, health: s.health - 30, message: '技术不够硬，做出来的产品没人用，烧光了积蓄又灰溜溜回去打工。' },
        nextEventId: (s) => s.leetcode >= 60 ? 'end' : 'post_green_card',
      },
      {
        text: '不再唯唯诺诺，开始在职场上重拳出击',
        effect: (s) => ({ age: s.age + 1 }),
        nextEventId: 'office_politics',
      },
      {
        text: '彻底摆烂，躺平养老',
        effect: (s) => ({ health: s.health + 40, cash: s.cash + 50, age: s.age + 10, status: 'win', message: '你选择了躺平，虽然没有大富大贵，但在湾区过上了平淡且安稳的中产生活。' }),
        nextEventId: 'end',
      }
    ]
  },
  'buy_house': {
    id: 'buy_house',
    title: '宇宙中心抢房大战',
    description: '你看中了一套 Sunnyvale 的老破小“学区房”，标价 $200w。Open House 现场挤满了带着支票簿的印度和中国码农，空气中弥漫着疯狂加价的硝烟。',
    choices: [

      {
        text: 'All in 现金，加价 $50w 硬抢！(需现金 > 80w)',
        condition: (s) => s.cash >= 80,
        effect: (s) => ({ cash: s.cash - 80, health: s.health - 20, message: '恭喜！你成功抢到了房子，成为了光荣的湾区房奴。', status: 'win' }),
        nextEventId: 'end',
      },
      {
        text: '向国内父母求助（掏空六个钱包）',
        condition: (s) => s.cash < 80,
        effect: (s) => ({ cash: s.cash + 80, health: s.health - 20, message: '父母卖掉了老家的房子给你凑齐了首付，你背上了沉重的心理包袱和巨额房贷。' }),
        nextEventId: 'house_slave',
      },
      {
        text: '太卷了，我去东湾买新房',
        effect: (s) => ({ cash: s.cash - 40, health: s.health + 10, message: '你搬到了偏远但宽敞的新房，每天通勤 2 小时，在 880 上堵到怀疑人生。' }),
        nextEventId: 'post_green_card',
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
        effect: (s) => ({ age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, health: s.health - 5 }),
        nextEventId: (s) => s.cash > 150 ? 'end' : 'house_slave',
      },
      {
        text: '偷偷把次卧租给留学生赚点外快',
        effect: (s) => {
          const badTenant = Math.random() > 0.7;
          return badTenant
            ? { health: s.health - 15, message: '留学生是个极品，不仅弄坏了你的烤箱，还带人开派对吵得你彻夜难眠。' }
            : { cash: s.cash + 1.5, message: '留学生很安静，按时交租，有效缓解了你的房贷压力。' };
        },
        nextEventId: 'house_slave',
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
        text: '拼了！目标 L6，接管核心项目',
        effect: (s) => {
          const win = Math.random() > 0.3; // 70% 成功率
          return win 
            ? { tc: 60, cash: s.cash + 35, health: s.health - 50, message: '你干掉了同组的竞争对手，成功升到了 L6。包裹极大，但你的身体严重透支。' }
            : { health: s.health - 30, message: '辛辛苦苦卷了一年，名额却被空降的 VP 亲信抢走了。' };
        },
        nextEventId: (s) => s.health <= 0 ? 'end' : 'sv_daily_life',
      },
      {
        text: '受不了了，降薪跳槽去 Google 养老',
        effect: (s) => ({ tc: 20, health: s.health + 30, cash: s.cash + 10, message: '你受够了卷生卷死，跳槽到了 Google。虽然总包砍半，但是每天 3点半下班，你重新找回了生活的意义。' }),
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
        text: '放下 IDE，打开 PPT 开始高强度对线',
        effect: (s) => s.leetcode > 50
          ? { tc: s.tc + 30, cash: s.cash + 100, message: '你顿悟了硅谷“向上管理”的精髓，成功画饼，荣升 Director！', status: 'win' }
          : { health: s.health - 40, message: '你平时只顾着刷题，画饼技术太差，被 Raj 在会上抓住漏洞疯狂攻击，晋升失败。' },
        nextEventId: (s) => s.leetcode > 50 ? 'end' : 'post_green_card',
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
        text: '继续卷！目标 P8',
        effect: (s) => ({ health: s.health - 40, cash: s.cash + 20, age: s.age + 3 }),
        nextEventId: 'cn_burnout',
      },
      {
        text: '拿着钱申请美国水硕 (逃离内卷)',
        effect: (s) => ({ cash: s.cash - 15, visa: 'F1 (学生)', age: s.age + 2 }),
        nextEventId: 'us_master_grad',
      },
      {
        text: '跳槽加入一家叫“字节跳动”的初创公司',
        condition: (s) => s.year <= 2018,
        effect: (s) => {
          const win = Math.random() > 0.3; // 70% 胜率
          return win 
            ? { cash: s.cash + 1000, tc: 0,
    rent: 4, status: 'win', message: '你赶上了移动互联网最肥美的一波红利！期权兑现，你在海淀买下大平层，实现财务自由！' }
            : { health: s.health - 50, message: '期权还没变现你就因为天天熬夜大小周被抬进了急诊室...' };
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : 'cn_burnout'
      }
    ]
  },
  'cn_burnout': {
    id: 'cn_burnout',
    title: '职场危机',
    description: '你的身体撑不住了...',
    choices: [

      {
        text: '遗憾退场',
        effect: (s) => ({ status: 'game_over', message: '身体是革命的本钱。因为过劳进了ICU，职业生涯提前结束。' }),
        nextEventId: 'end',
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
          let winRate = 0.15; // 15% base success
          if (s.year >= 2020 && s.year <= 2022) winRate = 0.4; // Web3/SaaS boom during COVID
          const win = Math.random() < winRate; 
          return win 
            ? { cash: s.cash + 200, status: 'win', message: '奇迹发生！公司靠稳扎稳打被大厂收购了，你财富自由了！' }
            : { cash: s.cash - 5, health: s.health - 15, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸。' }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型套壳',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: s.cash - 10, health: s.health - 20, message: `现在才 ${s.year} 年，你的 AI 理念太超前了！投资人觉得你不切实际，拒绝投资，公司倒闭。` };
          }
          const win = Math.random() > 0.8; // 20% success rate in 2022+
          return win 
            ? { cash: s.cash + 800, tc: 0,
    rent: 4, visa: '绿卡', status: 'win', message: '踩中 AI 风口！拿到巨额融资成为独角兽，财富自由，顺便批了 EB-1 杰出人才绿卡！' }
            : { cash: s.cash - 10, health: s.health - 30, message: '转型太慢，被 OpenAI 连夜更新的接口直接“背刺”干死了...' }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : (s.visa === '无' ? 'dropout_fail' : 'job_hunt_fail'),
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
        text: '熬！硬发顶会 (耗时 5 年，极度摧残身心)',
        effect: (s) => {
          const pass = Math.random() > 0.4;
          return pass 
            ? { age: s.age + 5, health: s.health - 40, leetcode: s.leetcode + 50, is_phd: true, message: '五年寒窗，发了两篇顶会，终于拿到了 PhD 学位！虽然头上剩不了几根头发，但你现在是货真价实的 AI 专家。' }
            : { age: s.age + 2, health: s.health - 20, message: '论文被拒了无数次，老板还不让毕业，你陷入了深深的自我怀疑。' };
        },
        nextEventId: (s) => s.is_phd ? 'phd_job_hunt' : 'phd_life'
      },
      {
        text: '老板太坑了，我要 Master Out (拿个硕士跑路求职)',
        effect: (s) => ({ age: s.age + 2, health: s.health + 10, message: '你及时止损，认清了自己不适合做学术，拿着硕士学位重回求职大军。' }),
        nextEventId: 'job_hunt'
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
        effect: (s) => ({ tc: 80, cash: s.cash + 20, health: s.health - 20, visa: 'O1 (杰出人才)', message: '顶级 AI 公司直接用 $80w 的百万包裹和 O1 签证把你砸晕，你正式成为了硅谷新贵！' }),
        nextEventId: 'choose_housing'
      },
      {
        text: '去大厂当 Applied Scientist (应用科学家)',
        effect: (s) => ({ tc: 45, cash: s.cash + 15, visa: 'O1 (杰出人才)', message: '大厂的科学家岗位待遇丰厚，不用写 CRUD，直接解决核心算法问题，生活相对安稳。' }),
        nextEventId: 'choose_housing'
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
          const win = Math.random() > 0.85; // 15% chance to win
          return win 
            ? { cash: s.cash + 100, status: 'win', message: '你买的土狗币居然真的上了币安！瞬间百倍收益，你看着余额里多出来的 $1M 陷入了沉思...' }
            : { cash: s.cash - 5, health: s.health - 15, message: '经典的杀猪盘。项目方第二天就跑路了，你的钱全都换成了毫无价值的空气币。' }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : 'sv_daily_life'
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
  const [currentEventId, setCurrentEventId] = useState<string>('choose_year');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentEventId]);

  const currentEvent = events[currentEventId];

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new state
    const newState = { ...gameState, message: '', laid_off: false }; // Clear old message and generic flags
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

    // Check if health drops <= 0
    if (newState.health <= 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
    }

    // Check if bankrupt
    if (newState.cash < 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      newState.message = '你破产了，无法支付账单，游戏结束！';
    }

    setGameState(newState);

    // 2. Transition to next event
    if (newState.status !== 'playing') {
      setCurrentEventId('end');
    } else {
      const nextId = typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;
      setCurrentEventId(nextId);
    }
  };

  const resetGame = () => {
    setGameState(generateInitialState());
    setCurrentEventId('choose_year');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Left Column: Sticky Status Panel */}
          <div className="lg:col-span-5 order-last lg:order-none lg:sticky lg:top-12 flex flex-col">
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
                  <p className="text-zinc-400 mb-10 text-lg md:text-xl leading-relaxed">{currentEvent.description}</p>
                  
                  <div className="flex flex-col space-y-4">
                    {currentEvent.choices.filter(c => !c.condition || c.condition(gameState)).map((choice, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChoice(choice)}
                        className="group w-full text-left px-6 py-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <span className="text-zinc-300 font-medium group-hover:text-emerald-400 transition-colors text-lg">
                          {choice.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
               ) : (
                <div className="text-center py-16">
                  <h2 className={`text-5xl md:text-6xl font-bold tracking-tight mb-6 ${gameState.status === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {gameState.status === 'win' ? '通关成功' : '游戏结束'}
                  </h2>
                  <p className="text-xl text-zinc-400 mb-12 leading-relaxed max-w-md mx-auto">
                    {gameState.status === 'win' ? '你成功在硅谷生存下来，实现了自己的目标！' : gameState.message}
                  </p>
                  <button
                    onClick={resetGame}
                    className="px-10 py-5 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white transition-colors duration-200 font-bold text-xl active:scale-[0.98]"
                  >
                    再次重开人生
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
