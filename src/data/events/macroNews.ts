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
  }
};
