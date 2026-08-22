import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear, isTemporaryOrStudentHousing , gameRandom, pickCollegeEvent, collegeNextStage, addImpact, deductAssets } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';
import { SCHOOL_PROFILES } from '../schoolProfiles';

export const initializationEvents: Record<string, GameEvent> = {
  'choose_trait': {
    id: 'choose_trait',
    title: '【天赋抉择】投胎十字路口与先天基因',
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
    title: '【难度选择】宏观周期与历史浪潮',
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
    title: '【求学之路】人生第一步与高校抉择',
    description: '恭喜你高中毕业！拿着家里的启动资金，你现在面临择校 Choice 的选择：',
    choices: [
      {
        text: SCHOOL_PROFILES.cmu.choiceText,
        costBadge: `花费 $${SCHOOL_PROFILES.cmu.tuition}w`,
        condition: (s) => s.cash >= SCHOOL_PROFILES.cmu.tuition,
        effect: (s) => ({ cash: Math.max(0, s.cash - SCHOOL_PROFILES.cmu.tuition), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'cmu', age: s.age, leetcode: s.leetcode + SCHOOL_PROFILES.cmu.leetcodeBonus, health: Math.max(0, s.health + (SCHOOL_PROFILES.cmu.healthDelta || 0)), housing_name: SCHOOL_PROFILES.cmu.defaultHousing, message: SCHOOL_PROFILES.cmu.enrollMessage }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: SCHOOL_PROFILES.ucb.choiceText,
        costBadge: `花费 $${SCHOOL_PROFILES.ucb.tuition}w`,
        condition: (s) => s.cash >= SCHOOL_PROFILES.ucb.tuition,
        effect: (s) => ({ cash: Math.max(0, s.cash - SCHOOL_PROFILES.ucb.tuition), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'ucb', age: s.age, leetcode: s.leetcode + SCHOOL_PROFILES.ucb.leetcodeBonus, network: Math.min(100, (s.network || 10) + (SCHOOL_PROFILES.ucb.networkBonus || 0)), housing_name: SCHOOL_PROFILES.ucb.defaultHousing, message: SCHOOL_PROFILES.ucb.enrollMessage }),
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: SCHOOL_PROFILES.state.choiceText,
        costBadge: `花费 $${SCHOOL_PROFILES.state.tuition}w (美籍/绿卡 $${SCHOOL_PROFILES.state.inStateTuition}w)`,
        condition: (s) => s.cash >= ((s.visa === '公民' || s.visa === '绿卡') ? (SCHOOL_PROFILES.state.inStateTuition || 4) : SCHOOL_PROFILES.state.tuition),
        effect: (s) => {
          const cost = (s.visa === '公民' || s.visa === '绿卡') ? (SCHOOL_PROFILES.state.inStateTuition || 4) : SCHOOL_PROFILES.state.tuition;
          return { cash: Math.max(0, s.cash - cost), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', has_us_degree: true, school: 'state', age: s.age, charm: s.charm + (SCHOOL_PROFILES.state.charmBonus || 0), network: Math.min(100, (s.network || 10) + (SCHOOL_PROFILES.state.networkBonus || 0)), health: Math.min(100, s.health + (SCHOOL_PROFILES.state.healthDelta || 0)), housing_name: SCHOOL_PROFILES.state.defaultHousing, message: SCHOOL_PROFILES.state.enrollMessage };
        },
        nextEventId: 'us_undergrad_year1',
      },
      {
        text: SCHOOL_PROFILES.cn.choiceText,
        costBadge: `花费 $${SCHOOL_PROFILES.cn.tuition}w`,
        effect: (s) => ({ cash: Math.max(0, s.cash - SCHOOL_PROFILES.cn.tuition), school: 'cn', leetcode: s.leetcode + SCHOOL_PROFILES.cn.leetcodeBonus, health: Math.min(100, s.health + (SCHOOL_PROFILES.cn.healthDelta || 0)), housing_name: SCHOOL_PROFILES.cn.defaultHousing }),
        nextEventId: 'cn_college_grad',
      },
      {
        text: '【非科班 · 半路转码】读的不是 CS(生化环材 / 文社科 / 金融…)，决心转码入行 (硬开局)',
        // +4 岁:先念完 4 年非 CS 本科(与正常本科 18→22 的年龄推进对齐;年份同本科约定不变动)。
        effect: (s) => ({ age: s.age + 4, leetcode: Math.max(0, s.leetcode - 2), charm: Math.min(s.max_charm ?? 25, s.charm + 2), story_flags: { ...(s.story_flags || {}), non_cs_background: true }, message: '你花了四年念完一个非计算机专业，毕业在即，看着同学们纷纷转码进大厂拿高薪，你也咬牙决定投身这场逆袭。' }),
        nextEventId: 'zhuanma_background',
      }
    ]
  },

  // ============================ 转码 On-Ramp (非科班逆袭) ============================
  'zhuanma_background': {
    id: 'zhuanma_background',
    title: '【转码起点】非 CS 本科学历与跑毒背景',
    description: '半路转码，起点决定了你能走哪几条路。美本非科班已经在美国、身份灵活;陆本非科班没有美国学位，基本只能靠一个 CS 美硕来美上岸——但那也意味着最硬核的逆袭。',
    choices: [
      {
        text: '【美本非CS】已在美国读了个非 CS 本科 (F1/OPT),沉没成本已付，可就地转码',
        effect: (s) => ({
          has_us_degree: true,
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
          story_flags: { ...(s.story_flags || {}), non_cs_background: true, zhuanma_origin: 'us' },
          message: '你在美国读了个非 CS 专业，毕业在即才幡然醒悟，决心就地转码上岸。',
        }),
        nextEventId: 'zhuanma_decision',
      },
      {
        text: '【陆本非CS】国内非 CS 本科，无美国学位，只能搏一个 CS 美硕来美 (全游戏最硬开局)',
        effect: (s) => ({
          story_flags: { ...(s.story_flags || {}), non_cs_background: true, zhuanma_origin: 'cn' },
          message: '你在国内读了个非 CS 专业，决心砸锅卖铁读个美国 CS 硕士，一步登天转码来美。',
        }),
        nextEventId: 'zhuanma_decision',
      },
    ],
  },

  'zhuanma_decision': {
    id: 'zhuanma_decision',
    title: '【转码破局】跨专业转码的三条路线抉择',
    description: 'Bootcamp 速成快而险、CS 美硕贵而稳、纯自学最省最难。掂量一下自己的钱包、时间与毅力。',
    choices: [
      {
        text: '【Bootcamp 速成训练营】3-6 个月速成刷题，快但 signal 弱、上岸看运气 (花费 $2w)',
        reqBadge: '美本非CS 专属',
        condition: (s) => s.story_flags?.zhuanma_origin === 'us' && s.cash >= 2,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 2),
          leetcode: Math.min(100, s.leetcode + 25),
          health: Math.max(0, s.health - 5),
          age: s.age + 1,
          story_flags: { ...(s.story_flags || {}), zhuanma_method: 'bootcamp' },
          message: '你报了个硅谷知名 Bootcamp,3 个月魔鬼刷题速成，项目作品集堆了一堆，准备海投！',
        }),
        nextEventId: 'zhuanma_apply',
      },
      {
        text: '【CS 美硕 · 洗背景】读个正经 CS 硕士，贵且慢，但学历直接洗白非科班 (花费 $10w · 可股票抵扣)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 10,
        effect: (s) => {
          const paid = deductAssets(s, 10);
          return {
            ...paid,
            has_us_degree: true,
            visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
            story_flags: { ...(s.story_flags || {}), zhuanma_method: 'ms' },
            message: '你决定读一个正经 CS 硕士，用学历彻底洗白非科班背景——虽然贵，但这是最稳的上岸路。',
          };
        },
        nextEventId: 'us_master_year1',
      },
      {
        text: '【纯自学 + 疯狂刷题】边打工边自学，最省钱但最熬人、最看毅力与运气 (几乎免费)',
        reqBadge: '美本非CS 专属',
        condition: (s) => s.story_flags?.zhuanma_origin === 'us',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 2),
          leetcode: Math.min(100, s.leetcode + 20),
          health: Math.max(0, s.health - 12),
          age: s.age + 2,
          story_flags: { ...(s.story_flags || {}), zhuanma_method: 'self' },
          message: '你白天搬砖、深夜刷题，啃完了几十本算法书与无数 LeetCode Hard，咬牙自学转码。',
        }),
        nextEventId: 'zhuanma_apply',
      },
      {
        text: '【陆本无美硕预算，先回国互联网卷】攒够钱/背景再图后计 (暂缓转码)',
        condition: (s) => s.story_flags?.zhuanma_origin === 'cn' && (s.cash + (s.stocks || 0)) < 10,
        effect: (s) => ({
          job_type: 'cn_tech',
          company: 'cn_big_tech',
          level: 'L3',
          tc: 20,
          story_flags: { ...(s.story_flags || {}), zhuanma_method: 'cn_defer' },
          message: '预算不够读美硕，你只能先回国内大厂卷着攒钱，把转码来美的梦想暂时压在心底。',
        }),
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'),
      },
    ],
  },

  'zhuanma_apply': {
    id: 'zhuanma_apply',
    title: '【转码首战】海投狂潮与 Onsite 车轮战',
    description: '非科班简历、无实习、年龄还比应届生大——你顶着 HR 的挑剔目光，开始了地狱级的海投与 Onsite 车轮战。能不能上岸，就看这一搏了。',
    choices: [
      {
        text: '【背水一战 · 疯狂海投 + 全力 Onsite】赌上一切拿下人生第一个 SWE offer',
        effect: (s) => {
          const attempts = Number(s.story_flags?.zhuanma_attempts || 0);
          // 转码首战上岸率(每次尝试):非科班门槛高,故基数低 + 算法/运气加成 − 年龄歧视(复用 35 岁拐点)。
          // 自学 signal 略高于 bootcamp。配合最多 3 次重试(每次再刷 +10 算法),目标 competent
          // 玩家累计上岸 ~60-75%(即 washout 25-40%),让"逆袭"有真实翻车风险。
          const methodBonus = s.story_flags?.zhuanma_method === 'self' ? 0.03 : 0;
          const ageMalus = s.age >= 35 ? Math.min(0.18, (s.age - 35) * 0.015) : 0;
          const prob = Math.max(0.08, Math.min(0.6, 0.12 + (s.leetcode / 320) + ((s.luck || 20) / 500) + methodBonus - ageMalus));
          if (gameRandom() < prob) {
            // 上岸:非科班先够得着初创/中型公司(Top100 档),日后再跳。
            const lvl = s.is_phd ? 'L4' : 'L3';
            return {
              job_type: 'startup',
              company: 'startup',
              level: lvl,
              tc: getLevelScaledTC(16, lvl),
              laid_off: false,
              story_flags: { ...(s.story_flags || {}), zhuanma_landed: true },
              message: `【上岸！非科班逆袭成功】历经数十场 Onsite 车轮战，你终于拿到了人生第一个 SWE offer (定级 ${lvl})！非科班的你，正式踏进了梦寐以求的码农大军！`,
            };
          }
          return {
            health: Math.max(0, s.health - 6),
            story_flags: { ...(s.story_flags || {}), zhuanma_attempts: attempts + 1 },
            message: '【全军覆没】几十份简历石沉大海，少数几场 Onsite 也惨遭挂经。非科班的门槛比想象中更高，你有些心力交瘁……',
          };
        },
        nextEventId: (s) => s.story_flags?.zhuanma_landed
          ? (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life')
          : 'zhuanma_setback',
      },
    ],
  },

  'zhuanma_setback': {
    id: 'zhuanma_setback',
    title: '【转码受挫】再搏一次还是认清现实',
    description: '第一轮全挂了。要不要再花一年沉淀技术、明年再战?还是承认自己不适合、及时止损?',
    choices: [
      {
        text: '【再刷一年题，明年再战】沉淀技术、打磨项目，东山再起 (age +1)',
        condition: (s) => Number(s.story_flags?.zhuanma_attempts || 0) < 3 && s.health > 15,
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 10),
          health: Math.max(0, s.health - 5),
          cash: Math.max(0, s.cash - 2),
          age: s.age + 1,
          message: '你把挂经一场场复盘，系统设计与算法又精进了一大截，憋着一口气准备明年卷土重来！',
        }),
        nextEventId: 'zhuanma_apply',
      },
      {
        text: '【认清现实，退出转码】耗尽了积蓄与心气，你决定止损，告别这场逆袭梦',
        condition: (_s) => true,
        effect: (s) => ({
          status: 'game_over',
          story_flags: { ...(s.story_flags || {}), zhuanma_washout: true },
          message: '几轮下来积蓄见底、心气耗尽，你最终承认转码这条路太难了。你带着遗憾退出了这场逆袭——但重开的机会永远都在。',
        }),
        nextEventId: 'end',
      },
    ],
  },

  'cn_college_grad': {
    id: 'cn_college_grad',
    title: '【大学前期】百团大战与多维探索',
    description: '进入了国内大学，开学百团大战，各种社团、比赛与创业社招新。你打算如何安排这最初的两年？',
    choices: [
      {
        text: '【ACM 算法集训】加入 ACM 集训队 (死磕算法与硬核代码)',
        effect: (s) => ({ leetcode: s.leetcode + 15, health: s.health - 15, age: s.age + 2, message: '天天在机房死磕图论与动态规划，算法能力大幅提升！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【金融创投比赛】参加全国大学生商业创投挑战赛',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(s.max_charm ?? 25, s.charm + 6), luck: Math.min(99, s.luck + 4), age: s.age + 2, message: '商业计划书打动了校外评委，拿到了创业鼓励金与名企实习推荐！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【文娱自媒体】担任社团主唱 / 运营大学生活 VLOG',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 8), cash: s.cash + 0.8, health: Math.min(100, s.health + 5), age: s.age + 2, message: '你的网游/校园 VLOG 在 B站和小红书小火，涨粉数千并吸引了不少粉丝打赏！两年时光悄然流逝。' }),
        nextEventId: () => ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'][Math.floor(gameRandom() * 4)],
      },
      {
        text: '【学生会外联】加入学生会与外联部 (人脉路线)',
        // Repurposed into the NETWORK play (was strictly dominated by 文娱自媒体: same
        // charm+8 but worse cash & health, and 0 network despite "结识一圈朋友").
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 4), network: Math.min(100, (s.network || 10) + 12), health: s.health - 5, age: s.age + 2, message: '你在学生会拉赞助、办活动混得风生水起，攒下了一张厚实的校园人脉网。两年时光悄然流逝。' }),
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
        text: '【战术秒关电脑】迅速关灯藏起电脑，假装在背四六级单词',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '无惊无险！辅导员夸赞你们宿舍学习氛围浓厚，安然度过查寝！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '【理直气壮硬刚】硬刚：“我们这是在做计算机图形学与网络抓包实训！”',
        effect: (s) => {
          const pass = s.leetcode >= 20 || gameRandom() < 0.5;
          return pass
            ? { charm: Math.min(s.max_charm ?? 25, s.charm + 4), message: '你的专业术语把辅导员说蒙了，居然逃过一劫还顺手完成了抓包实验！' }
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
        text: '【冷静手推复杂度】冷静打印 Code，用笔手写推导复杂度 (与 Sam 并肩死磕)',
        effect: (s) => ({
          leetcode: s.leetcode + 8,
          npcs: {
            ...(s.npcs || {}),
            sam: { name: '极客 Sam', role: 'co_founder', status: 'ally', note: '硬核黑客与全栈极客，ACM 战友' }
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
        text: '【狂换算法重构】狂换算法！重写线段树数据结构',
        effect: (s) => {
          const win = gameRandom() < 0.45 + (s.leetcode / 200);
          return win
            ? {
                leetcode: s.leetcode + 12,
                cash: s.cash + 0.5,
                npcs: {
                  ...(s.npcs || {}),
                  sam: { name: '极客 Sam', role: 'co_founder', status: 'ally', note: '硬核黑客与全栈极客，ACM 战友' }
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
        text: '【详实财报答辩】用详实的财报模型与用户 LTV 数据沉着应对',
        effect: (s) => ({ cash: s.cash + 1.2, charm: Math.min(s.max_charm ?? 25, s.charm + 6), message: ' 斩获金奖！评委大赞你的商业逻辑极具实战价值，当场颁发了 $1.2w 比赛项目奖金！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '【情怀故事宣讲】临场发挥讲述情怀故事，拉满现场演讲感染力',
        // "结识多位投资界大咖" now grants network (was luck only — flavor/effect mismatch).
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 5), network: Math.min(100, (s.network || 10) + 8), message: '全场响起热烈掌声！拿下了最佳台风奖，并在场外结识了多位投资界大咖！' }),
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
        text: '【顺水推舟加微信】顺水推舟互加微信，约对方周末去逛街看电影',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 6), health: Math.min(100, s.health + 10), relationship_status: 'dating', message: '极速脱单！你们聊得无比投机，顺理成章确立了热恋关系 (Dating)！' }),
        nextEventId: 'cn_college_year3',
      },
      {
        text: '【硬核直男讲题】高冷解答：“这道题用拉格朗日中值定理即可，不必客气”',
        effect: (s) => ({ leetcode: s.leetcode + 5, charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你保持了高冷做题家的尊严！虽然错过了恋爱，但对方直呼你是“解题考霸”！' }),
        nextEventId: 'cn_college_year3',
      }
    ]
  },

  'cn_college_year3': {
    id: 'cn_college_year3',
    title: '【大三抉择】保研、秋招与留学十字路口',
    description: '大三了，周围人都在考研、秋招、准备出国或直接创业。你的室友托福连挂三次，气氛格外紧张。',
    choices: [
      {
        text: '【出国留学备战】报班死磕托福/GRE (准备申请美国 CS 硕士)',
        // The GRE/TOEFL grind now yields real stats (charm from English + leetcode from
        // study) so it isn't a strict subset of the 秋招/实习 options (was cash-2/health-10
        // with zero gain, actively weakening the abroad-gates it claimed to prepare).
        effect: (s) => ({ cash: Math.max(0, s.cash - 2), leetcode: Math.min(100, s.leetcode + 6), charm: Math.min(s.max_charm ?? 25, s.charm + 4), health: s.health - 8, age: s.age + 2, message: '你死磕托福/GRE 和口语，不仅考出了满意的分数，英语表达与学术功底也大幅提升，顺利完成大三大四学业！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【提前批次秋招】冲击国内大厂提前批开发岗 Offer',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 10, age: s.age + 2, message: '凭着扎实的算法手撕，提前斩获了国内大厂的 SSP 保底 Offer！顺利从本科毕业！' }),
        nextEventId: 'cn_undergrad_grad',
      },
      {
        text: '【金融咨询实习】投递顶级外企咨询与券商行研实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(s.max_charm ?? 25, s.charm + 6), health: s.health - 8, age: s.age + 2, message: '获得了极佳的金融行研锻炼，简历含金量大增！顺利从本科毕业！' }),
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
    title: '【本科毕业】走出象牙塔与未来去向',
    description: '四年过去了，你顺利从美国大学毕业，目前持有 OPT。现在是找工作还是继续深造？',
    imageUrl: 'images/stanford_graduation.jpg',
    choices: [
      {
        text: '【申请北美顶尖 PhD】追求学术殿堂与科研圣杯 (录取率低 · 需 LeetCode >= 50 或学术积淀)',
        reqBadge: '全奖直博 / 需 LeetCode >= 50',
        condition: (s) => s.leetcode >= 50 || (s.impact || 0) >= 10,
        effect: (s) => {
          const pass = s.is_phd || (gameRandom() < (0.20 + (s.school === 'cmu' ? 0.20 : 0) + ((s.impact || 0) >= 10 ? 0.15 : 0) + (s.leetcode >= 80 ? 0.15 : 0) + (s.story_flags?.phd_ready ? 0.15 : 0)));
          return pass 
            ? { cash: s.cash + 2, age: s.age + 1, year: s.year + 1, is_phd: true, housing_name: '美国 博士实验室', message: '大喜讯！凭借扎实的科研积淀与过硬的算法功底，你战胜了数千名申请者，斩获北美顶级 CS 全奖 PhD Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, year: s.year + 1, is_phd: false, message: '今年 CS 顶校 PhD 全奖录取率极低，你的推荐信与论文被审稿人刷了，惨遭拒信。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'job_hunt',
      },

      {
        text: '【直接找工作】全美开启大厂校招与社招海投',
        reqBadge: '激活 OPT 实习期',
        // (Removed a dead `year === 2020` pandemic branch: year is frozen during
        // school so it could never fire. Graduation now cleanly activates OPT.)
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)',
          leetcode: s.leetcode + 10,
          message: '【本科毕业】顺利斩获世界名校学士学位并激活 OPT 实习签证！你带着满满的干劲投身硅谷大厂校招求职！'
        }),
        nextEventId: (s) => s.visa === 'F1 (学生)' ? 'us_undergrad_grad' : 'job_hunt',
      },
      {
        text: '【申请大U硕士】刷题进厂预备役，避避风头',
        costBadge: '学费 $10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({
          cash: s.cash - 10,
          is_master: true,
          has_us_degree: true,
          housing_name: '美硕 校外公寓',
          age: s.age,
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
          message: '你决定去读个硕士提升一下学历，顺利开启美硕生涯！'
        }),
        nextEventId: 'us_master_year1',
      }
    ]
  },

  'cn_undergrad_grad': {
    id: 'cn_undergrad_grad',
    title: '【国内毕业】走出象牙塔与赴美抉择',
    description: '四年过去了，你在国内大学打下了坚实的代码基础。接下来去哪里？',
    choices: [
      {
        text: '【全奖直博美国】地狱级硬核申请 (录取率地狱级 · 需 LeetCode >= 50 或学术成果)',
        reqBadge: '全奖直博 / 需 LeetCode >= 50',
        condition: (s) => s.leetcode >= 50 || (s.impact || 0) >= 10,
        effect: (s) => {
          const pass = gameRandom() < (0.18 + ((s.impact || 0) >= 10 ? 0.15 : 0) + (s.leetcode >= 80 ? 0.20 : 0));
          return pass
            ? { cash: s.cash + 2, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', age: s.age + 1, year: s.year + 1, is_phd: true, housing_name: '美国 博士实验室', message: '奇迹！凭着陆本顶尖学术成果与算法功底，你跨海斩获了美国 CS 全奖直博 Offer！' }
            : { health: Math.max(0, s.health - 15), age: s.age + 1, year: s.year + 1, is_phd: false, message: '美国顶尖博士项目全墨！因为没有美本强推被卡，只能转投国内大厂或申请水硕。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'cn_work',
      },

      {
        text: '【自筹申请美国 CS 硕士】自筹资金读正统美硕 (积蓄 $5w 即可申请)',
        costBadge: '花费 $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({
          cash: s.cash - 5,
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
          school: 'state',
          has_us_degree: true,
          age: s.age,
          is_master: true,
          housing_name: '美硕 校外公寓',
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
        }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【无抵押留学贷款 + TA 助教】申请美国 CS 硕士，自力更生逆袭 (需评估算法/背景)',
        costBadge: '首期 $2w',
        reqBadge: '需算法与 GPA 评估',
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
              story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
              message: ' 申请成功！凭借扎实的本科算法基础与良好的背景，你成功获得了无抵押留学贷款与校内 TA 助教资格！' 
            };
          } else {
            return { 
              health: s.health - 10, 
              message: ' 申请被拒！银行与校方审核认为你的本科 GPA/算法基础不足，无抵押贷款被驳回！你只能选择在国内打工攒钱或自筹资金。' 
            };
          }
        },
        nextEventId: (s: GameState) => s.is_master ? 'us_master_year1' : 'cn_work',
      },
      {
        text: '【国内大厂打工攒钱】先在国内大厂打工攒钱积累工作经验',
        reqBadge: '起薪 $8w',
        effect: (s) => ({
          cash: s.cash + 2.5,
          health: Math.max(30, s.health - 12),
          tc: 8,
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '国内研发',
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '无',
          laid_off: false,
          age: s.age + 1,
          year: s.year + 1,
          housing_name: '国内 厂区单间',
          message: '你入职了国内一线互联网大厂，开启了打工攒钱与积累硬核算法经验的职场生涯。'
        }),
        nextEventId: 'cn_work',
      }
    ]
  },

  'us_undergrad_year1': {
    id: 'us_undergrad_year1',
    title: '【初入北美】文化冲击与多元探索',
    description: '刚来北美，你对一切都很新奇。你决定怎么度过最初的两年？',
    choices: [
      {
        text: '【硬核刷题】泡在图书馆死磕 GPA 和算法',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 5, age: s.age + 2, message: '每天和电脑作伴，代码实力突飞猛进！两年时光弹指一挥间。' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【量化金融】加入校内量化/学生投资俱乐部 (Quant & Trading Club)',
        effect: (s) => ({ cash: s.cash + 1.5, charm: Math.min(s.max_charm ?? 25, s.charm + 5), network: Math.min(100, (s.network || 10) + 4), health: s.health - 3, age: s.age + 2, message: '在模拟盘实盘操作中大获全胜，赚到了第一笔金融交易收益，还结识了一圈金融圈同好！两年时光弹指一挥间。' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【竞技体育】加入校队竞技体育 (网球/抱石/橄榄球)',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(s.max_charm ?? 25, s.charm + 5), network: Math.min(100, (s.network || 10) + 4), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '高强度体育训练拉满！体能与气场全面大爆发，还和队友结下了铁哥们儿情谊！两年时光弹指一挥间。' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【文娱社团】组建校园摇滚乐队举办草坪音乐节 (颜值路线)',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 8), network: Math.min(100, (s.network || 10) + 5), health: Math.min(100, s.health + 5), cash: Math.max(0, s.cash - 1), age: s.age + 2, message: '你在音乐节上作为主唱震撼全场，成为了校园里的风云人物！两年时光弹指一挥间。' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【兄弟会社交】加入兄弟会/姐妹会 (Frat Party 人脉路线)',
        condition: (s) => s.cash >= 2,
        // Differentiated from 文娱 (charm route) into the NETWORK specialist: big
        // social capital + luck, at a real health/cash cost. Was strictly dominated
        // by 文娱 (same charm+8 but worse on every other axis) and, ironically,
        // granted 0 network despite its "认识一堆校友" flavor.
        effect: (s) => ({ cash: s.cash - 2, charm: Math.min(s.max_charm ?? 25, s.charm + 4), network: Math.min(100, (s.network || 10) + 14), luck: Math.min(99, s.luck + 3), health: Math.max(0, s.health - 8), age: s.age + 2, message: '每周 Party，在啤酒乒乓桌上认识了一堆富二代与校友大佬，攒下了一张厚厚的人脉网！两年时光弹指一挥间。' }),
        nextEventId: pickCollegeEvent,
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
        text: '【硬核优化 Agent 调度】紧急接入 Claude/Cursor 重新优化 Agent 调度层 (硬核技术攻坚)',
        effect: (s) => ({
          leetcode: s.leetcode + 12,
          cash: s.cash + 1.5,
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'mentor', status: 'ally', note: '黑客松伯乐，Stanford AI 先锋' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            met_alex: true,
            alex_meet_year: s.year
          },
          message: '【逆天夺冠】你们的 AI Agent 演示震撼全场，主评委 Alex 博士对你的技术架构赞不绝口，主动加你微信/LinkedIn 并颁发了 $1.5w 冠军奖金！'
        }),
        nextEventId: collegeNextStage,
      },
      {
        text: '【精致 Demo 视觉致胜】砍掉复杂并发功能，专注于写精致的前端 Demo 与 PPT 演示',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, s.charm + 5),
          cash: s.cash + 0.5,
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', status: 'active', note: '大厂总监，极度看重汇报与PPT' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            met_dave: true,
            dave_meet_year: s.year
          },
          message: '【最佳人气奖】大厂总监 Dave 对你的产品汇报与 PPT 演示极为满意，夸赞你具备“大厂管理层潜质”，现场给你发了名片！'
        }),
        nextEventId: collegeNextStage,
      }
    ]
  },

  'college_gpa_crisis': {
    id: 'college_gpa_crisis',
    title: '【校园突发】地狱级 Hard 课 (Curves 打分)',
    description: '教授出了地狱级期末试题，全班平均分只有 35 分！曲线打分决定你的 GPA 生死。',
    choices: [
      {
        text: '【通宵死磕反证法】通宵翻阅经典教材，用反证法完美解答压轴题',
        effect: (s) => ({ leetcode: s.leetcode + 10, health: s.health - 8, message: '教授被你的硬核推导折服，期末单科拿到 A+！' }),
        nextEventId: collegeNextStage,
      },
      {
        text: '【找学霸室友抱大腿】找学霸室友通宵抱大腿，共同解出作业与例题',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: s.health + 2, message: '成功靠团队协作渡过难关，保住了 3.8+ 的优异 GPA！' }),
        nextEventId: collegeNextStage,
      }
    ]
  },

  'college_business_pitch': {
    id: 'college_business_pitch',
    title: '【校园突发】校内商业 Pitch 创投大赛',
    description: '在校园创投大赛上，你面对几位来自硅谷沙丘路 (Sand Hill Road) VC 的合伙人展示商业模型推介！',
    choices: [
      {
        text: '【严谨财务模型】用严谨的财务模型与用户增长曲线征服投资人',
        effect: (s) => ({ cash: s.cash + 2, charm: Math.min(s.max_charm ?? 25, s.charm + 5), message: ' 拿到种子轮支票！VC 现场为你开出了 $2w 创业启动扶持资金！' }),
        nextEventId: collegeNextStage,
      },
      {
        text: '【动人愿景故事】讲出动人的愿景故事，拉满现场演示舞台感染力',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 6), luck: Math.min(99, s.luck + 5), message: '全场爆发出欢呼！虽然没要投资，但结识了一圈顶级投资圈高管人脉！' }),
        nextEventId: collegeNextStage,
      }
    ]
  },

  'college_spring_gala': {
    id: 'college_spring_gala',
    title: '【校园突发】春季草坪音乐节与后台偶遇',
    description: '春季草坪音乐节盛大开启！作为音乐节吉他手演完后，你在后台擦汗时遇到了一位赞赏你琴技的心动同学...',
    choices: [
      {
        text: '【主动邀约 Boba 奶茶】主动邀请对方去饮品店喝 Boba 奶茶交流音乐',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 6), health: Math.min(100, s.health + 10), relationship_status: 'dating', message: '恋爱甜度拉满！你们越聊越投机，顺理成章确立了热恋关系 (Dating)！' }),
        nextEventId: collegeNextStage,
      },
      {
        text: '【礼貌道谢奔向机房】礼貌道谢：“谢谢夸奖，我还要去机房调代码”',
        effect: (s) => ({ leetcode: s.leetcode + 5, charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '高冷风范！你潇洒地背起吉他走向机房，成为了传说中的冷酷吉他手！' }),
        nextEventId: collegeNextStage,
       }
     ]
   },

   'college_dorm_roommate': {
     id: 'college_dorm_roommate',
     title: '【校园突发】宿舍室友的显卡矿场',
     description: '你的印度室友 Raj 半夜偷偷用宿舍电费跑 6 张 4090 挖矿/训模型，房间热得像桑拿房，跳闸把你的作业进度也搞没了。',
     choices: [
       {
         text: '【入伙搞算力租赁】跟他摊牌，顺便入伙一起搞算力租赁小生意',
         effect: (s) => ({ cash: s.cash + 1.5, network: Math.min(100, (s.network || 10) + 8), health: Math.max(0, s.health - 5), message: '你俩一拍即合，把矿机改成给同学跑深度学习作业的算力出租，赚到了第一桶创业小钱，还结识了一票 CS 人脉！' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【果断投诉更换宿舍】果断投诉换宿舍，眼不见心不烦专心学习',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 8), charm: Math.max(0, s.charm - 1), message: '你搬进了安静的单人间，虽然得罪了 Raj，但清净的环境让你的 GPA 和刷题效率直线上升！' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_road_trip': {
     id: 'college_road_trip',
     title: '【校园突发】春假 1 号公路自驾',
     description: '春假到了！室友们租了辆车，喊你一起沿加州 1 号公路自驾去 LA / 拉斯维加斯浪一圈。可是下周就是期中考。',
     choices: [
       {
         text: "【加州公路自驾】青春就该疯一把！Let's go 开启加州 1 号公路自驾",
         condition: (s) => s.cash >= 1,
         effect: (s) => ({ cash: Math.max(0, s.cash - 1), health: Math.min(100, s.health + 12), charm: Math.min(s.max_charm ?? 25, s.charm + 6), luck: Math.min(99, s.luck + 3), message: '17 英里海岸、比克斯比大桥、赌城霓虹……你拍了一路大片，身心彻底放松，还和同行的朋友结下了铁哥们儿情谊！' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【留守图书馆刷绩点】忍痛留守图书馆，稳住绩点要紧',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 3), message: '当别人在赌城蹦迪时，你刷完了整本算法导论习题。期中考你稳居年级前列，但错过了青春限定的疯狂。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_internship_grind': {
     id: 'college_internship_grind',
     title: '【校园突发】大二逆袭抢到大厂实习',
     description: '你竟然在大二就海投中了一个硅谷大厂的暑期实习 Offer！Mentor 暗示：好好干，转正 Return Offer 有戏。',
     choices: [
       {
         text: '【玩命卷实习】玩命卷这个实习，冲刺 Return Offer',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 12), cash: s.cash + 2, health: Math.max(0, s.health - 12), network: Math.min(100, (s.network || 10) + 5), message: '你超额完成了实习项目并成功上线，拿到了梦寐以求的转正 Return Offer 意向，简历含金量拉满！但连续加班让你透支不少。' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【带薪学习免费三餐】带薪学习，享受大厂免费三餐与健身房',
         effect: (s) => ({ cash: s.cash + 2, health: Math.min(100, s.health + 8), charm: Math.min(s.max_charm ?? 25, s.charm + 4), message: '你摸鱼薅满了大厂福利，健身房练出腹肌、food truck 吃到扶墙，虽然没冲转正，但过了个神仙暑假！' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_heartbreak': {
     id: 'college_heartbreak',
     title: '【校园突发】异地恋的最后一通电话',
     description: '交往了两年的对象在电话那头说：“我们……还是算了吧。太平洋两岸的时差和距离，我撑不住了。” 你在深夜的宿舍楼道里久久没能说出话。',
     choices: [
       {
         text: '【化悲愤为代码】化悲愤为代码，把自己埋进 GitHub 和图书馆',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 15), health: Math.max(0, s.health - 8), relationship_status: 'single', message: '接下来的三个月你 commit 了上千次，用一个个绿格子填满了空虚。失恋让你痛，却也把你锤炼成了刷题机器。' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【Tahoe 滑雪散心】和朋友去 Tahoe 滑雪散心，好好告别这段感情',
         condition: (s) => s.cash >= 1,
         effect: (s) => ({ cash: Math.max(0, s.cash - 1), health: Math.min(100, s.health + 12), charm: Math.min(s.max_charm ?? 25, s.charm + 3), relationship_status: 'single', luck: Math.min(99, s.luck + 3), message: '雪山、篝火、朋友的陪伴，让你慢慢放下。你明白了成年人的告别，也更懂得了照顾自己。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_health_scare': {
     id: 'college_health_scare',
     title: '【校园突发】Red Bull 猝倒进急诊',
     description: '连续通宵赶 due 加灌了五罐 Red Bull 后，你在机房心悸眼前发黑，被同学送进了校医院急诊。医生严肃警告你：再这么熬，命都要没了。',
     choices: [
       {
         text: '【听劝规律养生】听劝！从此规律作息、健身养生',
         effect: (s) => ({ health: Math.min(100, s.health + 15), leetcode: Math.max(0, s.leetcode - 3), luck: Math.min(99, s.luck + 3), message: '你痛定思痛，办了健身房卡、戒了通宵。虽然刷题时间少了点，但你养成了受用一生的健康习惯，这才是长期主义。' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【休息两天继续爆肝】休息两天又满血复活，继续爆肝冲绩点',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 10), message: '你把医生的话当耳旁风，缓了两天又回到了机房。GPA 是保住了，但你的身体亮起了红灯……年轻人，悠着点。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_side_gig': {
     id: 'college_side_gig',
     title: '【校园突发】课余打工赚生活费',
     description: '生活费有点紧，你决定找份课余兼职补贴一下。摆在你面前有两个选择。',
     choices: [
       {
         text: '【担任 CS 课程助教】当 CS 课程助教 / 私教补习 (体面又对口)',
         effect: (s) => ({ cash: s.cash + 1.5, leetcode: Math.min(100, s.leetcode + 8), charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '你成了热门算法课的 TA，一边讲题一边把知识点吃得更透，还被教授记住了名字，简历又添一笔！' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【课后跑外卖送餐】下课就跑 DoorDash / Uber Eats 送外卖 (纯体力赚快钱)',
         effect: (s) => ({ cash: s.cash + 2, health: Math.max(0, s.health - 6), luck: Math.min(99, s.luck + 2), message: '你风里来雨里去送了一学期外卖，虽然累，但钱包鼓了，也算把湾区的大街小巷跑熟了。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_culture_shock': {
     id: 'college_culture_shock',
     title: '【校园突发】第一个感恩节',
     description: '感恩节假期，宿舍楼空了大半，本地同学都回家过节。你的美国室友热情地邀请你去他家吃火鸡大餐，可你有点社恐，也担心英语跟不上。',
     choices: [
       {
         text: '【赴约美式聚会】大方赴约，硬着头皮融入美式家庭聚会',
         effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 8), network: Math.min(100, (s.network || 10) + 6), health: Math.min(100, s.health + 3), message: '一开始磕磕巴巴，后来你用一手正宗麻婆豆腐征服了全家人。口语突飞猛进，还收获了一个把你当家人的美国朋友圈！' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【约中国同学煮火锅】婉拒，约上中国同学在家煮火锅打游戏',
         effect: (s) => ({ health: Math.min(100, s.health + 10), leetcode: Math.min(100, s.leetcode + 4), message: '热气腾腾的火锅、熟悉的乡音、通宵的黑神话，让你在异国他乡找到了归属感。舒适圈虽小，却很治愈。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'college_viral_moment': {
     id: 'college_viral_moment',
     title: '【校园突发】一条推文半夜爆火',
     description: '你随手发的一条吐槽“湾区码农悲惨生活”的段子/AI 梗图在 X (Twitter) 和小红书上一夜爆火，涨粉几万，连科技大 V 都转发了！',
     choices: [
       {
         text: '【接广告专栏变现】趁热接广告、开付费专栏，把流量变现',
         effect: (s) => ({ cash: s.cash + 2, charm: Math.min(s.max_charm ?? 25, s.charm + 6), luck: Math.min(99, s.luck + 5), message: '你顺势做起了自媒体，接了几单科技公司的软广，还开了付费社群。虽然有点耽误学习，但你尝到了“个人 IP”的甜头！' }),
         nextEventId: collegeNextStage,
       },
       {
         text: '【见好就收低调删帖】见好就收，删帖低调，怕影响将来 Background Check',
         effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 8), charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你冷静地想到大厂入职要查网络背景，果断删帖低调收场。放弃了流量，但守住了一份职业规划的清醒。' }),
         nextEventId: collegeNextStage,
       }
     ]
   },

   'us_undergrad_year3': {
     id: 'us_undergrad_year3',
    title: '【高年级冲刺】Intern 实习与求职季',
    description: '转眼到了大三和大四，周围的中国同学都在疯狂准备 Summer Intern 与全职 Offer。你打算怎么办？',
    choices: [
      {
        text: '【大厂实习冲刺】海投 500 份简历，疯狂刷 LeetCode 冲大厂',
        // The single biggest early-career lever (summer intern -> return offer) now
        // pays off concretely: intern salary + industry network, on top of the
        // LeetCode gain. Previously it was strictly dominated by the research option.
        effect: (s) => ({ leetcode: s.leetcode + 12, cash: s.cash + 2, network: Math.min(100, (s.network || 10) + 6), health: s.health - 10, age: s.age + 2, story_flags: { ...(s.story_flags || {}), college_next: 'us_undergrad_grad' }, message: '你拿到了硅谷大厂的暑期实习 Offer 并转正在望，还赚到了丰厚的实习工资，顺利完成了大三与大四学业！' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【华尔街金融实习】冲击纽约投资银行/量化基金 Quant 实习',
        effect: (s) => ({ cash: s.cash + 3, charm: Math.min(s.max_charm ?? 25, s.charm + 5), network: Math.min(100, (s.network || 10) + 4), health: s.health - 10, age: s.age + 2, story_flags: { ...(s.story_flags || {}), college_next: 'us_undergrad_grad' }, message: '成功斩获纽约名企实习！年薪高昂，还打入了华尔街金融圈，顺利完成大学最后两年！' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【前沿学术科研】跟教授进 AI 实验室做 Research (冲全奖 PhD)',
        // Being research-ready is NOT the same as holding a PhD. Track it as a flag
        // that boosts PhD-admit odds; is_phd is only set where a PhD is actually earned.
        effect: (s) => ({ leetcode: s.leetcode + 12, impact: addImpact(s, 10), charm: Math.min(s.max_charm ?? 25, s.charm + 4), health: s.health - 8, age: s.age + 2, story_flags: { ...(s.story_flags || {}), phd_ready: true, college_next: 'us_undergrad_grad' }, message: '你拿到了顶尖教授的强力推荐信并发表了一作顶会 Workshop 论文，积累了学术影响力 (Impact +10) 与申博资本！顺利毕业！' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【校友人脉内推】去硅谷大厂 Career Fair 活动混脸熟要内推',
        condition: (s) => s.cash >= 1,
        // The dedicated networking choice now actually builds network (was 0 despite
        // the "加了几十位大厂校友/内推机会" flavor).
        effect: (s) => ({ cash: s.cash - 1, charm: Math.min(s.max_charm ?? 25, s.charm + 6), network: Math.min(100, (s.network || 10) + 12), age: s.age + 2, story_flags: { ...(s.story_flags || {}), college_next: 'us_undergrad_grad' }, message: '你加了几十位大厂校友，拿到不少内推机会与人脉资源，顺利拿到学位！' }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【佛系阳光青春】适度放松，在加州阳光下享受最后的大学青春',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: Math.min(s.max_charm ?? 25, s.charm + 5), age: s.age + 2, story_flags: { ...(s.story_flags || {}), college_next: 'us_undergrad_grad' }, message: '虽然没有实习经历，但你度过了人生中最无忧无虑的高年级时光！' }),
        nextEventId: pickCollegeEvent,
      }
    ]
  },

  'us_master_year1': {
    id: 'us_master_year1',
    title: '【美硕生活】内卷倒计时与加急学制',
    description: '时间紧迫！美硕只有短短一年半到两年。你一边要应付繁重的课业，一边又要准备残酷的秋招。',
    choices: [
      {
        text: '【加急刷题进厂】选择 1.5 年加急项目，翘课刷题 (23岁毕业)',
        effect: (s) => ({
          leetcode: s.leetcode + 15,
          health: s.health - 12,
          age: s.age + 1,
          is_master: true,
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
          message: 'GPA 擦边过，但你闭着眼睛都能手撕红黑树与动态规划，1.5年顺利美硕毕业！'
        }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【主攻量化金融】选择 2 年标准项目，准备 Quant/风控与投资面试 (24岁毕业)',
        effect: (s) => ({
          cash: s.cash + 2.5,
          leetcode: s.leetcode + 8,
          charm: Math.min(s.max_charm ?? 25, s.charm + 4),
          age: s.age + 2,
          is_master: true,
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
          message: '在 Quant 笔试与数学思维面试中顺利过关，2年学制美硕顺利毕业！'
        }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【完美学术绩点】选择 1.5 年加急项目，疯狂赶 Due 保 4.0 GPA (23岁毕业)',
        effect: (s) => ({
          leetcode: s.leetcode + 6,
          health: s.health - 8,
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          age: s.age + 1,
          is_master: true,
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
          message: '你拿到了 4.0 的完美绩点！展现了极其严谨的学业能力，1.5年美硕顺利毕业！'
        }),
        nextEventId: pickCollegeEvent,
      },
      {
        text: '【校友人脉内推】选择 2 年标准项目，去硅谷大厂活动混脸熟积累内推 (24岁毕业)',
        costBadge: '花费 $1w',
        condition: (s) => s.cash >= 1,
        effect: (s) => ({
          cash: s.cash - 1,
          network: Math.min(100, (s.network || 10) + 12),
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          age: s.age + 2,
          is_master: true,
          story_flags: { ...(s.story_flags || {}), college_next: 'us_master_grad' },
          message: '你加了 50 个大厂学长学姐的 LinkedIn，攒下了一大批内推人脉与直通面试机会，2年美硕顺利毕业！'
        }),
        nextEventId: pickCollegeEvent,
      }
    ]
  },

  'us_master_grad': {
    id: 'us_master_grad',
    title: '【硕士毕业】秋招上岸与硅谷求职',
    description: '你拿到了硕士学位，OPT 已经激活。现在必须在三个月内找到工作，否则就要被送中了。',
    imageUrl: 'images/stanford_graduation.jpg',
    choices: [
      {
        text: '【硅谷大厂秋招】海投简历，疯狂刷题备战 Onsite',
        reqBadge: '激活 OPT 实习期',
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)',
          health: s.health - 8,
          leetcode: s.leetcode + 12,
          message: '【硕士毕业】顺利斩获计算机硕士学位并激活 OPT 实习签证！你带着扎实的算法与工程背景，全力备战硅谷大厂秋招求职季！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【学术深造】申请北美顶尖 PhD (攻读人工智能与分布式系统博士)',
        reqBadge: '全奖直博 / 需 LeetCode >= 50',
        condition: (s) => s.leetcode >= 50 || (s.impact || 0) >= 10,
        effect: (s) => {
          const pass = s.is_phd || (gameRandom() < (0.25 + (s.school === 'cmu' ? 0.20 : 0) + ((s.impact || 0) >= 10 ? 0.15 : 0) + (s.leetcode >= 80 ? 0.15 : 0) + (s.story_flags?.phd_ready ? 0.15 : 0)));
          return pass 
            ? { cash: s.cash + 2, age: s.age + 1, year: s.year + 1, is_phd: true, housing_name: '美国 博士实验室', message: '大喜讯！凭借出色的硕士科研成果与算法沉淀，你战胜了数千名申请者，斩获北美顶级 CS 全奖 PhD Offer！' }
            : { health: Math.max(0, s.health - 12), age: s.age + 1, year: s.year + 1, is_phd: false, message: '今年顶校 PhD 竞争白热化，你的申请未能入选。你收起行囊，投身硅谷大厂秋招求职。' };
        },
        nextEventId: (s: GameState) => s.is_phd ? 'phd_life' : 'job_hunt',
      },
      {
        text: '【找 ICC 挂靠保底】找 ICC 挂靠 (保底策略)',
        costBadge: '花费 $1w',
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
        text: '【加入 AI 初创公司】加入一家刚成立的 AI 初创公司 (高风险高回报)',
        reqBadge: '高风险高回报',
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
    title: '【国内大厂】新人起步与 996 体验期',
    description: '你在国内一线互联网大厂入职。每天早 10 晚 10 挤地铁、写业务需求、参与大促压测。扣除北上深高额房租、五险一金与日常税费开销，你正全力攒下赴美的第一桶金。',
    choices: [
      {
        text: '【996 拼命攒钱】高强度加班与硬核业务落地 (耗时 1 年，净攒 $2.5w)',
        effect: (s) => ({
          health: Math.max(15, s.health - 15),
          cash: s.cash + 2.5,
          age: s.age + 1,
          year: s.year + 1,
          leetcode: s.leetcode + 12,
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '初级研发',
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '无',
          message: '在 996 的高强度磨砺下，扣除房租和税费后你攒下了 $2.5w 留学专款！但也感受到了身心疲惫。'
        }),
        nextEventId: (s) => s.health <= 25 ? 'cn_burnout' : 'cn_work_mid',
      },
      {
        text: '【白天打工，周末备考】平衡作息，死磕托福/GRE 与算法 (耗时 1 年，净攒 $1.8w)',
        effect: (s) => ({
          health: Math.max(20, s.health - 8),
          cash: s.cash + 1.8,
          age: s.age + 1,
          year: s.year + 1,
          leetcode: s.leetcode + 18,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '初级研发',
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '无',
          message: '你拒绝了无效加班，利用周末在图书馆死磕托福和 LeetCode，为赴美申请打下了扎实功底！'
        }),
        nextEventId: 'cn_work_mid',
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
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'),
      }
    ]
  },

  'cn_work_mid': {
    id: 'cn_work_mid',
    title: '【国内发展】晋升答辩与降本增效潮',
    description: '你在大厂已工作数年，代码能力与业务理解日臻成熟。面对互联网行业的降本增效与职场竞争，你面临着关键的人生路线选择：',
    choices: [
      {
        text: '【冲击 P7 核心研发晋升】带团队攻坚高并发大模型业务 (耗时 2 年，净攒 $7w)',
        effect: (s) => ({
          health: Math.max(10, s.health - 18),
          cash: s.cash + 7,
          age: s.age + 2,
          year: s.year + 2,
          leetcode: s.leetcode + 15,
          company: 'cn_big_tech',
          job_type: 'cn_tech',
          level: '资深研发/Tech Lead',
          last_promo_age: s.age + 2, // 真晋升须打时间戳（与本选项 age+2 一致），与全局 last_promo_age 约定保持一致
          message: '晋升答辩顺利通过！你成功晋升资深研发并拿到丰厚年终奖与股票，两年扣税和生活开销后净攒下 $7w 储蓄！'
        }),
        nextEventId: (s) => s.health <= 25 ? 'cn_burnout' : 'cn_work_late',
      },
      {
        text: '【大厂业务优化：拿 N+3 大礼包润美】主动拿大额裁员赔偿直接出国 (耗时 1 年，获 $5w 赔偿)',
        effect: (s) => ({
          cash: s.cash + 5,
          health: Math.min(100, s.health + 15),
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
          company: undefined,
          job_type: undefined,
          level: undefined,
          tc: 0,
          school: 'state',
          has_us_degree: true,
          is_master: true,
          age: s.age + 1,
          year: s.year + 1,
          message: '趁着部门业务线调整，你果断签字拿了 N+3 丰厚裁员大礼包 (+$5w)！告别 996 内卷，手握充足学费飞赴北美开启 CS 硕士生涯！'
        }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【全款申请美硕】手握大厂积蓄，申请美国 CS 硕士深造',
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
          message: '拿着国内大厂积累的工程经验与积蓄，你成功获批 F-1 签证，飞赴加州入读 CS 硕士！'
        }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【跨国 L1 调动申请】凭借资深大厂背景申请硅谷总部岗位 (需算法 >= 60)',
        condition: (s) => s.leetcode >= 60,
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'L1 (外派)',
          tc: 35,
          company: 'google',
          job_type: 'big_tech',
          level: 'L4',
          laid_off: false,
          cash: s.cash + 6,
          age: s.age + 1,
          year: s.year + 1,
          message: '凭借扎实的系统工程经历，你成功通过跨国调动面试，以 L1 身份直接调往硅谷总部 (年薪 $35w L4)！'
        }),
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life')
      }
    ]
  },

  'cn_work_late': {
    id: 'cn_work_late',
    title: '【国内成熟】35 岁分水岭与终极出路',
    description: '年近三十，你在国内已是资深技术骨干。面对 35 岁职场分水岭与全球 AI 浪潮，你必须敲定人生的下半场：',
    choices: [
      {
        text: '【带资大龄留学赴美】作为资深架构师赴美读研，降维打击硅谷秋招 (耗时 1 年)',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({
          cash: s.cash - 5,
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)',
          company: undefined,
          job_type: undefined,
          level: undefined,
          tc: 0,
          school: 'cmu',
          has_us_degree: true,
          is_master: true,
          leetcode: Math.min(100, s.leetcode + 15),
          age: s.age + 1,
          year: s.year + 1,
          message: '带着十万美金积蓄与大厂资深架构经验，你飞赴北美名校读研！深厚的工程底子让你在求职市场所向披靡！'
        }),
        nextEventId: 'us_master_year1',
      },
      {
        text: '【跨国总监/资深调动】以 Staff/L5 资历直调加州总部 (年薪 $45w, 耗时 1 年)',
        condition: (s) => s.leetcode >= 70,
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'L1 (外派)',
          tc: 45,
          company: 'google',
          job_type: 'big_tech',
          level: 'L5 (Senior)',
          laid_off: false,
          cash: s.cash + 10,
          age: s.age + 1,
          year: s.year + 1,
          message: '你以资深架构师身份完成了跨国技术转移，以 L5 Senior SDE 入驻湾区总部 (年薪 $45w)！'
        }),
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life')
      },
      {
        text: '【国内 AI 初创合伙人】担任国内知名 AI 独角兽 CTO / 联合创始人 (转为创业线)',
        effect: (s) => ({
          cash: s.cash + 12,
          tc: 15,
          job_type: 'startup_founder',
          founder_stage: 'series_a',
          company_valuation: 2000,
          company: 'AI 独角兽 (国内)',
          level: 'CTO & Co-Founder',
          last_promo_age: s.age + 1,
          health: Math.max(0, s.health - 15),
          age: s.age + 1,
          year: s.year + 1,
          message: '你选择留在国内，作为 CTO 加入顶级资本领投的 AI 大模型初创公司，分得核心股权并开启创业新征程！'
        }),
        nextEventId: 'founder_annual_strategy'
      },
      {
        text: '【急流勇退：佛系定居/养生】套现部分期权，告别内卷享受慢节奏生活 (达成国内隐居结局)',
        // A modest domestic slow-life retirement, NOT a $500w FIRE — use 'retired'
        // (a content ending) instead of 'win' (which the ending classifier renders as
        // a "财务自由 · FIRE ACHIEVED" triumph). The cn_hermit flag gives it a dedicated ending.
        effect: (s) => ({
          cash: s.cash + 15,
          health: Math.min(100, s.health + 30),
          age: s.age + 1,
          year: s.year + 1,
          status: 'retired',
          story_flags: { ...(s.story_flags || {}), cn_hermit: true },
          message: '你告别了 996 内卷，在二线城市全款置业养生，过上了有房有存款的舒适慢节奏生活！(佛系隐居结局)'
        }),
        nextEventId: 'end'
      }
    ]
  },

  'cn_burnout': {
    id: 'cn_burnout',
    title: '【职场调养】体检警示与健康红线',
    description: '长期加班让你的身体有点疲惫，公司医疗保险为你提供了全面的体检与休养支持。',
    choices: [
      {
        text: '【医保报销治病休养】公司医保大部分报销治病休养 (花费 $1w)',
        effect: (s) => ({ cash: Math.max(0, s.cash - 1), health: Math.min(100, s.health + 40), age: s.age + 1, year: s.year + 1, message: '在医保绝大部分报销后，你休养了半个月恢复了健康！' }),
        nextEventId: (s) => (s.level?.includes('资深') || s.level?.includes('Tech Lead')) ? 'cn_work_late' : 'cn_work_mid'
      },
      {
        text: '【申请美硕赴美】趁机申请美硕离开 (留学贷款 + TA 助教，需评估项目背景与算法)',
        reqBadge: '需算法与背景评估',
        effect: (s) => {
          const pass = (s.leetcode >= 20) || (gameRandom() < 0.50 + (s.luck / 200));
          return pass
            ? { cash: Math.max(0, s.cash - 2), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'F1 (学生)', school: 'state', has_us_degree: true, is_master: true, age: s.age, health: Math.min(100, s.health + 20), message: ' 申请成功！凭借在国内大厂积累的工程项目经历，你顺利通过无抵押贷款审核与 Master 录取，开启赴美新生活！' }
            : { health: s.health - 10, message: ' 申请被拒！留学贷款机构与校方评估认为你负债风险过高，贷款未获批准。你只能留在本地继续调养或打工。' };
        },
        nextEventId: (s: GameState) => s.is_master ? 'us_master_year1' : ((s.level?.includes('资深') || s.level?.includes('Tech Lead')) ? 'cn_work_late' : 'cn_work_mid')
      }
    ]
  },

  'phd_life': {
    id: 'phd_life',
    title: '【北美读博】学术起步与科研启航 (博一~博二)',
    description: '你拿着每年 3 万美元的 stipend，看着去湾区大厂打工的同学已经换了保时捷。你的导师极度 push，凌晨两点还在群里圈你改实验。',
    choices: [
      {
        text: '【全力冲刺顶会】昼夜攻坚大模型架构与分布式算子，硬冲 NeurIPS/ICML (耗时 2 年)',
        effect: (s) => {
          const passProb = 0.40 + ((s.impact || 0) >= 10 ? 0.15 : 0) + (s.leetcode >= 65 ? 0.10 : 0) + (s.school === 'cmu' ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass 
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), is_phd: true, leetcode: Math.min(100, s.leetcode + 15), impact: addImpact(s, 15), story_flags: { ...(s.story_flags || {}), hawaii_conf: true }, message: '两年的昼夜颠倒，你的论文终于有突破性进展并被顶会 Oral 接收，学术影响力大涨 (Impact +15)！老板决定带你去夏威夷参加顶级学术会议！' }
            : { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), impact: addImpact(s, 6), leetcode: Math.min(100, s.leetcode + 12), message: '首篇顶会审稿激烈惨遭拒稿，但你搭建了完备的实验基准并积累了扎实的前期产出 (Impact +6)。进入博三博四攻坚！' };
        },
        nextEventId: (s) => (s.story_flags?.hawaii_conf ? 'phd_conference' : 'phd_mid_stage')
      },
      {
        text: '【跟组稳扎稳打】与实验室师兄合作发表中档二作，稳过资格考 Quals (耗时 2 年)',
        effect: (s) => ({
          age: s.age + 2,
          year: s.year + 2,
          health: Math.max(0, s.health - 8),
          impact: addImpact(s, 12),
          leetcode: Math.min(100, s.leetcode + 8),
          message: '你稳扎稳打通过了博士资格考 (Quals)，并积累了扎实的合作论文与学术产出 (Impact +12)，深得导师信任！进入博三高年级。'
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
    title: '【北美读博】学术攻坚与答辩生死线 (博三~博四)',
    description: '博士进入后半程，导师的 Funding 告急，毕业答辩与论文指标压得你喘不过气。实验室里弥漫着焦虑，今年你必须做出决断。',
    choices: [
      {
        text: '【背水一战硬冲顶会 Oral】通宵手撕算子与分布式实验，决战 NeurIPS (耗时 2 年)',
        effect: (s) => {
          const passProb = 0.35 + ((s.impact || 0) >= 20 ? 0.35 : (s.impact || 0) >= 10 ? 0.20 : 0) + (s.leetcode >= 70 ? 0.10 : 0) + (s.school === 'cmu' ? 0.10 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 12), is_phd: true, impact: addImpact(s, 15), leetcode: Math.min(100, s.leetcode + 15), message: '奇迹！两年的厚积薄发终于开花结果，你的大模型推理架构论文被顶会 Oral 接收，学术影响力飙升 (Impact +15)！老板大喜，带你去夏威夷顶会！' }
            : { age: s.age + 2, year: s.year + 2, is_phd: false, is_master: true, health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 15), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', message: '顶会再次惨遭拒稿！导师 Funding 彻底耗尽，系里评估认为学术成果 (Impact) 严重不足，建议你 Master Out 毕业找工作。' };
        },
        nextEventId: (s) => (s.is_phd ? 'phd_conference' : 'job_hunt')
      },
      {
        text: '【申请大厂研究实习】申请 Meta FAIR / Google DeepMind 做研究实习 (耗时 1 年，高风险高回报)',
        // The fast lane is now a REAL gamble: on failure you do NOT get the PhD — you go
        // back to grinding (routes to phd_mid_stage).
        effect: (s) => {
          const passProb = 0.35 + ((s.impact || 0) >= 15 ? 0.30 : (s.impact || 0) >= 8 ? 0.15 : 0) + (s.leetcode >= 70 ? 0.15 : 0) + (s.school === 'cmu' ? 0.10 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { cash: s.cash + 6, health: Math.max(0, s.health - 6), age: s.age + 1, year: s.year + 1, is_phd: true, impact: addImpact(s, 15), network: Math.min(100, (s.network || 10) + 15), leetcode: Math.min(100, s.leetcode + 10), message: '在顶尖 AI 工业界实验室 (FAIR/DeepMind) 实习收获满满！以第一作者发表了重磅 Demo 与论文 (Impact +15)，攒下了 $6w 实习薪水并顺利通过博士答辩 Defense，取得 PhD 学位！' }
            : { health: Math.max(0, s.health - 10), age: s.age + 1, year: s.year + 1, impact: addImpact(s, 4), leetcode: Math.min(100, s.leetcode + 8), message: '顶尖 Lab 实习申请竞争太激烈被刷，博士论文指标仍需打磨，你只能回校继续给导师搬砖。' };
        },
        nextEventId: (s) => s.is_phd ? 'phd_job_hunt' : 'phd_mid_stage'
      },
      {
        text: '【二线期刊保底答辩】降低身段投中档期刊与 Workshop，申请博士答辩 (耗时 2 年，稳妥毕业)',
        // The reliable "safety" path: slowest (2yr) but the highest PhD-pass odds at a
        // low health cost — a genuine low-risk alternative to the research-implant gamble.
        effect: (s) => {
          const passProb = 0.75 + ((s.impact || 0) >= 10 ? 0.15 : 0) + (s.leetcode >= 50 ? 0.05 : 0) + ((s.luck || 20) / 300);
          const pass = gameRandom() < passProb;
          return pass
            ? { age: s.age + 2, year: s.year + 2, health: Math.max(0, s.health - 6), is_phd: true, impact: addImpact(s, 12), leetcode: Math.min(100, s.leetcode + 8), message: '你放下了追求顶会的执念，凭借多篇中档期刊论文和扎实成果 (Impact +12) 顺利通过了博士答辩 Defense，成功获得 PhD 博士学位！' }
            : { age: s.age + 2, year: s.year + 2, is_phd: false, is_master: true, health: Math.max(0, s.health - 12), visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'OPT (实习)', message: '答辩委员会认为你的成果与学术影响力 (Impact) 严重不足未予通过！心力交瘁的你选择不再延毕，拿硕士学位跑路求职。' };
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
    title: '【学术顶会】夏威夷 CVPR / NeurIPS 巅峰聚会',
    description: '你在夏威夷的会场做完了 Poster 展示。接下来几天，你打算怎么安排？',
    choices: [
      {
        text: '【疯狂 Network】疯狂 Network，结识学术大牛与顶尖 Lab 负责人 (耗时 1 年顺利毕业答辩)',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5), age: s.age + 1, year: s.year + 1, health: Math.max(0, s.health - 8), is_phd: true, impact: addImpact(s, 8), network: Math.min(100, (s.network || 10) + 20), leetcode: Math.min(100, s.leetcode + 12), message: '你成功给几位学术大佬与 OpenAI/Google 研究员留下了深刻印象，论文引用量稳步攀升 (Impact +8)！回到学校后顺利完成 Defense，拿到了沉甸甸的 PhD 学位！' }),
        nextEventId: 'phd_job_hunt'
      },
      {
        text: '【海滩冲浪放飞自我】去海滩冲浪放飞自我 (引起老板不满，延毕 1 年)',
        effect: (s) => ({ health: Math.min(100, s.health + 20), charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5), age: s.age + 2, year: s.year + 2, is_phd: true, impact: addImpact(s, 6), leetcode: Math.min(100, s.leetcode + 8), message: '你在海滩上玩疯了，没参加老板组织的组会。老板很生气，多留了你一年才放你毕业。' }),
        nextEventId: 'phd_job_hunt'
      }
    ]
  },

  'phd_job_hunt': {
    id: 'phd_job_hunt',
    title: '【博士求职】降维打击与顶级 Offer 分层抉择',
    description: '顶着 PhD 博士光环，你进入了硅谷人才市场。这不再是一般的初级码农招聘，而是分层走向前沿科学家、顶级量化或大厂核心研发。',
    choices: [
      {
        text: '【申请 OpenAI / Anthropic】申请 OpenAI / Anthropic 核心研究员 (地狱面试 · 年薪 $80w · O-1 签证)',
        reqBadge: '地狱级门槛 · 需高学术 Impact',
        effect: (s) => {
          // Top 15%-25% elite path: heavily weights Impact (papers/citations) + leetcode + school/network
          const winRate = 0.15 + ((s.impact || 0) >= 35 ? 0.22 : (s.impact || 0) >= 20 ? 0.12 : 0) + (s.leetcode >= 80 ? 0.10 : 0) + (s.school === 'cmu' ? 0.08 : 0) + ((s.network || 10) >= 25 ? 0.08 : 0) + ((s.luck || 20) / 200);
          const win = gameRandom() < winRate;
          return win
            ? { tc: 80, cash: s.cash + 20, health: Math.max(0, s.health - 15), impact: addImpact(s, 15), visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'openai', job_type: 'ai_research', level: 'MTS', message: '震撼硅谷！凭借顶尖的学术论文影响力 (Impact) 与前沿架构功底，OpenAI 直接用 $80w 顶配包裹和 O1 签证把你聘为核心研究员 (MTS)！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'google', job_type: 'big_tech', level: 'L4', message: 'OpenAI 核心研究员面试太残酷了！手撕 Triton 算子挂在最后一轮。不过顶级大厂看重你的博士背景，直接给出了 Google L4 SDE 研发岗位 (年薪 $32w)！' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '【申请科技大厂 Applied Scientist】申请科技大厂 Applied Scientist (应用科学家 · 年薪 $48w · O-1 签证)',
        reqBadge: '需扎实研究成果',
        effect: (s) => {
          const passProb = 0.45 + ((s.impact || 0) >= 20 ? 0.25 : (s.impact || 0) >= 10 ? 0.12 : 0) + (s.leetcode >= 65 ? 0.10 : 0) + ((s.network || 10) >= 20 ? 0.08 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { tc: 48, cash: s.cash + 15, impact: addImpact(s, 10), visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'google', job_type: 'ai_research', level: 'L5 (Senior)', message: '大厂的科学家岗位待遇丰厚！不用写纯业务 CRUD，负责核心模型算法架构研发，享受 $48w 高额年薪与 O-1 签证！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'meta', job_type: 'big_tech', level: 'L4', message: '科学家岗位 Headcount 紧张未能入选，但 HR 迅速将你转入 Engineering 部门，以 L4 高级研发工程师录用 (年薪 $32w)！' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '【大厂研发工程师保底】大厂研发工程师保底入职 (免刷题内卷 · 定级 L4 · 年薪 $32w)',
        effect: (s) => ({
          tc: 32,
          cash: s.cash + 6,
          company: 'google',
          job_type: 'big_tech',
          level: 'L4',
          impact: addImpact(s, 5),
          visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)',
          message: '凭着博士沉淀的技术功底，你免去了一切内卷，直接以 L4 职级入职硅谷科技大厂，享受 $32w 丰厚起薪与舒适 WLB！'
        }),
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      },
      {
        text: '【冲击华尔街 Quant Researcher】冲击华尔街 Quant Researcher 量化研究员 (年薪 $60w + 高额奖金)',
        reqBadge: '需极高数理算法',
        effect: (s) => {
          const passProb = 0.22 + (s.leetcode >= 80 ? 0.25 : 0.05) + ((s.impact || 0) >= 15 ? 0.10 : 0) + (s.school === 'cmu' ? 0.15 : 0) + ((s.luck || 20) / 200);
          const pass = gameRandom() < passProb;
          return pass
            ? { tc: 60, cash: s.cash + 25, impact: addImpact(s, 8), visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', company: 'citadel', job_type: 'quant', level: 'Quant', message: '华尔街顶级对冲基金抢夺学术英才！Citadel 开出 $60w 顶配待遇与高额提成，聘请你为量化研究员！' }
            : { tc: 32, cash: s.cash + 5, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'H1B (工签)', company: 'google', job_type: 'big_tech', level: 'L4', message: 'Quant 脑筋急转弯与高频随机过程面试太硬核了！未能拿到 Offer，转而入职硅谷科技大厂 L4 研发。' };
        },
        nextEventId: (s: GameState) => isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life'
      }
    ]
  }
};
