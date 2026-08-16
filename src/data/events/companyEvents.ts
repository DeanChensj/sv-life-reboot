import type { GameEvent, GameState, StoryFlags } from '../../types';
import { h1ToH2Router, gameRandom, stampSeen, addImpact } from './helpers';

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
const seen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

export const companyEvents: Record<string, GameEvent> = {
  // ---------------- Google: 养老厂反复重组 ----------------
  'google_reorg_limbo': {
    id: 'google_reorg_limbo',
    title: 'Google 又一轮重组 (Reorg Limbo)',
    description: '新一轮组织架构调整降临，你的组被并入一个新部门，新老板还没到位，你陷入了“组织待定”的模糊地带。好在 Google 极少裁人，你有的是时间观望。',
    choices: [
      {
        text: '主动出击：疯狂 networking 抱大腿，争取转去热门 Gemini / AI 核心组',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 8),
          story_flags: seen(s, 'google_reorg_limbo'),
          message: '你请了半个部门喝咖啡、刷遍了内部 Tech Talk，成功拿到了热门 AI 组的转岗内诺，人脉大涨！',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '佛系躺平：反正饿不死，安心 rest and vest 等尘埃落定',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          leetcode: Math.max(0, s.leetcode - 3),
          impact: addImpact(s, -8),
          story_flags: seen(s, 'google_reorg_limbo'),
          message: '你把重组当带薪疗养，每天班车、食堂、健身房三点一线，身体养得倍儿棒，就是手感生疏了点。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- Meta: All-in 转型豪赌 ----------------
  'meta_metaverse_pivot': {
    id: 'meta_metaverse_pivot',
    title: 'Meta 战略 All-in (元宇宙 → AI)',
    description: '小扎在全员会上再次宣布公司要 All-in 新方向，你手上的项目被当场砍掉。要么赌一把转去新方向的核心组冲业绩，要么稳一手混个 Meets 保平安。',
    choices: [
      {
        text: '赌一把：转去 All-in 新方向的核心组，冲影响力 (成败看造化)',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.35 + ((s.network || 10) / 100) * 0.5);
          return win
            ? { tc: s.tc + 8, leetcode: Math.min(100, s.leetcode + 5), health: Math.max(0, s.health - 12), story_flags: seen(s, 'meta_metaverse_pivot'), message: '你压中了风口！新方向拿下高层背书，你作为核心成员吃到了丰厚的股票刷新与影响力红利！' }
            : { health: Math.max(0, s.health - 12), charm: Math.max(0, (s.charm || 10) - 1), story_flags: seen(s, 'meta_metaverse_pivot'), message: '新方向半年后又被砍，你的产出打了水漂，白忙一场还落了一身疲惫。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '稳一手：低调维持 Meets 绩效，不掺和高层路线斗争',
        effect: (s) => ({
          health: Math.max(0, s.health - 4),
          story_flags: seen(s, 'meta_metaverse_pivot'),
          message: '你选择了明哲保身，安稳拿着标准包裹，避开了这场豪赌的腥风血雨。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- NVIDIA: 皮衣黄股价狂飙 ----------------
  'nvidia_rsu_moonshot': {
    id: 'nvidia_rsu_moonshot',
    title: 'NVIDIA RSU 一飞冲天',
    description: 'AI 算力军备竞赛下，英伟达股价一年翻了几倍，你的 RSU 账户肉眼可见地膨胀。茶水间里同事都在争论：是套现落袋买房，还是钻石手继续持有？',
    choices: [
      {
        text: '见好就收：套现一部分 RSU 锁定收益，落袋为安',
        condition: (s) => (s.stocks || 0) >= 8,
        effect: (s) => ({
          stocks: Math.max(0, (s.stocks || 0) - 8),
          cash: s.cash + 8,
          health: Math.min(100, s.health + 5),
          story_flags: seen(s, 'nvidia_rsu_moonshot'),
          message: '你冷静地卖出了一部分持仓，把纸面富贵变成了实打实的现金，睡得踏实多了。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '钻石手：All-in 信仰，一股不卖赌它继续涨 (高波动)',
        condition: employed,
        effect: (s) => {
          const moon = gameRandom() < Math.min(0.6, 0.45 + (Math.min(60, s.luck) / 100) * 0.2);
          return moon
            ? { stocks: (s.stocks || 0) + 10, story_flags: seen(s, 'nvidia_rsu_moonshot'), message: '信仰充值成功！财报再超预期，股价又一波拉升，你的持仓继续膨胀！' }
            : { stocks: Math.max(0, (s.stocks || 0) - 6), health: Math.max(0, s.health - 4), story_flags: seen(s, 'nvidia_rsu_moonshot'), message: '一次获利回吐让股价短线回调，你的账户缩水了一截，钻石手也有点发抖。' };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- TikTok / 字节: 美国封禁听证会 ----------------
  'tiktok_us_ban_hearing': {
    id: 'tiktok_us_ban_hearing',
    title: 'TikTok 强制剥离听证会',
    description: '国会又双叒在讨论强制剥离 TikTok 美国业务，你所在的组前途未卜，Slack 里人心惶惶，猎头电话却打爆了。',
    choices: [
      {
        text: '留守赌一把：相信禁令会被推翻 / 剥离顺利 (前途未卜)',
        condition: employed,
        effect: (s) => {
          const survive = gameRandom() < 0.6;
          return survive
            ? { cash: s.cash + 3, tc: s.tc + 4, health: Math.max(0, s.health - 6), story_flags: seen(s, 'tiktok_us_ban_hearing'), message: '虚惊一场！业务顺利完成剥离重组，公司为留任员工发了慰问留任奖金，你稳住了。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 10), story_flags: seen(s, 'tiktok_us_ban_hearing'), message: '最坏的结果发生了：美国业务被迫关停，整个组一夜之间被裁，你拿着 N+1 走人。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '骑驴找马：主动跳槽到更稳的大厂避险 (损失部分现金流)',
        condition: employed,
        effect: (s) => ({
          company: 'google',
          job_type: 'big_tech',
          tc: Math.max(s.tc - 3, 22),
          health: Math.max(0, s.health - 5),
          network: Math.min(100, (s.network || 10) + 3),
          is_new_job: true,
          story_flags: seen(s, 'tiktok_us_ban_hearing'),
          message: '你未雨绸缪，赶在风暴前跳去了以稳定著称的大厂。虽然全现金包裹略有回落，但换来了安稳。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- OpenAI / AI 实验室: 发布会前夜 crunch ----------------
  'openai_launch_crunch': {
    id: 'openai_launch_crunch',
    title: '下一代模型发布会倒计时',
    description: 'AGI 军备竞赛白热化，下一代旗舰模型发布会只剩 72 小时，全组进入 war room 通宵冲刺。Sam 在群里发了「Ship it」表情包。',
    choices: [
      {
        text: '全力冲刺：主动请缨做发布会 Demo 主讲，赌一把高曝光',
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
        text: '稳住节奏：只做好分内的 eval 与上线保障，不硬熬',
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
    title: 'Apple 保密审查升级',
    description: '库比蒂诺的保密文化再次收紧。你因为在内部群里随手发了一张未发布产品的截图，被合规团队约谈，气氛一度非常紧张。',
    choices: [
      {
        text: '老实配合：诚恳认错、删除记录、参加合规培训',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          charm: Math.max(0, (s.charm || 10) - 1),
          story_flags: seen(s, 'apple_secrecy_crackdown'),
          message: '你态度良好地配合了调查，虚惊一场保住了工作，但也被扣了当季的一部分信誉分，心有余悸。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '据理力争：那只是内部群，何况早有外媒爆料了 (高风险)',
        condition: employed,
        effect: (s) => {
          const ok = gameRandom() < Math.min(0.7, 0.4 + ((s.charm || 10) / 100) * 0.3);
          return ok
            ? { charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2), health: Math.max(0, s.health - 4), story_flags: seen(s, 'apple_secrecy_crackdown'), message: '你有理有据地申辩，合规团队认定情节轻微不予追究，你还因不卑不亢赢得了同事敬重。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 10), story_flags: seen(s, 'apple_secrecy_crackdown'), message: '你的强硬触怒了合规团队，泄密条款零容忍，你被以违反保密协议为由直接解雇。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
    ],
  },
};
