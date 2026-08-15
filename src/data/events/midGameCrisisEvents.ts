import type { GameEvent, GameState, StoryFlags } from '../../types';
import { h1ToH2Router, gameRandom } from './helpers';

// 中后期「有牙的」系统性危机 — Destructive late-game crises (T2 part 2).
// Purpose: break the post-GC/L5「躺赢」autopilot by injecting shocks that can actually
// SET BACK progress (wipe income / level, force re-employment under age discrimination),
// not just chip health. Each keeps AGENCY + a recovery path (reskill / severance /
// down-level), so it's brutal but not a guaranteed dead-end. Pairs with the age-scaled
// interview penalty in job_hunt (中年 ageism) that makes re-employment genuinely harder.
// Rules kept: single-choice health loss <= 15; charm capped; unemployment forces tc=0
// (also enforced centrally); every event has an available choice; once-per-life via seen.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
const seen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

export const midGameCrisisEvents: Record<string, GameEvent> = {
  // ---------------- 中年 ageism：性价比之殇 (H1, 在职, age>=42, 一局一次) ----------------
  'midlife_ageism_squeeze': {
    id: 'midlife_ageism_squeeze',
    title: '【中年危机】性价比之殇',
    description: '新来的年轻 VP 在全员会上反复强调「团队要年轻化、要性价比」。你敏锐地嗅到危险：作为组里最资深、也最贵的那个人，你已被悄悄划进了「优化」名单的观察区。',
    choices: [
      {
        text: '忍辱负重：主动收缩 scope、接受降薪，保住这份饭碗',
        effect: (s) => ({
          tc: Math.max(22, Math.floor(s.tc * 0.85)),
          health: Math.max(0, s.health - 8),
          story_flags: seen(s, 'midlife_ageism_squeeze'),
          message: '你咽下了中年人的现实：主动交出核心项目、接受了一轮降薪，用「性价比」换来了暂时的安稳。饭碗保住了，但心气也磨掉了一截。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '不服老，硬刚证明价值 (赌一把，败则被优化)',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.30 + (s.leetcode / 250) + ((s.network || 10) / 200));
          return win
            ? { leetcode: Math.min(100, s.leetcode + 6), network: Math.min(100, (s.network || 10) + 4), health: Math.max(0, s.health - 10), story_flags: seen(s, 'midlife_ageism_squeeze'), message: '你用一场硬仗回击了偏见：主导交付了一个年轻人啃不动的硬核项目，VP 当众改口。姜还是老的辣，你稳住了阵脚。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 12), story_flags: seen(s, 'midlife_ageism_squeeze'), message: '你的硬刚被解读为「不合作、难管理」。年底名单出炉，你还是被「优化」了——中年失业的寒意，扑面而来。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '体面离场：拿赔偿走人，凭积蓄考虑转型或提前 FIRE',
        condition: employed,
        effect: (s) => ({
          cash: parseFloat((s.cash + Math.min(20, Math.max(3, s.tc * 0.5))).toFixed(1)),
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 4),
          story_flags: seen(s, 'midlife_ageism_squeeze'),
          message: '你没有恋战，谈妥了一笔体面的补偿金潇洒转身。前路未定，但口袋里的积蓄给了你重新选择人生的底气。',
        }),
        nextEventId: 'job_hunt',
      },
    ],
  },

  // ---------------- 整组被 AI 砍 (H1, 在职大厂, year>=2024, 一局一次) ----------------
  'org_ai_wipeout': {
    id: 'org_ai_wipeout',
    title: '【时代碾压】整条业务线被 AI 抹平',
    description: '大模型海啸拍了下来：公司高层宣布，你所在的整条业务线将由 AI 工具与 Agent 全面替代，全组就地解散。这一次不是你表现不好——是你这个岗位，从此不存在了。',
    choices: [
      {
        text: '拼命 reskill：抢转公司前沿 AI 大模型核心组 (需硬核算法，赌一把)',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.65, 0.25 + (s.leetcode / 200));
          return win
            ? { transferred_to_ai: true, job_type: 'big_tech', tc: Math.max(30, s.tc - 6), health: Math.max(0, s.health - 12), leetcode: Math.min(100, s.leetcode + 8), story_flags: seen(s, 'org_ai_wipeout'), message: '你玩命恶补大模型与 Infra，硬是从裁员名单里杀出一条血路，转岗进了公司最前沿的 AI 核心组！包裹略降，但你踩上了时代的船头。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 12), leetcode: Math.min(100, s.leetcode + 4), story_flags: seen(s, 'org_ai_wipeout'), message: '内部转岗竞争惨烈，核心组只要顶尖选手。你没能挤进那扇窄门，最终还是随全组一起被裁——技术浪潮不等人。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '拿 N+2 赔偿，体面离场再战',
        condition: employed,
        effect: (s) => ({
          cash: parseFloat((s.cash + Math.min(25, Math.max(4, s.tc * 0.6))).toFixed(1)),
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.max(0, s.health - 4),
          story_flags: seen(s, 'org_ai_wipeout'),
          message: '你签下了 N+2 赔偿协议。整组一起被时代抛下虽然憋屈，但拿着这笔钱，你还有底气重新出发。',
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '降维求生：接受去小厂 / 早期 startup 续命',
        condition: employed,
        effect: (s) => ({
          job_type: 'startup',
          company: undefined,
          level: undefined,
          tc: Math.max(18, Math.floor(s.tc * 0.6)),
          health: Math.max(0, s.health - 8),
          is_new_job: true,
          story_flags: seen(s, 'org_ai_wipeout'),
          message: '你放下大厂身段，去了一家还在找 PMF 的小 startup 续命。包裹缩水不少，但至少饭碗还在、故事还能继续写。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
