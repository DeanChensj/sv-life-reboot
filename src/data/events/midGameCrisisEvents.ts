import type { GameEvent, GameState } from '../../types';
import { h1ToH2Router, gameRandom, addImpact } from './helpers';

// 中后期「有牙的」系统性危机 — Destructive late-game crises (T2 part 2).
// Purpose: break the post-GC/L5「躺赢」autopilot by injecting shocks that can actually
// SET BACK progress (wipe income / level, force re-employment under age discrimination),
// not just chip health. Each keeps AGENCY + a recovery path (reskill / severance /
// down-level), so it's brutal but not a guaranteed dead-end. Pairs with the age-scaled
// interview penalty in job_hunt (中年 ageism) that makes re-employment genuinely harder.
// Rules kept: single-choice health loss <= 15; charm capped; unemployment forces tc=0
// (also enforced centrally); every event has an available choice; once-per-life via seen.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;

export const midGameCrisisEvents: Record<string, GameEvent> = {
  // ---------------- 中年 ageism：性价比之殇 (H1, 在职, age>=42, 一局一次) ----------------
  'midlife_ageism_squeeze': {
    id: 'midlife_ageism_squeeze',
    oncePerLife: true,
    title: '【中年危机】性价比之殇',
    description: '新来的年轻 VP 在全员会上反复强调「团队要年轻化、要性价比」。你敏锐地嗅到危险：作为组里最资深、也最贵的那个人，你已被悄悄划进了「优化」名单的观察区。',
    choices: [
      {
        text: '【忍辱负重求稳】主动收缩 Scope、接受降薪，保住这份饭碗',
        effect: (s) => ({
          tc: Math.min(s.tc, Math.max(22, Math.floor(s.tc * 0.85))),
          health: Math.max(0, s.health - 8),
          message: '你咽下了中年人的现实：主动交出核心项目、接受了一轮降薪，用「性价比」换来了暂时的安稳。饭碗保住了，但心气也磨掉了一截。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【正面硬刚证明价值】不服老、不退缩，主动承接高难度攻坚项目自证价值',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.30 + (s.leetcode / 250) + ((s.network || 10) / 200));
          return win
            ? { leetcode: Math.min(100, s.leetcode + 6), network: Math.min(100, (s.network || 10) + 4), health: Math.max(0, s.health - 10), message: '你用一场硬仗回击了偏见：主导交付了一个年轻人啃不动的硬核项目，VP 当众改口。姜还是老的辣，你稳住了阵脚。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 12), message: '你的硬刚被解读为「不合作、难管理」。年底名单出炉，你还是被「优化」了——中年失业的寒意，扑面而来。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '【体面拿钱离场】体面离场：拿赔偿走人，凭积蓄考虑转型或提前 FIRE',
        condition: employed,
        effect: (s) => ({
          cash: parseFloat((s.cash + Math.min(20, Math.max(3, s.tc * 0.5))).toFixed(1)),
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 4),
          message: '你没有恋战，谈妥了一笔体面的补偿金潇洒转身。前路未定，但口袋里的积蓄给了你重新选择人生的底气。',
        }),
        nextEventId: 'job_hunt',
      },
    ],
  },

  // ---------------- 整组被 AI 砍 (H1, 在职大厂, year>=2024, 一局一次) ----------------
  'org_ai_wipeout': {
    id: 'org_ai_wipeout',
    oncePerLife: true,
    title: '【时代碾压】整条业务线被 AI 抹平',
    description: '大模型海啸拍了下来：公司高层宣布，你所在的整条业务线将由 AI 工具与 Agent 全面替代，全组就地解散。这一次不是你表现不好——是你这个岗位，从此不存在了。',
    choices: [
      {
        text: '【拼命 Reskill 申请转组】恶补前沿大模型技术栈，申请内部转岗至 AI 核心组',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.65, 0.25 + (s.leetcode / 200));
          return win
            ? { transferred_to_ai: true, job_type: 'big_tech', tc: Math.max(30, s.tc - 6), health: Math.max(0, s.health - 12), leetcode: Math.min(100, s.leetcode + 8), message: '你玩命恶补大模型与 Infra，硬是从裁员名单里杀出一条血路，转岗进了公司最前沿的 AI 核心组！包裹略降，但你踩上了时代的船头。' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 12), leetcode: Math.min(100, s.leetcode + 4), message: '内部转岗竞争惨烈，核心组只要顶尖选手。你没能挤进那扇窄门，最终还是随全组一起被裁——技术浪潮不等人。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '【拿 N+2 赔偿体面离场】拿 N+2 赔偿，体面离场再战',
        condition: employed,
        effect: (s) => ({
          cash: parseFloat((s.cash + Math.min(25, Math.max(4, s.tc * 0.6))).toFixed(1)),
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.max(0, s.health - 4),
          message: '你签下了 N+2 赔偿协议。整组一起被时代抛下虽然憋屈，但拿着这笔钱，你还有底气重新出发。',
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【降维小厂续命】降维求生：接受去小厂 / 早期 Startup 续命',
        condition: employed,
        effect: (s) => ({
          job_type: 'startup',
          company: undefined,
          level: undefined,
          tc: Math.max(18, Math.floor(s.tc * 0.6)),
          health: Math.max(0, s.health - 8),
          is_new_job: true,
          message: '你放下大厂身段，去了一家还在找 PMF 的小 startup 续命。包裹缩水不少，但至少饭碗还在、故事还能继续写。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ================= Impact 下行事件 (impact 挫折,让高阶晋升要求"持续"影响力而非单纯累积) =================
  // 仅对 impact 职业、且已攒下值得一失的影响力 (impact>=15) 的在职玩家注入,一局各一次。
  // 每个都保留 AGENCY (有缓解损失的选项),但净扣 impact,给冲 L6/L7 的路上制造真实挫折。

  // 1. 重组砍项目
  'impact_project_cancelled': {
    id: 'impact_project_cancelled',
    oncePerLife: true,
    title: '【重组风暴】你主导的核心项目被一夜砍掉',
    description: '新任 VP 上任三把火，一纸重组令下，你倾注两年心血、马上要出成果的核心项目被直接砍掉，团队打散。多年攒下的影响力 (Impact) 面临大幅缩水。',
    choices: [
      {
        text: '【快速包装内部平台】快速转身：把技术资产包装成内部平台，抢占新方向的话语权',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.65, 0.35 + (s.leetcode / 250) + ((s.network || 10) / 200));
          return win
            ? { impact: addImpact(s, -4), network: Math.min(100, (s.network || 10) + 4), leetcode: Math.min(100, s.leetcode + 3), health: Math.max(0, s.health - 8), message: '【绝地转身】你把被砍项目的技术沉淀重新包装成一个内部平台，抢下了新方向的话语权，影响力损失被控制到最小！' }
            : { impact: addImpact(s, -10), health: Math.max(0, s.health - 10), message: '【心血付诸东流】新方向已被别人占坑，你的抢救未能奏效，两年积累的影响力大幅缩水，只能从头再来。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【平静接受转岗】接受现实：平静转岗到别的组，从零开始沉淀心态',
        effect: (s) => ({ impact: addImpact(s, -10), health: Math.max(0, s.health - 4), message: '【认栽重来】你接受了组织的安排，转到新组从零做起。影响力清零了一大截，但也卸下了包袱。' }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // 2. 旗舰发布翻车
  'impact_launch_incident': {
    id: 'impact_launch_incident',
    oncePerLife: true,
    title: '【发布翻车】你 own 的旗舰功能上线即 P0 事故',
    description: '你负责的旗舰功能上线当天引发大规模线上故障，登上内部事故榜，高管在事故复盘会上震怒。你之前攒下的技术声誉 (Impact) 岌岌可危。',
    choices: [
      {
        text: '【主动担当通宵修复】扛下来：牵头复盘、通宵修复、写事故报告担当到底',
        effect: (s) => ({ impact: addImpact(s, -4), leetcode: Math.min(100, s.leetcode + 4), network: Math.min(100, (s.network || 10) + 3), health: Math.max(0, s.health - 12), message: '【担当挽回口碑】你没有回避，牵头三天两夜复盘修复并写出高质量事故报告，高管看到了你的担当，影响力损失被止住。' }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【战术甩锅下游依赖】甩锅：把责任推给下游依赖与 On-call，撇清自己',
        effect: (s) => ({ impact: addImpact(s, -10), network: Math.max(0, (s.network || 10) - 4), health: Math.max(0, s.health - 6), message: '【口碑双损】你撇清了直接责任，但甩锅的姿态被同事看在眼里，影响力与人脉口碑一起受损。' }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // 3. 被边缘化去维护 legacy
  'impact_legacy_maintenance': {
    id: 'impact_legacy_maintenance',
    oncePerLife: true,
    title: '【边缘化】你被调去长期维护没人要的 legacy 系统',
    description: '组织调整，你被 PM「借调」去维护一个即将下线、却又不敢关的 legacy 系统。没有新项目、没有曝光，同期的人一个个超过你，影响力 (Impact) 悄悄流失。',
    choices: [
      {
        text: '【突围做 Side Project】主动突围：一边维护一边偷做高曝光 Side Project 争取转回主线',
        condition: employed,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.30 + (s.leetcode / 250) + ((s.network || 10) / 200));
          return win
            ? { impact: addImpact(s, -3), leetcode: Math.min(100, s.leetcode + 5), health: Math.max(0, s.health - 10), message: '【成功突围】你的 side project 意外拿到高层关注，成功转回主线战场，影响力止跌回稳！' }
            : { impact: addImpact(s, -8), health: Math.max(0, s.health - 8), message: '【继续边缘】side project 没能激起水花，你依旧困在 legacy 维护里，影响力持续流失。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【佛系躺平维护】躺平维护：反正 WLB 拉满，养生要紧',
        effect: (s) => ({ impact: addImpact(s, -10), health: Math.min(100, s.health + 10), message: '【彻底躺平】你安心当起了 legacy 系统的守墓人，身体舒服了，但影响力与职业前景一起停摆。' }),
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
