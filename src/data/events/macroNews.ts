import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const macroNewsEvents: Record<string, GameEvent> = {
  'news_bull_market_start': {
    id: 'news_bull_market_start',
    title: ' 突发新闻：史诗级牛市开启！',
    description: '手机弹出华尔街日报推送："美联储意外宣布降息 50 个基点，纳斯达克指数创历史新高！各大 AI 独角兽宣布完成百亿融资！"\n\nBlind 上的跳槽包裹满天飞，连前台都在聊股票。硅谷的空气里充满了金钱的味道。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'bull', message: '宏观经济进入【狂暴大牛市】！现在大厂疯狂扩招，面试门槛大幅降低，年底 RSU 必定暴涨！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'news_bear_market_crash': {
    id: 'news_bear_market_crash',
    title: ' 突发新闻：资本寒冬降临！',
    description: '手机弹出 Bloomberg 推送："通胀超预期，美联储宣布暴力加息！纳斯达克单日暴跌 5%！"\n\n紧接着，Blind 上传出多个大厂即将冻结招聘 (Hiring Freeze) 甚至筹备万人大裁员的风声。硅谷的资本盛宴戛然而止。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'bear', message: '宏观经济进入【裁员大熊市】！现在求职面试将变成地狱难度 (需要刷海量 LeetCode)，年底 RSU 也会严重缩水！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'news_neutral_market': {
    id: 'news_neutral_market',
    title: '️ 突发新闻：市场回归理性',
    description: '经历了前段时间的剧烈波动，华尔街和硅谷大厂达成了某种默契。\n\n"各大科技公司表示将专注盈利和核心业务，停止无序扩张，但也不会进行大规模裁员。" 市场情绪逐渐平稳。',
    choices: [
      {
        text: '了解 (Ack)',
        effect: (s) => ({ macro_economy: 'neutral', message: '宏观经济回归【正常震荡期】。一切按部就班，靠实力说话。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'macro_ai_agent_revolution': {
    id: 'macro_ai_agent_revolution',
    title: '【时代浪潮】全行业 AI 智能体开发革命爆发',
    description: '全行业迎来 AI Coding Agent 与大模型自动化研发浪潮！不会使用 Agent 辅助开发的工程师面临效率考评危机，而精通 Agent 工作流的工程师人效直接翻倍。',
    choices: [
      {
        text: '【深度掌握 Agent 工作流】将 Agent 工具链深度融入日常研发与架构设计',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          impact: (s.impact || 0) + 6,
          health: Math.min(100, s.health + 5),
          story_flags: { ...(s.story_flags || {}), macro_ai_revolution_seen: true },
          message: '你熟练驾驭 AI Agent 编写样板代码与自动化测试，研发效率暴涨 300%！成为组内的技术提效先锋！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【深耕底层内核与操作系统】专注做底层操作系统与内核编译器的硬核优化',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 10),
          impact: (s.impact || 0) + 4,
          story_flags: { ...(s.story_flags || {}), macro_ai_revolution_seen: true },
          message: '你深耕底层系统的性能天花板，在算力瓶颈时代成为不可替代的底层系统级专家！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'macro_liquidity_rate_cycle': {
    id: 'macro_liquidity_rate_cycle',
    title: '【行业周期】资本市场紧缩与“高效运营之年”',
    description: '各大科技巨头纷纷宣布进入“高效运营之年 (Year of Efficiency)”，削减非核心项目，冻结招人，扁平化管理层级。',
    choices: [
      {
        text: '【主导核心创收项目】主动抢占公司最能赚钱的核心业务线',
        reqBadge: '需主导核心项目或深厚人脉',
        condition: (s) => (s.impact || 0) >= 10 || (s.network || 0) >= 15,
        effect: (s) => ({
          impact: (s.impact || 0) + 8,
          tc: s.tc + 4,
          story_flags: { ...(s.story_flags || {}), macro_efficiency_seen: true },
          message: '在收缩周期中，你牢牢站稳了公司最核心的现金牛项目，甚至逆势获得了加薪与股票奖励！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【低调防守苟住】少说话多干活，低调避开任何裁员风头',
        effect: (s) => ({
          health: Math.max(0, s.health - 4),
          story_flags: { ...(s.story_flags || {}), macro_efficiency_seen: true },
          message: '你在寒冬中默默完成日常 OKR，安然度过了本轮收缩周期。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'macro_rto_office_wars': {
    id: 'macro_rto_office_wars',
    title: '【政策剧变】各大厂全面收紧远程办公，推行强制 RTO',
    description: '科技巨头们相继取消 Remote 远程政策，强制要求每周到岗 4~5 天并挂钩考勤打卡。硅谷 101/237 高速再次排起长龙。',
    choices: [
      {
        text: '【顺应政策回公司办公】享受免费三餐与办公室人际社交，积极在 Leadership 面前露脸',
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 6),
          health: Math.max(0, s.health - 4),
          story_flags: { ...(s.story_flags || {}), macro_rto_seen: true },
          message: '你在办公室与各组同事恢复了茶水间交流，虽然通勤略有消耗，但能见度大幅提升。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【据理力争申请 Exception】凭核心架构不可替代性，成功拿到专属远程豁免',
        reqBadge: '需 Impact >= 15 或 LeetCode >= 75',
        condition: (s) => (s.impact || 0) >= 15 || s.leetcode >= 75,
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          story_flags: { ...(s.story_flags || {}), macro_rto_seen: true },
          message: '凭借你在核心系统上的绝对主导权，VP 亲自批准了你的专属 Remote 豁免！继续享受神仙 WLB！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
};
