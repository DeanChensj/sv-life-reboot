import type { GameEvent, GameState } from '../../types';
import { h1ToH2Router, gameRandom, stampSeen, addImpact , markSeen} from './helpers';

// 公司专属随机事件 (Company-specific flavor events).
// Each is a once-per-life SIGNATURE beat for its company path, injected from
// midYearEventRouter with a ~30% yearly chance UNTIL it has fired once (tracked
// via story_flags.<id>_seen), so it feels like a memorable landmark rather than
// a recurring chore. Rules followed:
//  - single-choice health loss <= 15; charm capped at max_charm; no money printers.
//  - route on STATE (h1ToH2Router / laid_off), never on message substrings.
//  - every event has an unconditional "safe" choice → no dead-ends.
//  - EVERY choice/outcome stamps story_flags.<id>_seen so the router won't repeat it.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;

// Merge-in the once-only "seen" flag without clobbering other story_flags.
const seen = markSeen; // 统一一生一次基座(替代复制的本地实现)

export const companyEvents: Record<string, GameEvent> = {
  // ---------------- Google: 养老厂反复重组 ----------------
  'google_reorg_limbo': {
    id: 'google_reorg_limbo',
    oncePerLife: true,
    title: '【巨头动荡】Google 又一轮重组 (Reorg Limbo)',
    description: '新一轮组织架构调整降临，你的组被并入一个新部门，新老板还没到位，你陷入了“组织待定”的模糊地带。好在 Google 极少裁人，你有的是时间观望。',
    choices: [
      {
        text: '【主动出击抱大腿】主动出击：疯狂 Network，争取转去热门 Gemini / AI 核心组',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 8),
          message: '你请了半个部门喝咖啡、刷遍了内部 Tech Talk，成功拿到了热门 AI 组的转岗内诺，人脉大涨！',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【佛系躺平等待稳定】佛系躺平：反正饿不死，安心 Rest and Vest 等尘埃落定',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          leetcode: Math.max(0, s.leetcode - 3),
          impact: addImpact(s, -8),
          message: '你把重组当带薪疗养，每天班车、食堂、健身房三点一线，身体养得倍儿棒，就是手感生疏了点。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Meta: All-in 转型豪赌 ----------------
  'meta_metaverse_pivot': {
    id: 'meta_metaverse_pivot',
    oncePerLife: true,
    title: '【战略转向】Meta 战略 All-in (元宇宙 → AI)',
    description: '小扎在全员会上再次宣布公司要 All-in 新方向，你手上的项目被当场砍掉。要么赌一把转去新方向的核心组冲业绩，要么稳一手混个 Meets 保平安。',
    choices: [
      {
        text: '【转投 AI 核心架构】赌一把：转去 All-in 新方向核心组，冲影响力',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.35 + ((s.network || 10) / 100) * 0.5);
          return win
            ? { tc: s.tc + 8, leetcode: Math.min(100, s.leetcode + 5), health: Math.max(0, s.health - 12), message: '你压中了风口！新方向拿下高层背书，你作为核心成员吃到了丰厚的股票刷新与影响力红利！' }
            : { health: Math.max(0, s.health - 12), charm: Math.max(0, (s.charm || 10) - 1), message: '新方向半年后又被砍，你的产出打了水漂，白忙一场还落了一身疲惫。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【稳健维持 Meets】稳一手：低调维持 Meets 绩效，不掺和高层斗争',
        effect: (s) => ({
          health: Math.max(0, s.health - 4),
          message: '你选择了明哲保身，安稳拿着标准包裹，避开了这场豪赌的腥风血雨。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Nvidia: 皮衣黄股价狂飙 ----------------
  'nvidia_rsu_moonshot': {
    id: 'nvidia_rsu_moonshot',
    oncePerLife: true,
    title: '【黄氏狂欢】Nvidia 算力暴涨与 RSU 封神',
    description: 'AI 算力军备竞赛下，英伟达股价一年翻了几倍，你的 RSU 账户肉眼可见地膨胀。茶水间里同事都在争论：是套现落袋买房，还是钻石手继续持有？',
    choices: [
      {
        text: '【套现锁定部分收益】见好就收：套现一部分 RSU 锁定收益，落袋为安',
        condition: (s) => (s.stocks || 0) >= 8,
        effect: (s) => ({
          stocks: Math.max(0, (s.stocks || 0) - 8),
          cash: s.cash + 8,
          health: Math.min(100, s.health + 5),
          message: '你冷静地卖出了一部分持仓，把纸面富贵变成了实打实的现金，睡得踏实多了。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【钻石手一股不卖】钻石手：All-in 信仰，一股不卖赌它继续暴涨',
        condition: employed,
        effect: (s) => {
          const moon = gameRandom() < Math.min(0.6, 0.45 + (Math.min(60, s.luck) / 100) * 0.2);
          return moon
            ? { stocks: (s.stocks || 0) + 10, message: '信仰充值成功！财报再超预期，股价又一波拉升，你的持仓继续膨胀！' }
            : { stocks: Math.max(0, (s.stocks || 0) - 6), health: Math.max(0, s.health - 4), message: '一次获利回吐让股价短线回调，你的账户缩水了一截，钻石手也有点发抖。' };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- TikTok / 字节: 美国封禁听证会 ----------------
  'tiktok_us_ban_hearing': {
    id: 'tiktok_us_ban_hearing',
    oncePerLife: true,
    title: '【风口浪尖】TikTok 听证会与地缘风暴',
    description: '国会又双叒在讨论强制剥离 TikTok 美国业务，你所在的组前途未卜，Slack 里人心惶惶，猎头电话却打爆了。',
    choices: [
      {
        text: '【留守相信禁令推翻】留守赌一把：相信禁令会被推翻 / 剥离顺利',
        condition: employed,
        effect: (s) => {
          const survive = gameRandom() < 0.6;
          return survive
            ? { cash: s.cash + 3, tc: s.tc + 4, health: Math.max(0, s.health - 6), message: '虚惊一场！业务顺利完成剥离重组，公司为留任员工发了慰问留任奖金，你稳住了。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 10), message: '最坏的结果发生了：美国业务被迫关停，整个组一夜之间被裁，你拿着 N+1 走人。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '【主动跳槽大厂避险】骑驴找马：主动跳槽到更稳的大厂避险',
        condition: employed,
        effect: (s) => ({
          company: 'google',
          job_type: 'big_tech',
          tc: Math.max(s.tc - 3, 22),
          health: Math.max(0, s.health - 5),
          network: Math.min(100, (s.network || 10) + 3),
          is_new_job: true,
          message: '你未雨绸缪，赶在风暴前跳去了以稳定著称的大厂。虽然全现金包裹略有回落，但换来了安稳。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- OpenAI / AI 实验室: 发布会前夜 crunch ----------------
  'openai_launch_crunch': {
    id: 'openai_launch_crunch',
    title: '【发布倒计时】下一代前沿大模型发布狂飙',
    description: 'AGI 军备竞赛白热化，下一代旗舰模型发布会只剩 72 小时，全组进入 war room 通宵冲刺。Sam 在群里发了「Ship it」表情包。',
    choices: [
      {
        text: '【主动请缨主讲 Demo】全力冲刺：主动请缨做发布会 Demo 主讲，赌一把高曝光',
        condition: employed,
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 15),
          impact: addImpact(s, 14),
          story_flags: stampSeen(s, 'openai_launch_crunch', 1),
          message: '你的 Demo 在发布会上惊艳全场，直播观看破千万！你一战成名，成了组里炙手可热的明星工程师，代价是熬到脱相。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【做好分内评测上线】稳住节奏：只做好分内的 Eval 与上线保障，不硬熬',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 3),
          health: Math.max(0, s.health - 4),
          story_flags: seen(s, 'openai_launch_crunch'),
          message: '你没有卷入通宵的军备竞赛，扎实做好了模型评测与发布保障，虽不出风头，但身心稳健。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Apple: 保密文化 ----------------
  'apple_secrecy_crackdown': {
    id: 'apple_secrecy_crackdown',
    oncePerLife: true,
    title: '【黑屋风暴】Apple 严苛保密审查升级',
    description: '库比蒂诺的保密文化再次收紧。你因为在内部群里随手发了一张未发布产品的截图，被合规团队约谈，气氛一度非常紧张。',
    choices: [
      {
        text: '【诚恳认错合规】老实配合：诚恳认错、删除记录并参加合规培训',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          charm: Math.max(0, (s.charm || 10) - 1),
          message: '你态度良好地配合了调查，虚惊一场保住了工作，但也被扣了当季的一部分信誉分，心有余悸。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【据理力争申辩】据理力争：那只是内部群，早有外媒爆料 (高风险)',
        condition: employed,
        effect: (s) => {
          const ok = gameRandom() < Math.min(0.7, 0.4 + ((s.charm || 10) / 100) * 0.3);
          return ok
            ? { charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2), health: Math.max(0, s.health - 4), message: '你有理有据地申辩，合规团队认定情节轻微不予追究，你还因不卑不亢赢得了同事敬重。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 10), message: '你的强硬触怒了合规团队，泄密条款零容忍，你被以违反保密协议为由直接解雇。' };
        },
         nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
    ],
  },

  // ---------------- Robinhood: 散户 meme 股狂潮 / SEC 问询 ----------------
  'robinhood_meme_stock_frenzy': {
    id: 'robinhood_meme_stock_frenzy',
    oncePerLife: true,
    title: '【散户狂欢】Robinhood Meme 股暴动与 SEC 问询',
    description: '散户在论坛上抱团逼空，某 meme 股单周暴涨十倍，你们的下单与撮合系统被交易洪峰冲到宕机边缘。App 商店涌入百万新用户，但 SEC 已就"限制买入"与订单流返佣 (PFOF) 向公司发来问询函……',
    choices: [
      {
        text: '【连夜扩容顶住洪峰】连夜扩容撮合引擎顶住洪峰，赌一把成为英雄',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.4 + (s.leetcode / 100) * 0.25);
          return win
            ? { impact: addImpact(s, 8), stocks: (s.stocks || 0) + 6, health: Math.max(0, s.health - 12), message: '你带队通宵扩容，系统在交易洪峰中稳如泰山！新增用户暴涨、HOOD 股价起飞，你吃到丰厚 RSU 刷新与全公司认可 (Impact 大涨)!' }
            : { health: Math.max(0, s.health - 14), impact: addImpact(s, -3), message: '撮合系统还是在最高峰宕机数小时，散户集体声讨、监管盯上你们组，你背了故障锅、身心俱疲，这半年的产出付诸东流。' };
        },
        nextEventId: (s) => h1ToH2Router(s),
      },
      {
        text: '【配合合规应对问询】配合合规团队应对 SEC 问询与 PFOF 审查，稳妥收尾',
        effect: (s) => ({
          health: Math.max(0, s.health - 5),
          network: Math.min(100, (s.network || 10) + 5),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          message: '你协助法务与合规连夜准备应询材料，滴水不漏地扛过了监管风波。虽没吃到风口红利，却赢得了跨部门的信任与人脉。',
        }),
        nextEventId: (s) => h1ToH2Router(s),
      },
    ],
  },

  // ---------------- 通用「影响力机遇」随机事件 (impact opportunities) ----------------
  // 给大厂/研究路径额外的 impact 来源(除年度硬卷外),让积累影响力不必只靠爆肝。
  // 一生一次(story_flags.<id>_seen),由 midYearEventRouter 以 ~25% 概率注入。
  'open_source_breakout': {
    id: 'open_source_breakout',
    oncePerLife: true,
    title: '【开源出圈】你的业余开源项目一夜爆红',
    description: '你利用业余时间维护的开源库突然冲上 GitHub Trending 与 Hacker News 头条，一晚暴涨上万 star，业界大佬纷纷转发，连你老板都在全员频道 @ 你！',
    choices: [
      {
        text: '【全力运营】投入精力打磨社区与文档，把开源热度变现为职业影响力',
        effect: (s) => ({ health: Math.max(0, s.health - 8), impact: addImpact(s, 12), network: Math.min(100, (s.network || 10) + 6), leetcode: Math.min(100, s.leetcode + 3), message: '你顺势把开源热度运营成个人技术品牌，行业影响力 (Impact) 大涨，还结识了一批核心圈内人！' }),
        nextEventId: (s) => h1ToH2Router(s),
      },
      {
        text: '【随缘维护】热度随它去，主要精力还是放回本职工作',
        effect: (s) => ({ impact: addImpact(s, 5), message: '你没太上心，热度过后项目渐渐沉寂，但这段经历仍为你攒下了一些行业影响力。' }),
        nextEventId: (s) => h1ToH2Router(s),
      },
    ],
  },
  'internal_tech_talk_viral': {
    id: 'internal_tech_talk_viral',
    oncePerLife: true,
    title: '【技术分享出圈】你的 Tech Talk 火遍全公司',
    description: '你在公司技术大会上的架构分享意外出圈，录播在内网被疯狂转发，好几个组主动来取经，连 VP 都私信约你喝咖啡……',
    choices: [
      {
        text: '【趁热打铁】牵头成立跨组技术委员会，扩大技术话语权',
        effect: (s) => ({ health: Math.max(0, s.health - 7), impact: addImpact(s, 10), network: Math.min(100, (s.network || 10) + 8), message: '你借势牵头跨组技术委员会，成了公司级技术意见领袖，影响力 (Impact) 与人脉双丰收！' }),
        nextEventId: (s) => h1ToH2Router(s),
      },
      {
        text: '【低调收尾】收下好评，继续专注手头项目',
        effect: (s) => ({ impact: addImpact(s, 4), charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2), message: '你谦逊地收下同事们的称赞，低调回归本职，小小刷了一波存在感。' }),
        nextEventId: (s) => h1ToH2Router(s),
      },
    ],
  },
};
