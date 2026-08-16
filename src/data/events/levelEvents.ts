import type { GameEvent, GameState, StoryFlags } from '../../types';
import { h1ToH2Router, gameRandom, stampSeen, addImpact } from './helpers';

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
const seen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

export const levelEvents: Record<string, GameEvent> = {
  // ---------------- 入门 (L3 / L4 / 初级研发): 杂活与 oncall 地狱 ----------------
  'level_entry_grunt_work': {
    id: 'level_entry_grunt_work',
    title: '初级工程师：杂活与 Oncall 地狱',
    description: '作为组里最 junior 的人，你被塞满了没人愿意接的 oncall 值班、线上 bug 修复和文档杂活，离「有影响力的核心项目」似乎遥遥无期。',
    choices: [
      {
        text: '埋头把脏活累活做到极致，用可靠度攒满老板与同事的信任',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          network: Math.min(100, (s.network || 10) + 4),
          health: Math.max(0, s.health - 8),
          story_flags: seen(s, 'level_entry_grunt_work'),
          message: '你把每一次 oncall 和每一个小 bug 都处理得干净利落，逐渐成了组里「靠谱」的代名词。老板开始把更重要的活交给你。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '主动找老板争取一块有影响力的模块来 own',
        condition: employed,
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          leetcode: Math.min(100, s.leetcode + 3),
          health: Math.max(0, s.health - 5),
          story_flags: seen(s, 'level_entry_grunt_work'),
          message: '你鼓起勇气在 1:1 上表达了想承担更大责任的意愿。老板欣赏你的主动，划给你一块虽小但可见的模块，你的成长曲线陡然上扬。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '先稳住节奏，按部就班攒经验，别一上来就 burnout',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          leetcode: Math.min(100, s.leetcode + 3),
          story_flags: seen(s, 'level_entry_grunt_work'),
          message: '你告诉自己职业生涯是场马拉松。你不急不躁地打好基础、养好身体，为后面的冲刺蓄力。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- 资深 (L5 Senior): 高原期 / 资深永动机 ----------------
  'level_senior_plateau': {
    id: 'level_senior_plateau',
    title: '资深永动机：Senior 的高原期',
    description: '作为 L5 Senior，你成了组里的救火队员——所有人的疑难杂症都来找你。但你隐隐发现自己卡在了原地，离 Staff 那道「影响力与政治」的天堑越来越远。',
    choices: [
      {
        text: '主动扩 scope、抢跨组大项目，争取 Staff 的 Sponsorship (冲天花板)',
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
        text: '接受「常青 Senior」的定位，守住 WLB、深耕技术手艺',
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
    title: 'Staff 的「胶水工作」困境',
    description: '升到 Staff+ 后，你发现大量时间花在了没人看得见却至关重要的「胶水工作」——跨组对齐、救火续命、带教新人。这些都不会写进你的晋升 packet，但整个组织都离不开它们。',
    choices: [
      {
        text: '默默做好胶水工作，当组织不可或缺的粘合剂 (无曝光但稳)',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 8),
          health: Math.max(0, s.health - 6),
          story_flags: seen(s, 'level_staff_glue_work'),
          message: '你选择成为团队的定海神针，默默扛下所有跨组协调与救火。虽然这些功劳很难量化、晋升也慢了，但你赢得了整个组织发自内心的信赖。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '抓一个高曝光的旗舰大项目，博 VP 眼球冲 L7/L8 (高波动)',
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
};
