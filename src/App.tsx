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
        text: '去美国读本科 (直接拿F1，体验多元文化)',
        effect: (s) => ({ cash: s.cash - 5, visa: 'F1 (学生)', age: s.age + 1 }),
        nextEventId: 'us_college_year1',
      },
      {
        text: '在国内读本科 (省钱，打好理工科基础)',
        effect: (s) => ({ cash: s.cash - 1, age: s.age + 1 }),
        nextEventId: 'cn_college_year1',
      },
      {
        text: '不上大学了！拿着启动资金直接创业',
        effect: (s) => ({ cash: s.cash - 10, age: s.age + 2, message: '你辍学创业，体验了社会的毒打。' }),
        nextEventId: 'startup_work',
      }
    ]
  },
  'us_college_year1': {
    id: 'us_college_year1',
    title: '美本大一：初来乍到',
    description: '刚来到美国，陌生的环境让你兴奋又迷茫。这学期你打算怎么过？',
    choices: [
      {
        text: '疯狂社交，谈恋爱，参加派对',
        effect: (s) => ({ cash: s.cash - 3, health: s.health - 10, charm: s.charm + 1, age: s.age + 2, message: '虽然花了不少钱，但你谈了一场轰轰烈烈的恋爱！' }),
        nextEventId: 'us_college_year3',
      },
      {
        text: '死磕 GPA 和编程基础',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 5, age: s.age + 2, message: '你拿了全A，但也因为久坐胖了三斤。' }),
        nextEventId: 'us_college_year3',
      }
    ]
  },
  'us_college_year3': {
    id: 'us_college_year3',
    title: '美本大三：危机降临',
    description: '大三了，CS的一门核心课难到令人发指。你眼看就要挂科了：',
    choices: [
      {
        text: '花钱找代写 (高风险)',
        effect: (s) => {
          const caught = Math.random() > 0.7; // 30% 概率被抓
          return caught 
            ? { status: 'game_over', message: '找代写被教授抓到，违反学术诚信，直接开除遣返！' }
            : { cash: s.cash - 2, age: s.age + 1, message: '侥幸通过了，但你其实什么都没学到。' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'us_undergrad_grad',
      },
      {
        text: '在图书馆通宵复习，死磕到底',
        effect: (s) => ({ health: s.health - 20, leetcode: s.leetcode + 15, age: s.age + 1, cash: s.cash - 5, message: '你熬了无数个大夜，终于 Pass 了这门课！' }),
        nextEventId: 'us_undergrad_grad',
      },
      {
        text: '及时止损，转专业去学商科/文科',
        effect: (s) => ({ health: s.health + 10, leetcode: Math.max(0, s.leetcode - 10), age: s.age + 1, charm: s.charm + 1, message: '虽然放下了代码，但你找到了生活的快乐，颜值/魅力也变高了。' }),
        nextEventId: 'us_undergrad_grad',
      }
    ]
  },
  'cn_college_year1': {
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
        effect: (s) => ({ tc: 35, health: s.health - 40, cash: s.cash + 10, message: '你成功卷入了 Meta！虽然给的钱多，但是压力山大。' }),
        nextEventId: 'meta_tlm',
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
    title: '大厂打工人',
    description: '恭喜！你拿到了大厂大包，成为了光荣的湾区码农。接下来要面临 H1B 抽签了。',
    choices: [
      {
        text: '认真工作，祈祷 H1B 中签',
        effect: (s) => {
          let winRate = 0.2; // 20% win rate
          if (s.cash > 40) winRate = 0.5; // 请好律师
          const win = Math.random() < winRate;
          return win 
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, message: '人品爆发，今年H1B中签了！' }
            : { age: s.age + 1, cash: s.cash + (s.tc * 0.6) - s.rent, health: s.health - 10, message: '今年 H1B 没抽中！还有机会...' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'sv_daily_life' : 'big_tech_work_no_h1b',
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
          if (s.gc_progress + 1 >= 5) return 'post_green_card';
          
          const rand = Math.random();
          if (rand < 0.2) return 'perf_review';
          if (rand < 0.4) return 'dating_market';
          if (rand < 0.6) return 'car_broken';
          if (rand < 0.8) return 'visa_check';
          return 'layoff_rumor';
        },
      },
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
        nextEventId: 'sv_daily_life',
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
    title: '湾区婚恋市场',
    description: '家里疯狂催婚，你决定去相亲市场上碰碰运气。',
    choices: [
      {
        text: '参加 $100 门票的线下桌游局相亲',
        effect: (s) => s.charm >= 7 
          ? { cash: s.cash + 100 + s.tc, health: s.health + 20, message: '因为颜值出众，你遇到了一位湾区大厂双职工，强强联合，家庭资产大增！' }
          : { cash: s.cash - 0.1 + s.tc, health: s.health - 10, message: '在相亲局上，大家一听你还没绿卡，默默地换到了另一桌。深受打击。' },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '一个人打游戏看动漫不香吗？',
        effect: (s) => ({ charm: s.charm - 1, health: s.health + 10, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你把相亲的钱省下来抽卡，并在二次元中找到了真正的快乐。' }),
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
    description: '你每个月要还一万多美元的房贷，每天睁眼就是钱。此时公司传来了又要裁员的坏消息...',
    choices: [
      {
        text: '拼命卷，保住饭碗',
        effect: (s) => {
          const pass = s.health > 40;
          return pass
            ? { health: s.health - 40, cash: s.cash + (s.tc * 0.6) - s.rent, message: '你透支了最后的健康，勉强保住了工作和房子。', status: 'win' }
            : { status: 'game_over', message: '你的身体彻底垮了，不仅被裁员，房子也被银行法拍。你带着无尽的遗憾黯然回国。' };
        },
        nextEventId: 'end'
      }
    ]
  },
  'meta_tlm': {
    id: 'meta_tlm',
    title: 'Meta TLM 卷王之王',
    description: '你在 Meta 一路火花带闪电升到了 TLM，手下带了十几个人，TC 高达 80w，但你的发际线已经到了后脑勺，每天都在 Burnout 的边缘。',
    choices: [
      {
        text: '趁着高薪直接买大豪宅！',
        effect: (s) => ({ cash: s.cash - 100, health: s.health - 20, status: 'win', message: '你买下了一套带泳池的 Atherton 大豪宅，虽然身体已经被掏空，但你已经是世俗意义上的人生赢家了！' }),
        nextEventId: 'end',
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
  'end': {
    id: 'end',
    title: '游戏结束',
    description: '',
    choices: []
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
