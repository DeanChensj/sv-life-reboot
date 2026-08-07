import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const tradingEvents: Record<string, GameEvent> = {
  'stock_market_annual_gamble': {
    id: 'stock_market_annual_gamble',
    title: '资产配置：股票市场操作',
    description: '你可以自由配置你的现金和股票仓位。注意：股票资产在年终结算时会受到宏观大盘（牛市/熊市）的剧烈影响，而现金则不受波动影响。',
    choices: [
      {
        text: '【买入股票】把闲置现金投资大盘 (买入 $10w)',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({
          cash: s.cash - 10,
          stocks: (s.stocks || 0) + 10,
          message: '你成功将 $10w 现金转入股票账户。'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【大举加仓】将大部分闲置现金转入股市 (买入 $50w)',
        condition: (s) => s.cash >= 50,
        effect: (s) => ({
          cash: s.cash - 50,
          stocks: (s.stocks || 0) + 50,
          message: '你大手笔加仓，将 $50w 现金买入股票！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【卖出套现】从股市中套现部分资金 (卖出 $10w)',
        condition: (s) => (s.stocks || 0) >= 10,
        effect: (s) => ({
          cash: s.cash + 10,
          stocks: (s.stocks || 0) - 10,
          message: '你成功卖出了 $10w 股票，落袋为安。'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【清仓股票】一键清仓所有股票，转回现金 (全部卖出)',
        condition: (s) => (s.stocks || 0) > 0,
        effect: (s) => ({
          cash: s.cash + (s.stocks || 0),
          stocks: 0,
          message: '你清空了所有股票仓位，目前全现金持有，防守反击！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【梭哈期权】拼了！用小额现金炒 0DTE 末日期权 (投入 $5w)',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const hit = Math.random() < (0.08 + s.luck / 500); // 8% base chance
          if (hit) {
            return {
              cash: s.cash + 20, // Turn 5w into 25w (+$20w net cash)
              charm: Math.max(0, s.charm - 2),
              message: '【暴富奇迹！】你赌对了非农数据日的末日期权，一夜之间 $5w 变成了 $25w！截图发在群里被尊称为华尔街之狼，但也有不少人觉得你是个疯狂赌徒敬而远之。'
            };
          } else {
            return {
              cash: s.cash - 5, // Lose all
              health: Math.max(0, s.health - 12),
              message: '【血本无归】期权在归零那刻一文不值...你的 $5w 投资瞬间蒸发。你痛苦地删掉了交易软件。'
            };
          }
        },
        nextEventId: midYearEventRouter,
      },
      {
        text: '按兵不动：维持目前的仓位组合进入年终结算',
        effect: (s) => ({
          message: '你决定什么都不做，做时间的朋友，静静等待跨年的钟声。'
        }),
        nextEventId: midYearEventRouter,
      }
    ]
  },

  'stock_crash': {
    id: 'stock_crash',
    title: '美联储加息，宏观经济遇冷',
    description: '美股大盘全线暴跌，纳斯达克惨不忍睹。你的公司股价腰斩，导致你今年的 RSU 价值大幅缩水！',
    choices: [
      {
        text: '心在滴血，但也只能接受现实 (总包 TC 缩水 20%)',
        effect: (s) => ({
          tc: Math.floor(s.tc * 0.8),
          stocks: Math.floor((s.stocks || 0) * 0.75),
          macro_economy: 'bear',
          health: s.health - 15,
          message: '大盘大跌入熊市！打开券商账户看了一眼股票持仓蒸发 25%，你决定今年圣诞节改去家里蹲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '此时不博何时博？加杠杆抄底！(需现金 > 30w)',
        condition: (s) => s.cash >= 30,
        effect: (s) => {
           const winRate = 0.2 + (s.luck / 100) * 0.4; // 抄底成功率 20% - 60%
           const win = Math.random() < winRate;
           return win 
             ? { tc: Math.floor(s.tc * 0.9), stocks: Math.floor((s.stocks || 0) * 1.15), cash: s.cash + 35, message: '虽然宏观大盘熊市让基本薪酬受压，但你精准在最低点抄底了 AI 龙头，逆势吃到反弹波段大赚 $35w，股票市值也有所增值！' }
             : { tc: Math.floor(s.tc * 0.8), stocks: Math.floor((s.stocks || 0) * 0.70), cash: s.cash - 25, health: s.health - 30, message: '抄底抄在半山腰，现金和股票惨遭双杀，市场继续在深度熊市中煎熬。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'rsu_vesting_crash': {
    id: 'rsu_vesting_crash',
    title: '【归属日渡劫】从准备买 Palo Alto 到看 Milpitas 打折便当',
    description: '入职第四年，传说中的 4-Year RSU Vesting Cliff (股票归属崖) 正式到来，然而恰逢宏观加息加科技股大暴跌，公司股价从你入职时的 $380 暴跌至 $42。\n你打开 E*TRADE 账户，原本预估的 $40 万美元股票市值缩水成了“能够买两台二手特斯拉”。',
    choices: [
      {
        text: '心理防御倒塌：“哥们，你们厂现在有 Referral 吗？包身份就行，TC 随缘！”',
        effect: (s) => ({ tc: Math.max(10, s.tc - 5), health: s.health - 10, is_new_job: true, message: '你含泪跳槽去了一家给钱更少但至少股价底部的公司，重新开始坐 4 年股票牢。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '拍小红书 VLOG《28岁硅谷码农资产蒸发 60%，带你体验极简挂壁生活》',
        effect: (s) => ({ cash: s.cash + 15, charm: Math.min(25, s.charm + 4), message: '网友太喜欢看硅谷中产受苦了！你的小红书粉丝暴涨，光是电竞椅和挂壁盒饭的广告费就填补了股票亏损。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '死扛信仰！每天去大华超市买促销打折盒饭，熬到中东主权基金收购',
        effect: (s) => ({ health: s.health - 12, luck: Math.min(99, (s.luck || 20) + 8), message: '你开启了硅谷极简苦行僧模式，胃功能下降了，但心智磨砺得坚不可催。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'trader_annual_strategy': {
    id: 'trader_annual_strategy',
    title: '【全职 Day Trader】年度操盘策略选择',
    description: '作为全职 Trader，你不再依靠大厂发放的固定工资。今年的美股/加密货币市场波谲云诡，你打算采用哪种操盘策略？',
    choices: [
      {
        text: '【稳健对冲股息策略】主要布局标普500/高股息 ETF 与跨期对冲期权 (低风险)',
        effect: (s) => {
          const isBear = s.macro_economy === 'bear';
          const isBull = s.macro_economy === 'bull';
          const baseRate = isBull ? 0.10 : (isBear ? -0.04 : 0.06);
          const luckRate = ((s.luck || 20) / 1000);
          const gainRate = baseRate + luckRate;
          const profit = s.cash * gainRate;
          const cappedTc = Math.max(0, Math.min(30, parseFloat(profit.toFixed(1))));
          
          if (profit >= 0) {
            return {
              mid_year: true, season_stage: 'h1',
              tc: cappedTc,
              health: Math.max(0, s.health - 4),
              message: ` 稳健盈利！凭借严谨的风控与股息配置，本年度操盘收益率 +${(gainRate * 100).toFixed(1)}% (+${cappedTc}w 美元生活提取)！`
            };
          } else {
            const loss = Math.min(Math.abs(profit), 20);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(5, s.cash - loss),
              health: Math.max(0, s.health - 6),
              message: ` 熊市震荡！宏观大盘整体回调，对冲仓位受损 -${loss.toFixed(1)}w 美元。好在你严格止损，保住了绝大部分主力资金。`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【重仓科技龙头股票】梭哈英伟达 (NVDA) / 特斯拉 / AI 芯片龙头 (中风险)',
        effect: (s) => {
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.60 : (isBear ? 0.35 : 0.48);
          const isWin = Math.random() < winRate;
          if (isWin) {
            const gain = Math.min(45, s.cash * 0.30);
            return {
              mid_year: true, season_stage: 'h1',
              tc: parseFloat(gain.toFixed(1)),
              health: Math.max(0, s.health - 6),
              message: ` 飞天暴赚！你重仓的 AI 科技巨头股价随着算力风口暴涨！账面盈利 +${gain.toFixed(1)}w 美元！`
            };
          } else {
            const loss = Math.min(s.cash * 0.20, 30);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(8, s.cash - loss),
              health: Math.max(0, s.health - 10),
              message: ` 宏观回调！科技板块遭遇资金阶段性获利砸盘，仓位回调 -${loss.toFixed(1)}w 美元！`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高杠杆末日期权】重仓 0DTE 末日期权与 Web3 杠杆博弈 (极高风险)',
        effect: (s) => {
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.40 : (isBear ? 0.18 : 0.28);
          const roll = Math.random();
          if (roll < winRate) {
            const doubleGain = Math.min(60, s.cash * 0.50);
            return {
              mid_year: true, season_stage: 'h1',
              tc: parseFloat(doubleGain.toFixed(1)),
              health: Math.max(0, s.health - 10),
              message: ` 奇迹大胜！末日期权精准抓中财报暴涨行情，本金暴赚 +${doubleGain.toFixed(1)}w 美元！`
            };
          } else if (roll < winRate + 0.40) {
            const drop = Math.min(s.cash * 0.30, 40);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(5, s.cash - drop),
              health: Math.max(0, s.health - 12),
              message: ` 惨遭反杀！黑天鹅剧烈波动导致期权权利金归零，本金大撤退 -${drop.toFixed(1)}w 美元！`
            };
          } else {
            const bust = Math.min(s.cash * 0.55, 60);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: Math.max(2, s.cash - bust),
              health: Math.max(0, s.health - 15),
              message: ` 极端爆仓！杠杆触发强制平仓连环踩踏，数十万本金瞬间灰飞烟灭！你欲哭无泪，备受精神打击...`
            };
          }
        },
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'quant_stress': {
    id: 'quant_stress',
    title: '华尔街的脉搏',
    description: '最近股市剧烈波动，你的量化策略出现了巨大的 Drawdown (回撤)。',
    choices: [
      {
        text: '顶着高压，手动干预策略并加大杠杆！(45% 概率获得 $250w 巨额 Bonus)',
        effect: (s) => {
          const win = Math.random() < 0.45;
          return win 
            ? { cash: s.cash + 250, health: s.health - 25, message: ' 华尔街之狼！这波疯狂杠杆让你单月帮基金出海捕捞暴赚！老板亲手为你颁发了 $250w 美金的年终 Bonus 巨额支票！' }
            : { cash: Math.max(0, s.cash - 15), health: s.health - 30, laid_off: true, tc: 0, job_type: 'unemployed', message: '黑天鹅爆发！杠杆爆仓导致策略穿仓，不仅 Bonus 归零，你还收到了 HR 的解雇协议。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '相信数学，不干预策略 (求稳退守)',
        effect: (s) => ({ health: s.health - 10, cash: s.cash + 15, message: '虽然每天看着回撤心惊肉跳，但你还是忍住了干预的冲动。最终策略慢慢回本，年底拿到了小额 Bonus。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'crypto_scam': {
    id: 'crypto_scam',
    title: '微信群里的财富密码',
    description: '一个高中同学突然拉你进了一个 Web3 交流群，里面的人天天晒豪车和几十倍收益的截图。',
    choices: [
      {
        text: '搏一搏，单车变摩托！投入 $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const winRate = 0.01 + (Math.min(45, s.luck) / 100) * 0.15;
          const win = Math.random() < winRate;
          return win 
            ? { cash: s.cash + 15, message: '你买的土狗币居然真的小火了一把！你在高点果断卖出提现，狠赚了一笔！' }
            : { cash: Math.max(0, s.cash - 5), health: Math.max(0, s.health - 7), imageUrl: 'images/crypto_crash.jpg', message: '经典的杀猪盘。项目方第二天就跑路了，你的钱全都变成了空气币。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '天上不会掉馅饼，退群保平安',
        effect: (s) => ({ charm: s.charm + 1, message: '你敏锐地察觉到了这是骗局，并且在小红书上发帖曝光，获得了不少点赞。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'nvidia_stock_surge': {
    id: 'nvidia_stock_surge',
    title: '【AI 狂潮暴富】NVDA 英伟达财报暴涨 30%',
    description: '英伟达发布爆表财报！黄教主身穿皮衣宣布 Blackwell 芯片供不应求。全球科技股与大厂 RSU 随着股价飙升狂欢！作为硅谷打工人，你面临个人资产配置调整：',
    choices: [
      {
        text: '【全仓追高芯片股】把剩余流动资金全部追高 Buying NVDA / AMD',
        effect: (s) => {
          const win = Math.random() < 0.45;
          const currentStocks = s.stocks || 0;
          const boostedStocks = Math.floor(currentStocks * 1.35);
          const droppedStocks = Math.floor(currentStocks * 0.85);
          return win
            ? { cash: s.cash + 15, stocks: boostedStocks, macro_economy: 'bull', luck: Math.min(99, s.luck + 5), message: 'AI 牛市暴发！英伟达股价创历史新高，你持有的科技股账户飙升 35%！净资产暴涨！' }
            : { cash: Math.max(0, s.cash - 5), stocks: droppedStocks, macro_economy: 'bull', message: '追高在阶段性山顶！财报后利好出尽遭资金砸盘，你持有的科技股下跌 15%，现金被套牢。' };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【落袋为安抛售套现】把归属的 RSU 及时 Sell，锁住现金买国债/S&P500',
        effect: (s) => ({
          cash: s.cash + 8,
          macro_economy: 'bull',
          message: '你稳健落袋为安！拿着现金稳稳躺赚高息，理财心态稳如老狗。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  }
};
