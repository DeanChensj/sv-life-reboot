import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear, isTemporaryOrStudentHousing , gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const initializationEvents: Record<string, GameEvent> = {
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
        // Trimmed the outlier +70 cash head-start to +50 (still the biggest by far).
        effect: (s) => ({ trait_title: '家里有矿', cash: s.cash + 50, network: 25, leetcode: Math.max(0, s.leetcode - 15), health: s.health - 15, win_threshold: 450 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【天选之子】玄学护体，总能在关键时刻化险为夷，气运爆发。',
        // Drawback added: pure-luck build, no coding-skill edge (was leetcode +8, strictly upside).
        effect: (s) => ({ trait_title: '天选之子', luck: Math.min(99, Math.max(s.luck + 18, 52)), network: 15, leetcode: Math.max(0, s.leetcode - 5), charm: s.charm + 5, win_threshold: 400 }),
        nextEventId: 'choose_year',
      },
      {
        text: '【小镇做题家】毫无波澜的普通面板，纯凭实力打拼。',
        // Was strictly dominated (no bonuses at all). Now a genuine skill-focused build
        // with the lowest FIRE threshold.
        effect: (s) => ({ trait_title: '小镇做题家', leetcode: s.leetcode + 10, luck: Math.min(99, s.luck + 3), network: 12, win_threshold: 350 }),
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
        effect: (s) => ({ year: 2014, difficulty_title: '简单难度', luck: Math.min(99, (s.luck ?? 20) + 10) }),
        nextEventId: 'choose_school',
      },
      {
        text: '【普通难度 (周期交替)】经历经济周期起伏，放水狂欢与裁员潮交替 (标准体验)。',
        effect: () => ({ year: 2018, difficulty_title: '普通难度' }),
        nextEventId: 'choose_school',
      },
      {
        text: '【困难难度 (地狱 AI 狂潮)】AI 颠覆性内卷，大厂 HC 极度锁死，职场高压挑战！',
        effect: () => ({ year: 2019, difficulty_title: '困难难度' }),
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
        text: '理工强校大U (如 UIUC/UW/UMich) (四年总开销 18 万美元)',
        condition: (s) => s.cash >= 18,
        effect: (s) => ({ cash: Math.max(0, s.cash - 18), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age, leetcode: s.leetcode + 5, housing_name: '大U 校内宿舍', message: '你来到了全美顶尖理工强校，准备体验硬核课业。' }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: '美国普通公立大学 (四年总开销 10 万美元, 美籍/绿卡含州内补贴只需 4 万)',
        condition: (s) => s.cash >= ((s.visa === '公民' || s.visa === '绿卡') ? 4 : 10),
        effect: (s) => {
          const cost = (s.visa === '公民' || s.visa === '绿卡') ? 4 : 10;
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
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【金融创投比赛】参加全国大学生商业创投挑战赛',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 6), luck: Math.min(99, s.luck + 4), age: s.age + 2, message: '商业计划书打动了校外评委，拿到了创业鼓励金与名企实习推荐！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【文娱自媒体】担任社团主唱 / 运营大学生活 VLOG',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), cash: s.cash + 0.8, health: Math.min(100, s.health + 5), age: s.age + 2, message: '你的网游/校园 VLOG 在 B站和小红书小火，涨粉数千并吸引了不少粉丝打赏！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【学生会外联】加入学生会与外联部 (锻炼人际社交与组织能力)',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: s.health - 5, age: s.age + 2, message: '你在学生会拉赞助混得风生水起，结识了一圈活跃朋友。两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【大厂暑期实习】抢先投递并斩获国内一线互联网大厂实习',
        effect: (s) => ({ cash: s.cash + 2, leetcode: s.leetcode + 8, health: s.health - 8, age: s.age + 2, message: '在厂里体验了硬核工程落地，提前积累了实战经验。两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      }
    ]
  },

  // 陆本随机校园事件,

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
          const pass = s.leetcode >= 20 || gameRandom() < 0.5;
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
          const win = gameRandom() < 0.45 + (s.leetcode / 200);
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
          const pass = s.is_phd || (gameRandom() < (0.20 + (s.school === 'cmu' ? 0.20 : 0) + (s.leetcode >= 80 ? 0.15 : 0) + (s.story_flags?.phd_ready ? 0.15 : 0)));
          return pass 
            ? { cash: s.cash + 2, age: s.age + 1, year: s.year + 1, is_phd: true, housing_name: '美国 博士实验室', message: '大喜讯！你战胜了数千名申请者，斩获北美顶级 CS 全奖 PhD Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, year: s.year + 1, is_phd: false, message: '今年 CS 顶校 PhD 全奖录取率极低，你的推荐信被审稿人刷了，惨遭拒信。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'job_hunt',
      },

      {
        text: '直接找工作 (开始受苦)',
        // (Removed a dead `year === 2020` pandemic branch: year is frozen during
        // school so it could never fire. Graduation now cleanly activates OPT.)
        effect: (s) => ({ visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', leetcode: s.leetcode + 10, message: '你开始了漫漫求职路...' }),
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
          const pass = gameRandom() < (0.18 + (s.leetcode >= 80 ? 0.20 : 0));
          return pass
            ? { cash: s.cash + 2, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', age: s.age + 1, year: s.year + 1, is_phd: true, housing_name: '美国 博士实验室', message: '奇迹！凭着陆本顶尖算法功底，你跨海斩获了美国 CS 全奖直博 Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, year: s.year + 1, is_phd: false, message: '美国顶尖博士项目全墨！因为没有美本强推被卡，只能转投国内大厂或申请水硕。' };
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
          const loanPass = (s.leetcode >= 18) || (gameRandom() < 0.40 + (s.luck / 200));
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
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【量化金融】加入校内量化/学生投资俱乐部 (Quant & Trading Club)',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(25, s.charm + 5), health: s.health - 3, age: s.age + 2, message: '在模拟盘实盘操作中大获全胜，赚到了第一笔金融交易收益！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【竞技体育】加入校队竞技体育 (网球/抱石/橄榄球)',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(25, s.charm + 5), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '高强度体育训练拉满！体能与气场全面大爆发！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【文娱社团】组建校园摇滚乐队举办草坪音乐节',
        effect: (s) => ({ charm: Math.min(25, s.charm + 8), health: Math.min(100, s.health + 5), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '你在音乐节上作为主唱震撼全场，成为了校园里的风云人物！两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【兄弟会社交】加入兄弟会/姐妹会 (Frat Party 社交局)',
        condition: (s) => s.cash >= 2,
        effect: (s) => ({ cash: s.cash - 2, charm: Math.min(25, s.charm + 8), health: s.health - 10, age: s.age + 2, message: '每周 Party，在啤酒乒乓桌上认识了一堆富二代与校友朋友。两年时光弹指一挥间。' }),
        nextEventId: () => ['college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala'][Math.floor(gameRandom() * 4)],
      }
    ]
  },

  // 北美大学随机事件,

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
        // Being research-ready is NOT the same as holding a PhD. Track it as a flag
        // that boosts PhD-admit odds; is_phd is only set where a PhD is actually earned.
        effect: (s) => ({ leetcode: s.leetcode + 12, charm: Math.min(25, s.charm + 4), health: s.health - 8, age: s.age + 2, story_flags: { ...(s.story_flags || {}), phd_ready: true }, message: '你拿到了顶尖教授的强力推荐信，具备了申请顶尖 PhD 的资本！顺利毕业！' }),
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
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)',
          cash: s.cash - 1,
          tc: 6,
          company: 'icc',
          job_type: 'startup',
          laid_off: false,
          rent: 1,
          has_housing: true,
          housing_name: 'ICC 挂靠合宿单间',
          message: '你找了一家印裔 ICC 外包公司挂靠，拿着微薄薪水并在外包合宿单间住下，等待 Client 派遣。'
        }),
        nextEventId: 'icc_work',
      },
      {
        text: '加入一家刚成立的 AI 初创公司 (高风险高回报)',
        // Available to any master's grad (was gated on year>=2023, which is unreachable
        // because `year` is frozen during school — the option could never appear).
        condition: (s) => s.is_master === true || s.has_us_degree === true,
        effect: (s) => {
          const win = gameRandom() < 0.08;
          return win 
            ? { tc: 25, health: s.health - 15, cash: s.cash + 100, job_type: 'startup', laid_off: false, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', message: '天选之子！你盲狙的公司获得核心突破并由资本巨额注资，你分到了高额股票！' }
            : { tc: 0, health: s.health - 15, laid_off: true, job_type: 'unemployed', visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'OPT (实习)', message: '公司烧光了投资人的钱，不到半年就倒闭了。期权变成了废纸，你只能连夜更新简历。' };
        },
        nextEventId: (s: GameState) => {
          if (s.laid_off) return 'job_hunt';
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
        },
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
          tc: 30,
          company: 'google',
          job_type: 'big_tech',
          level: 'L4',
          laid_off: false,
          cash: s.cash + 5,
          age: s.age + 1,
          year: s.year + 1,
          message: (s.visa === '公民' || s.visa === '绿卡')
            ? '凭美籍/绿卡身份优势，你免受签证束缚直接飞赴硅谷入职 Google (定级 L4 · 年薪 $30w)！'
            : '陆本硬核算法发威！你拿到了外派 Offer，以 L1 身份入职海外分公司并调动回湾区总部 (定级 L4 · 年薪 $30w)！'
        }),
        nextEventId: (s) => (s.visa === '公民' || s.visa === '绿卡') ? 'job_hunt' : (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'),
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
          const pass = (s.leetcode >= 20) || (gameRandom() < 0.50 + (s.luck / 200));
          return pass
            ? { cash: Math.max(0, s.cash - 2), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', age: s.age, health: Math.min(100, s.health + 20), message: ' 申请成功！凭借在国内大厂积累的工程项目经历，你顺利通过无抵押贷款审核与 Master 录取，开启赴美新生活！' }
            : { health: s.health - 10, message: ' 申请被拒！留学贷款机构与校方评估认为你负债风险过高，贷款未获批准。你只能留在本地继续调养或打工。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('赴美新生活') ? 'us_master_year1' : 'cn_work'
      }
    ]
  },

  'phd_life': {
    id: 'phd_life',
    title: '北美读博：学术起步 (博一~博二)',
    description: '你拿着每年 3 万美元的 stipend，看着去湾区大厂打工的同学已经换了保时捷。你的导师极度 push，凌晨两点还在群里圈你改实验。',
    choices: [
      {
        text: '【全力冲刺顶会】昼夜攻坚大模型架构与分布式算子，硬冲 NeurIPS/ICML (耗时 2 年)',
        effect: (s) => {
          const passProb = 0.40 + (s.leetcode >= 70 ? 0.20 : 0) + (s.school === 'cmu' ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass 
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), is_phd: true, leetcode: Math.min(100, s.leetcode + 20), message: '两年的昼夜颠倒，你的论文终于有突破性进展并被顶会 Oral 接收，老板决定带你去夏威夷参加顶级学术会议！' }
            : { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), leetcode: Math.min(100, s.leetcode + 15), message: '首篇顶会审稿激烈惨遭拒稿，但你摸清了顶会评审偏好并积累了大量实验基准。进入博三博四攻坚！' };
        },
        nextEventId: (s) => ((s.message || '').includes('夏威夷') ? 'phd_conference' : 'phd_mid_stage')
      },
      {
        text: '【跟组稳扎稳打】与实验室师兄合作发表中档二作，稳过资格考 Quals (耗时 2 年)',
        effect: (s) => ({
          age: s.age + 2,
          year: s.year + 2,
          health: Math.max(0, s.health - 8),
          leetcode: Math.min(100, s.leetcode + 10),
          message: '你稳扎稳打通过了博士资格考 (Quals)，并积累了扎实的合作论文，深得导师信任！进入博三高年级。'
        }),
        nextEventId: 'phd_mid_stage'
      },
      {
        text: '【Tahoe 实验室滑雪团建】跟导师申请去 Lake Tahoe 滑雪度假与身心调养 (健康 +25, 耗时 1 年)',
        effect: (s) => ({
          health: Math.min(100, s.health + 25),
          age: s.age + 1,
          year: s.year + 1,
          message: '你在 Lake Tahoe 的雪道上畅快滑雪，身心彻底满血复活！但导师在缆车上严肃提醒科研进度落后，要求你回校后必须全力攻坚。'
        }),
        nextEventId: 'phd_mid_stage'
      },
      {
        text: '【Master Out 及时止损】看清学术民工现状，拿硕士跑路求职 (耗时 1 年)',
        effect: (s) => ({
          age: s.age + 1,
          year: s.year + 1,
          is_phd: false,
          is_master: true,
          health: Math.min(100, s.health + 15),
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)',
          message: '你及时止损，认清了自己不适合做学术，拿着硕士学位重回硅谷求职大军。'
        }),
        nextEventId: 'job_hunt'
      }
    ]
  },

  'phd_mid_stage': {
    id: 'phd_mid_stage',
    title: '北美读博：学术攻坚与答辩生死线 (博三~博四)',
    description: '博士进入后半程，导师的 Funding 告急，毕业答辩与论文指标压得你喘不过气。实验室里弥漫着焦虑，今年你必须做出决断。',
    choices: [
      {
        text: '【背水一战硬冲顶会 Oral】通宵手撕算子与分布式实验，决战 NeurIPS (耗时 2 年)',
        effect: (s) => {
          const passProb = 0.50 + (s.leetcode >= 70 ? 0.25 : 0) + (s.school === 'cmu' ? 0.10 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), is_phd: true, leetcode: Math.min(100, s.leetcode + 20), message: '奇迹！两年的厚积薄发终于开花结果，你的大模型推理架构论文被顶会 Oral 接收！老板大喜，带你去夏威夷顶会！' }
            : { age: s.age + 2, year: s.year + 2, is_phd: false, is_master: true, health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 15), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', message: '顶会再次惨遭拒稿！导师 Funding 彻底耗尽，系里启动学术委员会评估，建议你 Master Out 毕业找工作。' };
        },
        nextEventId: (s) => ((s.message || '').includes('夏威夷') ? 'phd_conference' : 'job_hunt')
      },
      {
        text: '【申请大厂研究实习】申请 Meta FAIR / Google DeepMind 做研究实习 (耗时 1 年)',
        effect: (s) => {
          const passProb = 0.40 + (s.leetcode >= 75 ? 0.30 : 0) + (s.school === 'cmu' ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { cash: s.cash + 6, health: Math.max(0, s.health - 6), age: s.age + 1, year: s.year + 1, is_phd: true, network: Math.min(100, (s.network || 10) + 15), leetcode: Math.min(100, s.leetcode + 15), message: '在顶尖 AI 工业界实验室实习收获满满！攒下了 $6w 实习薪水并发表了 Demo，回校顺利通过博士答辩 Defense，取得 PhD 学位！' }
            : { health: Math.max(0, s.health - 10), age: s.age + 1, year: s.year + 1, is_phd: true, leetcode: Math.min(100, s.leetcode + 10), message: '顶尖 Lab 实习申请竞争太激烈被刷，你只能回校继续给导师搬砖，好在靠常规课题勉强通过答辩取得 PhD 学位。' };
        },
        nextEventId: 'phd_job_hunt'
      },
      {
        text: '【二线期刊保底答辩】降低身段投中档期刊与 Workshop，申请博士答辩 (耗时 2 年)',
        effect: (s) => {
          const passProb = 0.70 + (s.leetcode >= 60 ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 8), is_phd: true, leetcode: Math.min(100, s.leetcode + 10), message: '你放下了追求顶会的执念，凭借多篇中档期刊论文和扎实成果顺利通过了博士答辩 Defense，成功获得 PhD 博士学位！' }
            : { age: s.age + 2, year: s.year + 2, is_phd: false, is_master: true, health: Math.max(0, s.health - 12), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', message: '答辩委员会认为你的成果缺乏独创性未予通过！心力交瘁的你选择不再延毕，拿硕士学位跑路求职。' };
        },
        nextEventId: (s) => s.is_phd ? 'phd_job_hunt' : 'job_hunt'
      },
      {
        text: '【Master Out 拿硕士跑路】看清学术圈内卷，不再延毕耗费青春，拿硕士跑路求职',
        effect: (s) => ({
          age: s.age + 1,
          year: s.year + 1,
          is_phd: false,
          is_master: true,
          health: Math.min(100, s.health + 15),
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)',
          message: '你不再为学术廉价劳动力买单，带着 CS 硕士学位进入硅谷人才市场！'
        }),
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
        text: '疯狂 Network，结识学术大牛与顶尖 Lab 负责人 (耗时 1 年顺利毕业答辩)',
        effect: (s) => ({ charm: Math.min(25, (s.charm || 10) + 5), age: s.age + 1, year: s.year + 1, health: Math.max(0, s.health - 8), is_phd: true, network: Math.min(100, (s.network || 10) + 20), leetcode: Math.min(100, s.leetcode + 20), message: '你成功给几位学术大佬与 OpenAI/Google 研究员留下了深刻印象。回到学校后顺利完成 Defense，拿到了沉甸甸的 PhD 学位！' }),
        nextEventId: 'phd_job_hunt'
      },
      {
        text: '去海滩冲浪放飞自我 (引起老板不满，延毕 1 年)',
        effect: (s) => ({ health: Math.min(100, s.health + 20), charm: Math.min(25, (s.charm || 10) + 5), age: s.age + 2, year: s.year + 2, is_phd: true, leetcode: Math.min(100, s.leetcode + 10), message: '你在海滩上玩疯了，没参加老板组织的组会。老板很生气，多留了你一年才放你毕业。' }),
        nextEventId: 'phd_job_hunt'
      }
    ]
  },

  'phd_job_hunt': {
    id: 'phd_job_hunt',
    title: '博士求职 (降维打击与分层抉择)',
    description: '顶着 PhD 博士光环，你进入了硅谷人才市场。这不再是一般的初级码农招聘，而是分层走向前沿科学家、顶级量化或大厂核心研发。',
    choices: [
      {
        text: '申请 OpenAI / Anthropic 核心研究员 (地狱面试, 年薪 $80w, O-1 签证)',
        reqBadge: '地狱级门槛',
        effect: (s) => {
          // Top 15%-25% elite path
          const winRate = 0.18 + (s.leetcode >= 85 ? 0.18 : 0.06) + (s.school === 'cmu' ? 0.10 : 0) + ((s.network || 10) >= 30 ? 0.08 : 0) + ((s.luck || 20) / 200);
          const win = gameRandom() < winRate;
          return win
            ? { tc: 80, cash: s.cash + 20, health: Math.max(0, s.health - 15), visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'openai', job_type: 'ai_research', level: 'MTS', message: '震撼硅谷！你攻克了 AGI 前沿推理大模型面试，OpenAI 直接用 $80w 顶配包裹和 O1 签证把你聘为核心研究员 (MTS)！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'google', job_type: 'big_tech', level: 'L4', message: 'OpenAI 核心研究员面试太残酷了！手撕 Triton 算子挂在最后一轮。不过顶级大厂看重你的博士背景，直接给出了 Google L4 SDE 研发岗位 (年薪 $32w)！' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '申请科技大厂 Applied Scientist (应用科学家, 年薪 $48w, O-1 签证)',
        reqBadge: '需扎实研究成果',
        effect: (s) => {
          const passProb = 0.50 + (s.leetcode >= 70 ? 0.20 : 0.05) + ((s.network || 10) >= 20 ? 0.10 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { tc: 48, cash: s.cash + 15, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'google', job_type: 'ai_research', level: 'L5 (Senior)', message: '大厂的科学家岗位待遇丰厚！不用写纯业务 CRUD，负责核心模型算法架构研发，享受 $48w 高额年薪与 O-1 签证！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'meta', job_type: 'big_tech', level: 'L4', message: '科学家岗位 Headcount 紧张未能入选，但 HR 迅速将你转入 Engineering 部门，以 L4 高级研发工程师录用 (年薪 $32w)！' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '大厂研发工程师保底入职 (免刷题内卷, 定级 L4 · 年薪 $32w)',
        effect: (s) => ({
          tc: 32,
          cash: s.cash + 6,
          company: 'google',
          job_type: 'big_tech',
          level: 'L4',
          visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)',
          message: '凭着博士沉淀的技术功底，你免去了一切内卷，直接以 L4 职级入职硅谷科技大厂，享受 $32w 丰厚起薪与舒适 WLB！'
        }),
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '冲击华尔街 Quant Researcher 量化研究员 (年薪 $60w + 高额奖金)',
        reqBadge: '需极高数理算法',
        effect: (s) => {
          const passProb = 0.25 + (s.leetcode >= 85 ? 0.25 : 0.05) + (s.school === 'cmu' ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { tc: 60, cash: s.cash + 25, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'citadel', job_type: 'quant', level: 'Quant', message: '华尔街顶级对冲基金抢夺学术英才！Citadel 开出 $60w 顶配待遇与高额提成，聘请你为量化研究员！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'google', job_type: 'big_tech', level: 'L4', message: 'Quant 脑筋急转弯与高频随机过程面试太硬核了！未能拿到 Offer，转而入职硅谷科技大厂 L4 研发。' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      }
    ]
  }
};
