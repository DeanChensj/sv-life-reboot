import { useState } from 'react';

// Types
type VisaStatus = '无' | 'F1 (学生)' | 'OPT (实习)' | 'H1B (工签)' | '绿卡';

interface GameState {
  age: number;
  cash: number; // 万美元
  health: number; // 0-100
  leetcode: number; // 0-100
  visa: VisaStatus;
  tc: number; // 万美元
  charm: number; // 颜值 1-10 (隐藏)
  year: number; // 当前年份
  status: 'playing' | 'game_over' | 'win';
  message: string;
}

interface Choice {
  text: string;
  effect: (state: GameState) => Partial<GameState>;
  nextEventId: string | ((state: GameState) => string);
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
    charm,
    year: 2018, // 默认，会被第一步覆盖
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
        effect: (s) => ({ visa: 'OPT (实习)', leetcode: s.leetcode + 10 }),
        nextEventId: 'job_hunt',
      },
      {
        text: '申请大U硕士 (刷题进厂预备役)',
        effect: (s) => ({ cash: s.cash - 10, age: s.age + 2, leetcode: s.leetcode + 10 }),
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
      }
    ]
  },
  'job_hunt': {
    id: 'job_hunt',
    title: '湾区求职季',
    description: '你迎来了惨烈的面试季。不同年份的市场难度天差地别...',
    choices: [
      {
        text: '面试 FLAG 大厂',
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
          return s.leetcode >= req ? 'big_tech_work' : 'job_hunt_fail';
        },
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
        nextEventId: (s) => s.tc >= 40 ? 'big_tech_work' : 'job_hunt_fail',
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
  'big_tech_work': {
    id: 'big_tech_work',
    title: '大厂打工人',
    description: '恭喜！你拿到了大厂大包，成为了光荣的湾区码农。接下来要面临 H1B 抽签了。',
    choices: [
      {
        text: '认真工作，祈祷 H1B 中签',
        effect: (s) => {
          const win = Math.random() > 0.6; // 40% win rate
          return win 
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + s.tc, message: '人品爆发，今年H1B中签了！' }
            : { age: s.age + 1, cash: s.cash + s.tc, health: s.health - 10, message: '今年 H1B 没抽中！还有机会...' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'h1b_life' : 'big_tech_work_no_h1b',
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
          const win = Math.random() > 0.5; 
          return win 
            ? { visa: 'H1B (工签)', age: s.age + 1, cash: s.cash + s.tc, message: '谢天谢地，海底捞中签了！' }
            : { age: s.age + 1, cash: s.cash + s.tc, status: 'game_over', message: 'H1B 彻底没抽中，被迫 Relocate 到加拿大，游戏结束。' };
        },
        nextEventId: (s) => s.visa === 'H1B (工签)' ? 'h1b_life' : 'end',
      }
    ]
  },
  'h1b_life': {
    id: 'h1b_life',
    title: 'H1B 打工日常',
    description: '你抽中了 H1B，开始了漫长的排期之旅。生活有些枯燥，但也算稳定。',
    choices: [
      {
        text: '去一亩三分地发相亲贴',
        effect: (s) => s.charm >= 8 
          ? { cash: s.cash + 100, health: s.health + 20, message: '因为颜值出众，你遇到了一位湾区大厂双职工，强强联合，资产大增！' }
          : { health: s.health - 10, message: '发了相亲贴，但因为颜值普通被冷嘲热讽，深受打击...' },
        nextEventId: 'h1b_life_continue',
      },
      {
        text: '老老实实搬砖',
        effect: (s) => ({ health: s.health - 10, cash: s.cash + s.tc }),
        nextEventId: 'h1b_life_continue',
      }
    ]
  },
  'h1b_life_continue': {
    id: 'h1b_life_continue',
    title: '裁员风波',
    description: '有一天，Blind 上传出你们部门要裁员...',
    choices: [
      {
        text: '疯狂加班，讨好 Manager',
        effect: (s) => ({ health: s.health - 30, cash: s.cash + s.tc }),
        nextEventId: 'layoff_survive',
      },
      {
        text: '立刻刷题准备跑路',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 10 }),
        nextEventId: 'layoff_hit',
      }
    ]
  },
  'layoff_survive': {
    id: 'layoff_survive',
    title: '躲过裁员',
    description: '你因为卷过了同事，躲过了裁员，但也接近 Burnout。',
    choices: [
      {
        text: '拿着股票熬到绿卡',
        effect: (s) => ({ age: s.age + 5, cash: s.cash + 100, visa: '绿卡', status: 'win', message: '你熬到了绿卡，实现了阶段性财富自由！' }),
        nextEventId: 'end',
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
        nextEventId: (s) => s.leetcode > 60 ? 'h1b_life' : 'end',
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
          const win = Math.random() > 0.85; // 只有 15% 的成功率
          return win 
            ? { cash: s.cash + 200, status: 'win', message: '奇迹发生！公司靠稳扎稳打被大厂收购了，你财富自由了！' }
            : { cash: s.cash - 5, health: s.health - 15, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸。' }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : 'job_hunt_fail',
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型套壳',
        effect: (s) => {
          const win = Math.random() > 0.4; // 60% 成功率
          return win 
            ? { cash: s.cash + 800, tc: 0, visa: '绿卡', status: 'win', message: '踩中 AI 风口！拿到巨额融资成为独角兽，财富自由，顺便批了 EB-1 杰出人才绿卡！' }
            : { cash: s.cash - 10, health: s.health - 30, message: '转型太慢，被 OpenAI 连夜更新的接口直接“背刺”干死了...' }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : 'job_hunt_fail',
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

  const currentEvent = events[currentEventId];

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new state
    const newState = { ...gameState, message: '' }; // Clear old message first
    const effectResult = choice.effect(gameState);
    Object.assign(newState, effectResult); // Apply new effects, which may set a new message
    
    // Auto increment year based on age difference
    if (effectResult.age !== undefined && effectResult.age > gameState.age) {
      newState.year = gameState.year + (effectResult.age - gameState.age);
    }

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
          <div className="lg:col-span-5 lg:sticky lg:top-12 flex flex-col">
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
                    className={`h-full rounded-full transition-all duration-500 ${gameState.health > 50 ? 'bg-emerald-500' : gameState.health > 20 ? 'bg-amber-500' : 'bg-red-500'}`} 
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
              <div className="border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 px-5 py-4 rounded-r-lg mb-8 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {gameState.message}
              </div>
            )}

            {/* Event Card */}
            <div className="bg-zinc-900/40 rounded-3xl p-8 md:p-12 border border-zinc-800 backdrop-blur-md transition-all duration-300 shadow-2xl">
              {gameState.status === 'playing' && currentEvent ? (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-50 mb-6">{currentEvent.title}</h2>
                  <p className="text-zinc-400 mb-10 text-lg md:text-xl leading-relaxed">{currentEvent.description}</p>
                  
                  <div className="flex flex-col space-y-4">
                    {currentEvent.choices.map((choice, idx) => (
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
