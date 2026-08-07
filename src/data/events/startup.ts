import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const startupEvents: Record<string, GameEvent> = {
  'startup_crisis': {
    id: 'startup_crisis',
    title: '初创危机',
    description: '你的 Startup 最近融资不太顺利，账上的钱只够发 3 个月工资了。',
    choices: [
      {
        text: '相信老板的 PPT，自愿降薪换取更多期权 (博取小概率收购变现)',
        effect: (s) => {
          const win = Math.random() < 0.05;
          return win 
            ? { cash: s.cash + 150, message: ' 奇迹爆发！公司被大厂以数亿美元溢价收购，你的早期期权直接兑现 $150w 现金！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, job_type: 'unemployed', message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('收购') ? h1ToH2Router(s) : 'job_hunt',
      },
      {
        text: '【带资领投】自己掏 $10w 领投公司 Seed 轮自救',
        reqBadge: '现金>=10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => {
          const win = Math.random() < 0.25;
          return win
            ? { cash: s.cash + 60, tc: s.tc + 10, message: '你带资入组！公司靠你的资金撑到了 A 轮融资并估值大暴涨，你的 TC 与期权收益双双上涨！' }
            : { cash: s.cash - 10, tc: 0, laid_off: true, job_type: 'unemployed', health: s.health - 20, message: '砸进去的 $10w 没能挽救寒冬，公司还是倒闭了...你不仅没了工作还心痛不已。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '偷偷骑驴找马，准备跑路',
        effect: (s) => ({ health: s.health - 5, tc: 0, cash: s.cash, laid_off: true, job_type: 'unemployed', message: '你一边假装努力工作，一边偷偷刷题。不久后公司果然资金链断裂，你不得不重新找工作。' }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'founder_annual_strategy': {
    id: 'founder_annual_strategy',
    title: '【全职 Founder】公司战略与轮次推进',
    description: '作为初创公司 CEO，你手下带着十几名员工，烧钱率与公司生命线全掌握在你手里。请决定本年度的核心战略：',
    choices: [
      {
        text: '前往 Sand Hill Road (沙丘路) 向顶级 VC 演示 Pitch 寻求融资',
        reqBadge: '需丰富人脉或出众形象',
        condition: (s) => (s.network || 0) >= 20 || (s.charm || 0) >= 18,
        effect: (s) => {
          const stage = s.founder_stage || 'seed';
          const ecoBonus = s.macro_economy === 'bull' ? 0.20 : s.macro_economy === 'bear' ? -0.20 : 0;
          const networkBonus = Math.min(0.20, (s.network || 0) / 100);
          const charmBonus = Math.min(0.15, (s.charm || 0) / 100);
          const successChance = Math.max(0.25, Math.min(0.80, 0.45 + ecoBonus + networkBonus + charmBonus));
          const pass = Math.random() < successChance;

          if (pass) {
            if (stage === 'seed') {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'series_a',
                company_valuation: 2500,
                cash: s.cash + 25,
                tc: 18,
                health: Math.max(0, s.health - 5),
                message: ' 融资大获成功！顶级 VC 领投 $250w 支票（估值 $2500w），你成功套现 $25w 现金并为自己发放了 $18w TC 创始人薪水！'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'exit',
                company_valuation: 7000,
                cash: s.cash + 45,
                tc: 28,
                health: Math.max(0, s.health - 5),
                message: ' B 轮超级融资！红杉资本以 $7000w 估值领投，公司账上资金充沛，离 IPO 上市仅有一步之遥！'
              };
            }
          } else {
            const isDownRound = Math.random() < 0.4;
            if (isDownRound) {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, s.cash - 5),
                company_valuation: Math.max(200, (s.company_valuation || 800) - 300),
                health: Math.max(0, s.health - 15),
                message: ' 估值倒挂 (Down Round)！资本寒冬下 VC 极度挑剔，只肯给折价过桥贷款，严苛的对赌协议让你彻夜难眠，自己垫付了 $5w 现金。'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, s.cash - 3),
                health: Math.max(0, s.health - 12),
                message: ' 融资遇冷！沙丘路跑了 20 家 VC 均表示“赛道拥挤、继续观察”，未能发出 Term Sheet。公司只能继续靠现有资金死撑。'
              };
            }
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高举高打招聘】重金从 Meta/Google 挖掘顶级大牛核心工程组 (需现金>=15w)',
        reqBadge: '现金>=15w',
        condition: (s) => s.cash >= 15,
        effect: (s) => {
          const success = Math.random() < 0.70;
          if (success) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: s.cash - 15,
              company_valuation: (s.company_valuation || 1000) + 1200,
              leetcode: Math.min(100, s.leetcode + 10),
              message: ' 团队战力爆表！大厂 Senior 大牛加盟后研发出颠覆性的 AI Agent 产品，公司估值飙升！'
            };
          } else {
            return {
              mid_year: true, season_stage: 'h1',
              cash: s.cash - 15,
              company_valuation: (s.company_valuation || 1000) + 300,
              health: Math.max(0, s.health - 10),
              message: ' 文化磨合受挫！空降大牛与早期团队理念冲突，消耗了大笔安家费预算但交付延期，公司估值增长有限。'
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【终局 Exit】考虑公司并购 Acq-hire 或准备 纳斯达克 IPO 敲钟上市',
        condition: (s) => (s.company_valuation || 0) >= 2000,
        effect: (s) => {
          const roll = Math.random();
          if (roll < 0.35) {
            // 35% IPO Win
            return {
              status: 'win',
              cash: s.cash + 400,
              message: ' 传奇诞生！公司成功在纳斯达克 IPO 挂牌敲钟！创始人股权套现 $400w 美元，名利双收极速达成 FIRE 终局！'
            };
          } else if (roll < 0.75) {
            // 40% Acqui-hire / Trade Sale (Safe landing with solid cash & Staff position)
            return {
              cash: s.cash + 120,
              job_type: 'big_tech',
              level: 'L6 (Staff)',
              company: 'google',
              tc: 55,
              laid_off: false,
              founder_stage: undefined,
              company_valuation: 0,
              health: Math.max(0, s.health - 5),
              message: ' 成功被收购！Google/Meta 科技巨头以溢价并购了你们的公司。扣除 VC 清算优先权后，创始人获得 $120w 现金分成，并受聘为大厂 L6 Staff 架构师！'
            };
          } else {
            // 25% Fire Sale (Liquidation preference wipes out valuation)
            return {
              cash: s.cash + 20,
              job_type: 'unemployed',
              company: undefined,
              level: '待业',
              laid_off: true,
              founder_stage: undefined,
              company_valuation: 0,
              tc: 0,
              health: Math.max(0, s.health - 15),
              network: (s.network || 0) + 8,
              message: ' 折价清算！市场行情急转直下，公司被低价贱卖清盘。VC 拿走清算优先权后，你仅分得 $20w 离场费。创业虽败，但你积累了宝贵的人脉与创始人经历！'
            };
          }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : (s.laid_off ? 'job_hunt' : h1ToH2Router(s)),
      },
      {
        text: '【精简开支苟活】裁撤非核心人员，收缩战线，努力过冬 (无条件)',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: Math.max(0, s.cash - 3),
          company_valuation: Math.max(100, (s.company_valuation || 1000) - 350),
          health: Math.max(0, s.health - 12),
          message: '资金与资源有限，你决定开源节流，挥泪解雇了一批员工。虽然度过了危机，但公司士气大跌，你的心理压力极大。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'ai_research_crisis': {
    id: 'ai_research_crisis',
    title: 'AGI 的脚步',
    description: '最近 OpenAI 又发了新模型，你在实验室里的项目面临被降维打击的危险。',
    choices: [
      {
        text: '抢占先机，连夜写 Paper 冲击顶会！',
        effect: (s) => {
          const win = Math.random() < (0.55 + s.leetcode / 300);
          return win 
            ? { tc: s.tc + 5, cash: s.cash + 30, stocks: (s.stocks || 0) + 20, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', charm: Math.min(25, (s.charm || 10) + 4), health: s.health - 20, message: ' 论文斩获 NeurIPS Best Paper！你提出的推理大模型架构震惊学术界与工业界！公司立刻发了 $30w Retention Bonus、加配了 $20w 核心股票，并协助加急批复了 O1 签证！' }
            : { health: s.health - 25, cash: s.cash, message: '熬了半个月，结果撞车了别人的工作被直接 Reject，心态炸裂。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '佛系跟进，不争不抢',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '反正公司也不差你这一个项目，你按时下班，每天看着同事们卷生卷死。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  }
};
