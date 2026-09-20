import type { GameEvent, GameState } from '../../types';
import { h1ToH2Router, gameRandom, stampSeen, addImpact , markSeen} from './helpers';

// 职级 (level) 阶段专属随机事件 — Career-level signature events.
// One once-per-life SIGNATURE beat per ladder band (entry / senior / staff+),
// injected from midYearEventRouter's H1 work block with a ~30% yearly chance
// UNTIL it has fired once (tracked via story_flags.<id>_seen). Because each band
// is gated separately, a full climb surfaces ~3 stage beats spread across the
// career. Mirrors companyEvents / personaEvents. Rules followed:
//  - single-choice health loss <= 15; charm capped at max_charm; no money printers.
//  - route on STATE (h1ToH2Router), never on message substrings.
//  - every event has an unconditional "safe" choice → no dead-ends.
//  - EVERY choice/outcome stamps story_flags.<id>_seen so the router won't repeat it.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;

// Merge-in the once-only "seen" flag without clobbering other story_flags.
const seen = markSeen; // 统一一生一次基座(替代复制的本地实现)

export const levelEvents: Record<string, GameEvent> = {
  // ---------------- 入门 (L3 / L4 / 初级研发): 杂活与 oncall 地狱 ----------------
  'level_entry_grunt_work': {
    id: 'level_entry_grunt_work',
    oncePerLife: true, // 统一一生一次机制:_seen 由 applyStateTransition 自动置位(effect 无需手写 seen())
    title: '【初级萌新】杂活与 On-call 连环地狱',
    description: '作为组里最 junior 的人，你被塞满了没人愿意接的 oncall 值班、线上 bug 修复和文档杂活，离「有影响力的核心项目」似乎遥遥无期。',
    choices: [
      {
        text: '【埋头把脏活累活做】埋头把脏活累活做到极致，用可靠度攒满老板与同事的信任',
        // health 由 -8 降到 -5:与选项2(争取 own 模块)同等健康代价下,本项以 leetcode(+8)换取
        // 选项2的 impact/charm,形成"刷题跳槽 vs 攒影响力"的真实取舍,不再是纯亏健康的劣选。
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 5),
          message: '你把每一次 oncall 和每一个小 bug 都处理得干净利落，逐渐成了组里「靠谱」的代名词。老板开始把更重要的活交给你。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【主动找老板争取一】主动找老板争取一块有影响力的模块来 own',
        condition: employed,
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          leetcode: Math.min(100, s.leetcode + 3),
          health: Math.max(0, s.health - 5),
          impact: addImpact(s, 6),
          message: '你鼓起勇气在 1:1 上表达了想承担更大责任的意愿。老板欣赏你的主动，划给你一块虽小但可见的模块，你的成长曲线陡然上扬。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【按部就班稳住节奏】先稳住节奏，按部就班攒经验，避免早期 Burnout',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          leetcode: Math.min(100, s.leetcode + 3),
          message: '你告诉自己职业生涯是场马拉松。你不急不躁地打好基础、养好身体，为后面的冲刺蓄力。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 资深 (L5 Senior): 高原期 / 资深永动机 ----------------
  'level_senior_plateau': {
    id: 'level_senior_plateau',
    title: '【资深瓶颈】Senior 永动机与职业高原期',
    description: '作为 L5 Senior，你成了组里的救火队员——所有人的疑难杂症都来找你。但你隐隐发现自己卡在了原地，离 Staff 那道「影响力与政治」的天堑越来越远。',
    choices: [
      {
        text: '【抢跨组项目冲 L6】主动扩 Scope、抢跨组大项目，争取 Staff Sponsorship',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.3 + ((s.network || 10) / 100) * 0.5);
          return win
            ? { network: Math.min(100, (s.network || 10) + 8), charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2), tc: s.tc + 4, health: Math.max(0, s.health - 12), impact: addImpact(s, 12), story_flags: stampSeen(s, 'level_senior_plateau', 1), message: '你顶着压力揽下了一个跨三组的硬骨头项目，并成功推动落地。一位 Director 主动表示愿意在下一轮 Promo 为你做 Sponsor，Staff 的大门第一次向你敞开了缝隙！代价是几乎缺席了家里的所有晚饭。' }
            : { health: Math.max(0, s.health - 12), impact: addImpact(s, 4), story_flags: stampSeen(s, 'level_senior_plateau', 1), message: '你试图揽下更大的 scope，却因跨组政治协调不力而收效甚微，还把自己累得够呛，也冷落了身边人。冲击 Staff 的第一次尝试无功而返。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【坚守常青 Senior】接受常青 Senior 定位，守住 WLB、深耕技术手艺',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          leetcode: Math.min(100, s.leetcode + 5),
          story_flags: seen(s, 'level_senior_plateau'),
          message: '你想通了：不是每个人都要卷成 Staff。你安于做一名可靠的资深工程师，把手艺打磨到极致，同时守住了难得的工作生活平衡。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Staff+ (L6 / L7 / L8): 胶水工作困境 ----------------
  'level_staff_glue_work': {
    id: 'level_staff_glue_work',
    title: '【架构困境】Staff 的胶水工作与跨组撕逼',
    description: '升到 Staff+ 后，你发现大量时间花在了没人看得见却至关重要的「胶水工作」——跨组对齐、救火续命、带教新人。这些都不会写进你的晋升 packet，但整个组织都离不开它们。',
    choices: [
      {
        text: '【做好组织粘合剂】默默做好胶水工作，当组织不可或缺的粘合剂 (稳健)',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          health: Math.max(0, s.health - 6),
          impact: addImpact(s, 6),
          story_flags: seen(s, 'level_staff_glue_work'),
          message: '你选择成为团队的定海神针，默默扛下所有跨组协调与救火。虽然这些功劳很难量化、晋升也慢了，但你赢得了整个组织发自内心的信赖。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【抓旗舰大项目冲 L7】抓高曝光旗舰大项目，博 VP 眼球冲刺高职级',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.55, 0.25 + ((s.network || 10) / 100) * 0.35 + ((s.charm || 10) / 100) * 0.3);
          return win
            ? { tc: s.tc + 8, network: Math.min(100, (s.network || 10) + 6), health: Math.max(0, s.health - 15), impact: addImpact(s, 16), story_flags: stampSeen(s, 'level_staff_glue_work', 1), message: '你押注的旗舰项目一炮而红，直达 VP 视野。你拿到了梦寐以求的高管背书与丰厚回报，向 Principal 的方向又迈进了一大步！代价是长期扑在公司、亏欠了家人。' }
            : { health: Math.max(0, s.health - 15), charm: Math.max(0, (s.charm || 10) - 1), impact: addImpact(s, 3), story_flags: stampSeen(s, 'level_staff_glue_work', 1), message: '旗舰项目在高层路线摇摆中被腰斩，你不仅白忙一场，还被隐隐甩了锅，也没顾上家里。高曝光的赌注，这次输了。' };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Staff+ / EM (L6+): Calibration 小黑屋与 Headcount 争夺战 ----------------
  'level_l6_em_headcount_war': {
    id: 'level_l6_em_headcount_war',
    oncePerLife: true,
    title: '【L6+ 管理修罗场】Calibration 小黑屋与 HC 争夺战',
    description: '踏入 L6+ 阶梯后，你不再写普通业务 CRUD，而是坐进了年度 Calibration 闭门小黑屋。VP 一边削减全员预算、要求每个组强行交出 10% 的低绩效淘汰名额 (Quota)，一边把仅有的 3 个明年 AI 核心 Headcount 扔在桌上让几位 Tech Lead / Manager 厮杀争抢。',
    choices: [
      {
        text: '【铁血护犊 · 向上争抢 HC】拍桌亮出团队硬核产出，死保组员并硬抢 AI 算力预算',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.68, 0.35 + ((s.network || 10) / 150) + ((s.impact || 0) / 200));
          return win
            ? {
                tc: s.tc + 5,
                network: Math.min(100, (s.network || 10) + 8),
                impact: addImpact(s, 10),
                health: Math.max(0, s.health - 10),
                message: '【名将之风】你在 Calibration 上舌战群儒，用无可挑剔的线上 SLA 数据顶回了 VP 的淘汰摊派，还硬生生抢下 2 个新 Senior HC！全组兄弟对你死心塌地，团队战斗力爆表！',
              }
            : {
                health: Math.max(0, s.health - 12),
                impact: addImpact(s, 3),
                message: '【政治顶牛】你力保下属的举动惹恼了急于交差的 VP，新 HC 被分给了听话的隔壁组。虽然守住了底线，但你今年不得不自己扛下双倍的交付指标。',
              };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【挥泪斩马谡 · 交名额换地盘】按大厂生存法则交出边缘员工顶 Quota，换取 VP 批下扩张编制',
        condition: employed,
        effect: (s) => ({
          tc: s.tc + 4,
          impact: addImpact(s, 8),
          charm: Math.max(0, (s.charm || 10) - 2),
          health: Math.max(0, s.health - 6),
          message: '你学会了高管的冷酷算计：顺从地交出了组里产出垫底的名字完成淘汰 Quota，换取 VP 大笔一挥批给你明年 3 个新 HC。你的版图扩大了，但深夜合上电脑时心里多了一丝凉意。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【跨组结盟 · 互抬轿子保平安】私下与平级 Manager 达成攻守同盟，互相给对方核心骨干打高分',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 6),
          impact: addImpact(s, 5),
          health: Math.min(100, s.health + 4),
          message: '你深谙硅谷办公室政治的折中之道，会前与两位平级 Lead 喝咖啡对表，在 Calibration 上互相背书，稳稳保住了团队基本盘与个人精力。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Staff+ IC (L6+): 全司架构一票否决权 ----------------
  'level_l6_staff_architecture_veto': {
    id: 'level_l6_staff_architecture_veto',
    oncePerLife: true,
    title: '【L6+ 首席架构】VP 政绩工程与架构师的一票否决权',
    description: '新空降的业务 VP 为了年底冲高管政绩，强推一套华而不实、未经压测的“全链路 Multi-Agent 自动重构方案”。全组 L4/L5 工程师明知上线必崩却敢怒不敢言，整个部门上百双眼睛齐刷刷看向手握 Architecture Review 一票否决权 (Hard Veto) 的你。',
    choices: [
      {
        text: '【动用 Staff 一票否决权】在全司评审会上亮出压测铁证当众 Veto，抛出你的高可用替代方案',
        condition: employed,
        effect: (s) => {
          const win = (s.leetcode >= 65 && (s.impact || 0) >= 35) || gameRandom() < 0.65;
          return win
            ? {
                tc: s.tc + 6,
                leetcode: Math.min(100, s.leetcode + 4),
                impact: addImpact(s, 14),
                health: Math.max(0, s.health - 10),
                message: '【一锤定音】你在 200 人评审会上用硬核吞吐量压测图表彻底击碎了 PPT 泡沫！SVP 当场拍板改用你的渐进式架构，你以一己之力挽救了公司千万级故障，奠定了不可撼动的首席技术权威！',
              }
            : {
                health: Math.max(0, s.health - 12),
                impact: addImpact(s, 4),
                message: '【逆鳞之痛】你的直接否决让新 VP 下不来台，对方利用行政权力强行绕过评审上线。虽然三个月后系统果然暴雷印证了你的预言，但你也为此承受了半年的边缘化冷遇。',
              };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【表面放行 · 暗埋逃生舱】设计文档上签字给面子，底层悄悄写好一键热切回滚开关 (老狐狸)',
        condition: employed,
        effect: (s) => ({
          impact: addImpact(s, 10),
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 6),
          message: '【神级预判】你既没当众驳 VP 面子，又在底层埋好了热切换流控开关。新系统上线当天果然雪崩，你淡定敲下一行命令 15 秒无损回滚！VP 对你感恩戴德，把你奉为救命恩人！',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【尊重他人命运 · 签字下班】既然高管非要交学费，顺水推舟给 LGTM 准点回家陪家人',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          impact: Math.max(0, (s.impact || 0) - 2),
          message: '你放下了“拯救世界”的技术洁癖，在评审单上留下一句免责声明后准点下班。看着远处火烧云，你发现少操一份闲心居然如此神清气爽。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Staff+ / 高管博弈 (L6+): 高管猎头围猎与天价留任包 ----------------
  'level_l6_poach_bidding_war': {
    id: 'level_l6_poach_bidding_war',
    oncePerLife: true,
    title: '【L6+ 顶层身价】高管猎头围猎与 Special Retention 留任博弈',
    description: '升至 Staff+ 后，你的名字进入了硅谷顶级高管猎头 (Executive Search) 的秘密名单。竞对大厂 VP 亲自约你在 Palo Alto 私人会所共进晚餐，开出顶格包邀请你带队组建新部门；而你司 HRVP 得知风声后连夜启动了最高级别的防挖角挽留程序。',
    choices: [
      {
        text: '【借势逼宫拿 Retention】亮出外部高管意向书，迫使老板与 HRVP 特批免面试留任股票包',
        condition: employed,
        effect: (s) => ({
          stocks: (s.stocks || 0) + 16,
          tc: s.tc + 4,
          health: Math.max(0, s.health - 4),
          message: '【高管筹码兑现】面对随时可能流失核心技术支柱的危机，公司 CEO 特批为你追加了 $16w Special Retention 留任股票包并上调总包 (+$4w/年)！',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【带嫡系骨干成建制转换门庭】挥师高就，带着两位老部下空降执掌核心新业务',
        reqBadge: '需深厚行业人脉',
        condition: (s) => employed(s) && (s.network || 0) >= 30,
        effect: (s) => ({
          cash: s.cash + 8,
          tc: s.tc + 8,
          impact: addImpact(s, 8),
          health: Math.max(0, s.health - 8),
          message: '【自立山头】你带着昔日最默契的两名技术骨干潇洒履新，不仅拿到了 $8w 高管签字费与涨幅 (+$8w TC)，更在新东家直接拥有了完整的嫡系班底！',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【婉拒折腾 · 换取免检特权】向老板表态留在原厂，换取未来两年的 WLB 自由裁量权',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          network: Math.min(100, (s.network || 10) + 5),
          impact: addImpact(s, 4),
          message: '你婉拒了外部诱惑，老板大为感动，从此免除了你的日常考勤与琐碎汇报，你在组里真正活成了无人敢催的太上皇。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
