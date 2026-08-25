import type { GameEvent, GameState } from '../../types';
import { h1ToH2Router, gameRandom, stampSeen, addImpact , markSeen} from './helpers';

// 人设 (天赋 trait_title) 专属随机事件 — Persona-specific flavor events.
// Each is a once-per-life SIGNATURE beat for its persona, injected from
// midYearEventRouter with a ~30% yearly chance UNTIL it has fired once (tracked
// via story_flags.<id>_seen). Mirrors companyEvents.ts. Rules followed:
//  - single-choice health loss <= 15; charm capped at max_charm; no money printers.
//  - route on STATE (h1ToH2Router), never on message substrings.
//  - every event has an unconditional "safe" choice → no dead-ends.
//  - EVERY choice/outcome stamps story_flags.<id>_seen so the router won't repeat it.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;

// Merge-in the once-only "seen" flag without clobbering other story_flags.
const seen = markSeen; // 统一一生一次基座(替代复制的本地实现)

export const personaEvents: Record<string, GameEvent> = {
  // ---------------- 卷王之王: 极限 deadline 爆肝 (H1, 在职) ----------------
  'persona_grind_king_crunch': {
    id: 'persona_grind_king_crunch',
    title: '【卷王本色】不可能的 Deadline 与极限冲刺',
    description: 'VP 拍脑袋定下一个「三周上线」的死线，全组都觉得是 mission impossible。作为天生的做题家，你却隐隐兴奋——这正是你碾压同僚、证明抗压天赋的舞台。',
    choices: [
      {
        text: '【极限爆肝单挑模块】连轴转三周单挑核心模块，以惊人产出一战封神',
        condition: employed,
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 10),
          network: Math.min(100, (s.network || 10) + 5),
          tc: s.tc + 4,
          health: Math.max(0, s.health - 12),
          impact: addImpact(s, 12),
          story_flags: stampSeen(s, 'persona_grind_king_crunch', 1),
          message: '你以恐怖的产出独扛了核心模块，项目奇迹般准时上线，VP 当众点名表扬，你成了组里公认的救火队长！代价是三周没睡好，也冷落了身边人。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【拒绝无意义加班】学着收着点：合理排期、拒绝无意义加班，身心为重',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          leetcode: Math.min(100, s.leetcode + 2),
          story_flags: seen(s, 'persona_grind_king_crunch'),
          message: '你难得地克制了卷的本能，推动团队合理排期。项目虽然延期了一点，但你终于睡了个好觉，身体棒棒。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 小镇做题家: 冒名顶替综合症 (H1, 在职) ----------------
  'persona_impostor_syndrome': {
    id: 'persona_impostor_syndrome',
    oncePerLife: true,
    title: '【做题家心魔】冒名顶替综合症与硬核突围',
    description: '组里周围全是藤校、大厂履历闪闪发光的天才，开会时的黑话你有时都跟不上。深夜你盯着天花板，怀疑自己是不是只是运气好混进来的冒牌货。',
    choices: [
      {
        text: '【死磕源码实力自证】闷头刷题、死磕底层源码，用硬核技术实力打破质疑',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 12),
          health: Math.max(0, s.health - 8),
          message: '你把不安全感转化成了燃料，啃下了组里最硬的技术难题。当你在设计评审上力压群雄时，没人再敢小看这个小镇做题家。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【找 Mentor 敞开长谈】找 Mentor 敞开聊，学着接纳并肯定自己',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          health: Math.min(100, s.health + 6),
          message: 'mentor 告诉你「假装懂到真的懂，是每个人的必经之路」。你放下了心结，心态平和了许多，也和团队更亲近了。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 湾区海王: 顶级社交局 (H2, 生活) ----------------
  'persona_playboy_high_society': {
    id: 'persona_playboy_high_society',
    oncePerLife: true,
    title: '【海王社交】Sand Hill 顶级私宴与人脉拿捏',
    description: '凭着你八面玲珑的名声，你被拉进了一场 Sand Hill Road 的顶级私人晚宴——满屋子的 VC、连续创业者和网红。这是你的主场。',
    choices: [
      {
        text: '【长袖善舞拿捏全场】在高端社交场谈笑风生，结交顶级 VC 与连续创业者',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          cash: Math.max(0, s.cash - 2),
          message: '你游刃有余地周旋全场，一晚上加了几十个高价值微信/LinkedIn，还被两位 VC 记住了名字。社交开销不菲，但人脉值回票价。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【低调结交靠谱人脉】低调出席，只重点结交几个真正靠谱的人',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 5),
          health: Math.min(100, s.health + 2),
          message: '你没有铺张地广撒网，而是深聊了两三位真正投缘的人。质量胜过数量，你结下了几段扎实的关系。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 原生美籍: 本地二代主场 (H2, 生活) ----------------
  'persona_native_hometown_edge': {
    id: 'persona_native_hometown_edge',
    oncePerLife: true,
    title: '【美籍优势】发小的主场内推与行业情报',
    description: '一个从小一起长大的湾区发小如今在某热门公司当 Hiring Manager，约你在老家后院烧烤。没有签证焦虑、没有身份包袱，你享受着二代土著独有的松弛感。',
    choices: [
      {
        text: '【动用本地主场人脉】动用本地人脉，套内推与一手行业情报',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 4),
          message: '发小给了你内推名额和一堆行业内幕。作为不用愁身份的本地二代，你的每一步都比别人轻松半拍。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【回老宅彻底放松】纯粹享受没有 H-1B 焦虑的周末，回老宅彻底放松',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          message: '你窝在从小长大的老宅里，晒着加州的太阳，看着抽签群里焦头烂额的同行，第一次真切体会到「生在终点线」的松弛。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 家里有矿: 父母加码赞助 (H2, 生活) ----------------
  'persona_rich_family_offer': {
    id: 'persona_rich_family_offer',
    oncePerLife: true,
    title: '【矿主底气】父母的第二笔赞助与独立抉择',
    description: '过年视频时，父母主动提出再给你一笔钱「垫一垫」——可以加码买房，也可以做启动金。但话里话外，也带着对你人生规划的期待与掌控。',
    choices: [
      {
        text: '【欣然接受家庭赞助】坦然收下父母资助，充实买房与投资现金流',
        effect: (s) => ({
          cash: s.cash + 8,
          network: Math.min(100, (s.network || 10) + 3),
          health: Math.max(0, s.health - 3),
          message: '这笔赞助让你的资产瞬间宽裕不少，但父母隔三差五的「关心」也随之而来，甜蜜的负担。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【婉拒赞助独立闯荡】委婉谢绝家庭经济资助，决心靠自己的双手闯出一片天地',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 5),
          network: Math.min(100, (s.network || 10) + 3),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          message: '你礼貌而坚定地谢绝了。为了证明自己不只是「家里有矿」，你把更多精力投进了自我提升，活得更有底气。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 天选之子: 玄学横财 (H2, 生活) ----------------
  'persona_chosen_windfall': {
    id: 'persona_chosen_windfall',
    oncePerLife: true,
    title: '【天选气运】玄学横财与气运爆发',
    description: '你莫名收到一个早期核心 AI/Web3 协议的内测与空投份额，朋友神秘兮兮地说「这波是内部顶级额度」。以你逆天的气运，梭一把说不定就是百倍收益！',
    choices: [
      {
        text: '【相信气运一把梭哈】放手一搏，跟随直觉果断押注早期协议份额',
        costBadge: '投入 $3w',
        condition: (s) => s.cash >= 3,
        effect: (s) => {
          const hit = gameRandom() < Math.min(0.85, 0.50 + (Math.min(80, s.luck) / 100) * 0.4);
          // 命中收益由 +$65w 砍到 +$35w、失手代价加重,让这一注真正带风险,
          // 不再是"落袋为安"几乎无人问津的白送横财 (仍保留天选之子的爽感,只是不再肥到离谱)。
          return hit
            ? { cash: s.cash + 25, stocks: (s.stocks || 0) + 10, message: '【天选气运大爆发！】项目主网上线一飞冲天，你精准在高点套现 $25w 现金横财，外加分得 $10w 核心资产，朋友直呼你是天选之子！' }
            : { cash: Math.max(0, s.cash - 3), health: Math.max(0, s.health - 8), message: '这次连气运都没兜住——项目高开低走还被套了一波，你割肉离场、元气小伤。看来天选之子偶尔也会打盹。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【落袋为安拒绝投机】落袋为安，再玄学也不碰投机',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          message: '你笑着婉拒了「稳赚」邀约，守住钱包，图个安心。有时候，不下场才是最大的运气。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
