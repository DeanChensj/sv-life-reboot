import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear , gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const tradingEvents: Record<string, GameEvent> = {
  'stock_market_annual_gamble': {
    id: 'stock_market_annual_gamble',
    title: '【资产配置】股票市场操作与仓位管理',
    description: '你可以自由配置你的现金和股票仓位。注意：股票资产在年终结算时会受到宏观大盘（牛市/熊市）的剧烈影响，而现金则不受波动影响。',
    choices: [
      {
        text: '【买入股票】把闲置现金投资大盘 (买入 $10w)',
        costBadge: '转出 $10w 现金',
        condition: (s) => s.cash >= 10,
        effect: (s) => ({
          cash: s.cash - 10,
          stocks: (s.stocks || 0) + 10,
          message: '你成功将 $10w 现金转入股票账户。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【大举加仓】将大部分闲置现金转入股市 (买入 $50w)',
        costBadge: '转出 $50w 现金',
        condition: (s) => s.cash >= 50,
        effect: (s) => ({
          cash: s.cash - 50,
          stocks: (s.stocks || 0) + 50,
          message: '你大手笔加仓，将 $50w 现金买入股票！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【卖出套现】从股市中套现部分资金 (卖出 $10w)',
        costBadge: '卖出 $10w 股票',
        condition: (s) => (s.stocks || 0) >= 10,
        effect: (s) => ({
          cash: s.cash + 10,
          stocks: (s.stocks || 0) - 10,
          message: '你成功卖出了 $10w 股票，落袋为安。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【清仓股票】一键清仓所有股票，转回现金 (全部卖出)',
        costBadge: '一键清仓',
        condition: (s) => (s.stocks || 0) > 0,
        effect: (s) => ({
          cash: s.cash + (s.stocks || 0),
          stocks: 0,
          message: '你清空了所有股票仓位，目前全现金持有，防守反击！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【梭哈期权】拼了！用小额现金炒 0DTE 末日期权 (投入 $5w)',
        costBadge: '花费 $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const hit = gameRandom() < (0.08 + Math.min(45, s.luck) / 1000); // 8%-12.5%: stays a losing lottery even at high luck
          if (hit) {
            return {
              cash: s.cash + 20, // Turn 5w into 25w (+$20w net cash)
              charm: Math.max(0, s.charm - 2),
              // Durable flag so the achievement can unlock — by the time achievements are
              // checked, currentEventId has advanced away from this gamble event.
              story_flags: { ...(s.story_flags || {}), wsb_wolf_win: true },
              message: '【暴富奇迹！】你赌对了非农数据日的末日期权，一夜之间 $5w 变成了 $25w！截图发在群里被尊称为华尔街之狼，但也有不少人觉得你是个疯狂赌徒敬而远之。'
            };
          } else {
            return {
              cash: s.cash - 5, // Lose all
              health: Math.max(0, s.health - 12),
              story_flags: { ...(s.story_flags || {}), wsb_leek: true },
              message: '【血本无归】期权在归零那刻一文不值...你的 $5w 投资瞬间蒸发。你痛苦地删掉了交易软件。'
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【卖 Covered Call 备兑期权】卖出持仓股票虚值看涨期权，吃权利金利息 (需持有股票 >= $20w)',
        costBadge: '需股票 >= $20w',
        condition: (s) => (s.stocks || 0) >= 20,
        effect: (s) => {
          const bullMarket = s.macro_economy === 'bull';
          const callAwayProb = bullMarket ? 0.60 : 0.25;
          const calledAway = gameRandom() < callAwayProb;
          const premium = Math.min(5, Math.max(1.5, Math.floor((s.stocks || 20) * 0.04 * 10) / 10)); // 4% premium: $1.5w - $5.0w
          
          if (calledAway) {
            const calledStocks = Math.min(s.stocks || 20, 20); // 卖飞 $20w 股票
            return {
              cash: s.cash + premium + calledStocks,
              stocks: Math.max(0, (s.stocks || 0) - calledStocks),
              health: Math.max(0, s.health - 3),
              message: `【股票被 Call 走】正股暴涨击穿行权价！你如期收下 $${premium}w 权利金，但 $${calledStocks}w 核心股票被强制按约定行权卖出折现！看着股票继续暴涨，你拍断大腿 (股票变现 +$${calledStocks}w · 权利金 +$${premium}w)！`
            };
          } else {
            return {
              cash: s.cash + premium,
              message: `【稳收权利金】股价平稳波动未破行权价，你安全收下 $${premium}w 权利金现金流，且持仓一股没少！期权吃利息真香！`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【按兵不动维持仓位】按兵不动：维持目前的仓位组合进入年终结算',
        effect: (s) => ({
          message: '你决定什么都不做，做时间的朋友，静静等待跨年的钟声。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'stock_crash': {
    id: 'stock_crash',
    title: '【宏观海啸】美联储加息与市场寒冬',
    description: '美股大盘全线暴跌，纳斯达克惨不忍睹。你的公司股价腰斩，导致你今年的 RSU 价值大幅缩水！',
    choices: [
      {
        text: '【心在滴血接受现实】心在滴血但也只能承受，接受资产与薪酬缩水的残酷现实',
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
        text: '【加杠杆暴力抄底】此时不博何时博？加杠杆抄底！',
        reqBadge: '需现金 > $30w',
        condition: (s) => s.cash >= 30,
        effect: (s) => {
           const winRate = 0.2 + (s.luck / 100) * 0.4; // 抄底成功率 20% - 60%
           const win = gameRandom() < winRate;
           return win 
             ? { tc: Math.floor(s.tc * 0.9), stocks: Math.floor((s.stocks || 0) * 1.15), cash: s.cash + 35, message: '虽然宏观大盘熊市让基本薪酬受压，但你精准在最低点抄底了 AI 龙头，逆势吃到反弹波段大赚 $35w，股票市值也有所增值！' }
             : { tc: Math.floor(s.tc * 0.8), stocks: Math.floor((s.stocks || 0) * 0.70), cash: s.cash - 25, health: s.health - 15, message: '抄底抄在半山腰，现金和股票惨遭双杀，市场继续在深度熊市中煎熬。' };
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
        text: '【跳槽新厂低价抄底】心理防御倒塌：跳槽去股价触底的新公司，重新拿一笔低价 RSU 抄底',
        // The story (fresh cheap grant at the bottom) is now actually implemented as a
        // stock grant, and we no longer set is_new_job (which could reset GC progress).
        // So it's a real "抄底" bet (health cost + slight TC dip for future equity upside).
        effect: (s) => ({
          tc: Math.max(10, s.tc - 5),
          stocks: (s.stocks || 0) + 8,
          health: Math.max(0, s.health - 10),
          job_start_age: s.age,
          story_flags: { ...(s.story_flags || {}), rsu_cliff_done: true },
          message: '你含泪跳槽去了一家给钱更少但股价触底的公司，拿到了一大笔低价 RSU，重新开始坐 4 年股票牢，赌它触底反弹。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【拍小红书挂壁 VLOG】拍小红书 VLOG《28岁硅谷码农资产蒸发 60%，带你体验极简挂壁生活》',
        // No longer a free loss-eraser: going viral is a gamble with a real editing/health cost.
        effect: (s) => {
          const viral = gameRandom() < 0.55;
          return viral
            ? { cash: s.cash + 8, charm: Math.min(s.max_charm ?? 25, s.charm + 4), health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), rsu_cliff_done: true }, message: '网友太喜欢看硅谷中产受苦了！你的小红书粉丝暴涨，电竞椅和挂壁盒饭的广告费小赚一笔，稍稍填补了股票亏损。' }
            : { cash: s.cash + 1, charm: Math.min(s.max_charm ?? 25, s.charm + 1), health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), rsu_cliff_done: true }, message: '视频反响平平，熬夜剪片却是实打实的。零星几个广告只够买杯奶茶，聊胜于无。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【死扛信仰吃便当】死扛信仰！每天去大华超市买促销打折盒饭，熬到中东主权基金收购',
        effect: (s) => ({ health: s.health - 12, luck: Math.min(99, (s.luck || 20) + 8), story_flags: { ...(s.story_flags || {}), rsu_cliff_done: true }, message: '你开启了硅谷极简苦行僧模式，胃功能下降了，但心智磨砺得坚不可催。' }),
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
        text: '【稳健对冲股息策略】主要布局标普500/高股息 ETF 与跨期领子对冲期权',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => {
          const isBear = s.macro_economy === 'bear';
          const isBull = s.macro_economy === 'bull';
          const baseRate = isBull ? 0.10 : (isBear ? -0.04 : 0.06);
          const luckRate = ((s.luck || 20) / 1000);
          const gainRate = baseRate + luckRate;
          const profit = s.cash * gainRate;
          const cappedProfit = Math.max(0, Math.min(30, parseFloat(profit.toFixed(1))));
          
          if (profit >= 0) {
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash + cappedProfit).toFixed(1)),
              health: Math.max(0, s.health - 4),
              message: ` 稳健盈利！凭借严谨的风控与股息配置，本年度操盘收益率 +${(gainRate * 100).toFixed(1)}% (现金增厚 +$${cappedProfit}w)！`
            };
          } else {
            const loss = Math.min(Math.abs(profit), 20);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash - loss).toFixed(1)),
              health: Math.max(0, s.health - 6),
              message: ` 熊市震荡！宏观大盘整体回调，对冲仓位受损 -$${loss.toFixed(1)}w 美元。好在你严格止损，保住了绝大部分主力资金。`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【重仓科技龙头股票】重仓配置英伟达 (NVDA)、特斯拉与前沿半导体龙头股票',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => {
          const totalCap = s.cash + (s.stocks || 0);
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.55 : (isBear ? 0.32 : 0.45);
          const isWin = gameRandom() < winRate;
          if (isWin) {
            const gain = Math.min(80, totalCap * 0.30);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash + gain).toFixed(1)),
              health: Math.max(0, s.health - 6),
              message: ` 飞天暴赚！你重仓的 AI 科技巨头股价随着算力风口暴涨！现金暴增 +$${gain.toFixed(1)}w 美元！`
            };
          } else {
            const loss = Math.min(totalCap * 0.28, 50);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash - loss).toFixed(1)),
              health: Math.max(0, s.health - 10),
              message: ` 宏观回调！科技板块遭遇资金阶段性获利砸盘，仓位回调 -$${loss.toFixed(1)}w 美元！`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高杠杆末日期权】重仓 0DTE 末日期权与高 Beta 科技股衍生品博弈',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => {
          const totalCap = s.cash + (s.stocks || 0);
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.40 : (isBear ? 0.18 : 0.28);
          const roll = gameRandom();
          if (roll < winRate) {
            const doubleGain = Math.min(120, totalCap * 0.50);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash + doubleGain).toFixed(1)),
              health: Math.max(0, s.health - 10),
              message: ` 奇迹大胜！末日期权精准抓中财报暴涨行情，本金暴赚 +$${doubleGain.toFixed(1)}w 美元！`
            };
          } else if (roll < winRate + 0.40) {
            const drop = Math.min(totalCap * 0.30, 60);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash - drop).toFixed(1)),
              health: Math.max(0, s.health - 12),
              message: ` 惨遭反杀！黑天鹅剧烈波动导致期权权利金归零，本金大撤退 -$${drop.toFixed(1)}w 美元！`
            };
          } else {
            const bust = Math.min(totalCap * 0.55, 90);
            return {
              mid_year: true, season_stage: 'h1',
              tc: 0,
              cash: parseFloat((s.cash - bust).toFixed(1)),
              health: Math.max(0, s.health - 15),
              message: ` 极端爆仓！杠杆触发强制平仓连环踩踏，数十万本金瞬间灰飞烟灭！你欲哭无泪，备受精神打击...`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        // 读牌博弈的另一极:唯一能在熊市主动赚钱的策略(反向 ETF + 长久期国债)。方向按宏观
        // regime 确定 (熊市稳赚 / 牛市反噬 / 横盘小幅拖累),幅度带运气浮动,配合仪表盘的
        // 牛熊指示形成「看盘下注」闭环。中等力度:读对明显更优、读错明显更差但不致命。
        text: '【做空避险:反向 ETF + 长债】买入 SQQQ 等大盘反向三倍 ETF 与 20 年期长久期美债',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => {
          const totalCap = s.cash + (s.stocks || 0);
          const luck = ((s.luck || 20) / 1000);
          if (s.macro_economy === 'bear') {
            const gain = Math.min(70, totalCap * (0.26 + luck));
            return {
              mid_year: true, season_stage: 'h1', tc: 0,
              cash: parseFloat((s.cash + gain).toFixed(1)),
              health: Math.max(0, s.health - 5),
              story_flags: { ...(s.story_flags || {}), sqqq_win: true },
              message: ` 逆势封神！熊市中反向 ETF 与避险长债齐飞,你在别人割肉时反手做空大赚 +$${gain.toFixed(1)}w 美元!`
            };
          } else if (s.macro_economy === 'bull') {
            const loss = Math.min(50, totalCap * 0.22);
            return {
              mid_year: true, season_stage: 'h1', tc: 0,
              cash: parseFloat((s.cash - loss).toFixed(1)),
              health: Math.max(0, s.health - 8),
              message: ` 逆势踏空!牛市一路轧空,你的空头仓位与长债被反复碾压,倒亏 -$${loss.toFixed(1)}w 美元。`
            };
          } else {
            const drag = Math.min(15, totalCap * 0.05);
            return {
              mid_year: true, season_stage: 'h1', tc: 0,
              cash: parseFloat((s.cash - drag).toFixed(1)),
              health: Math.max(0, s.health - 5),
              message: ` 横盘磨人:震荡期没有明确方向,做空与长债的持有成本(Decay/负 Carry)小幅拖累了本金 -$${drag.toFixed(1)}w。`
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【开发量化自动套利系统】手写 Python/C++ 跨期网格与均值回归算法，部署低延迟机房',
        condition: (s) => s.job_type === 'trader',
        // No longer a strictly-dominant guaranteed money printer: the yield can be
        // negative in a bear market (real drawdown), there is no +$6w floor, and it
        // costs a little health instead of healing.
        effect: (s) => {
          const totalCap = s.cash + (s.stocks || 0);
          const leetBonus = Math.min(0.08, (s.leetcode / 1000));
          const ecoBonus = s.macro_economy === 'bull' ? 0.06 : (s.macro_economy === 'bear' ? -0.06 : 0.02);
          const yieldRate = 0.04 + leetBonus + ecoBonus; // can go negative
          const pnl = Math.max(-40, Math.min(45, parseFloat((totalCap * yieldRate).toFixed(1))));
          return {
            mid_year: true, season_stage: 'h1',
            tc: 0,
            cash: parseFloat((s.cash + pnl).toFixed(1)),
            leetcode: s.leetcode + 4,
            health: Math.max(0, s.health - 4),
            message: pnl >= 0
              ? `【量化算法】你的自动套利脚本在低延迟机房跑通，算法捕获 +$${pnl.toFixed(1)}w Alpha 超额收益！`
              : `【量化模型回撤】市场结构突变，你的均值回归模型连环止损，本年策略回撤 -$${Math.abs(pnl).toFixed(1)}w。`
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【参加量化对冲私董会】在沙丘路展示实盘 Sharpe 收益曲线，吸引高净值 LP 资金',
        costBadge: '门票 $0.5w',
        condition: (s) => s.job_type === 'trader' && s.cash >= 0.5,
        effect: (s) => {
          // Pitching LPs is a real gamble now (was a guaranteed +$4w/yr): the $0.5w entry
          // fee is sunk, and whether high-net-worth LPs actually commit depends on your
          // Sharpe pitch (charm/network/luck).
          const raised = gameRandom() < Math.min(0.85, 0.35 + (s.charm || 10) / 50 + (s.network || 0) / 200 + (s.luck || 20) / 200);
          return raised
            ? {
                mid_year: true, season_stage: 'h1',
                tc: 0,
                cash: parseFloat((s.cash - 0.5 + 4.5).toFixed(1)),
                network: Math.min(100, (s.network || 0) + 3),
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
                health: Math.max(0, s.health - 2),
                message: '【斩获 LP 管理费分红】你在量化私董会上凭借优秀的夏普比率惊艳全场，数位科技新贵与天使 LP 委托你打理资金池，获得 +$4.0w 净管理分红！'
              }
            : {
                mid_year: true, season_stage: 'h1',
                tc: 0,
                cash: parseFloat((s.cash - 0.5).toFixed(1)),
                network: Math.min(100, (s.network || 0) + 2),
                health: Math.max(0, s.health - 2),
                message: '【路演反响平平】你展示了实盘曲线，但近期回撤让 LP 们持观望态度，没能拉到新资金，白搭了入场费与精力。'
              };
        },
        nextEventId: h1ToH2Router,
      },
      {
        // Dramatic interactive terminal — mirrors the founder's 终局退场 → founder_exit_event.
        // Gated at comfortable-FIRE assets so it's the "封神" exit, not basic retirement.
        text: '【终局退场 · 封神】资产已成气候，评估成立独立基金 / 家族办公室，从操盘手晋升资本家',
        reqBadge: '需总资产 >= $800w',
        condition: (s) => s.job_type === 'trader' && (s.cash + (s.stocks || 0)) >= 800,
        hideIfUnavailable: true,
        effect: () => ({
          message: '你关掉六块盯盘屏，泡上一杯手冲，第一次认真思考：是时候把“个人操盘”升级成一份能穿越牛熊的资本事业了。'
        }),
        nextEventId: 'trader_exit_event',
      },
      {
        text: '【止盈金盆洗手】退出 Day Trading 波动江湖，重新面试大厂寻求稳健年薪',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => ({
          job_type: 'unemployed',
          laid_off: true,
          company: undefined,
          level: undefined,
          message: '你决定结束个人操盘手生涯，落袋为安，带着充沛的本金重新开启大厂求职！'
        }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'trader_exit_event': {
    id: 'trader_exit_event',
    title: '【操盘手终局】从个人交易者到资本封神',
    description: '多年血雨腥风的 K 线厮杀后，你的账户已成气候。站在资本的顶点，你决定如何为这段传奇操盘生涯落子收官：',
    choices: [
      {
        text: '【成立独立量化对冲基金 Fund I】在沙丘路挂牌自己的对冲基金，晋升为掌管数亿美元的基金教父',
        reqBadge: '需总资产 >= $1500w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1500,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          story_flags: { ...(s.story_flags || {}), trader_exit_fund: true },
          message: '【基金教父封神】你在沙丘路正式挂牌成立量化对冲基金 Fund I，凭借传奇般的历史 Sharpe 曲线，首期便募得数亿美元 LP 资金。你不再是那个熬夜盯盘的散户，而是掌管资本、制定规则的人——交易生涯封神！'
        }),
        nextEventId: 'end',
      },
      {
        text: '【设立家族办公室 Family Office】把资产装进家族信托与家办，聘专业团队打理，实现财富永续与代际传承',
        reqBadge: '需总资产 >= $800w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 800,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          story_flags: { ...(s.story_flags || {}), trader_exit_family_office: true },
          message: '【家族办公室 · 财富永续】你金盆洗手，设立了自己的家族办公室 (Family Office)，把亲手赚下的财富交给专业团队做全球资产配置与税务筹划。从此告别盯盘焦虑，财富穿越牛熊、代际传承——你活成了别人眼里的“老钱”。'
        }),
        nextEventId: 'end',
      },
      {
        text: '【再战江湖 · 继续操盘】封神时刻还没到，重新坐回六屏交易台，继续在市场里厮杀',
        effect: () => ({
          mid_year: true, season_stage: 'h1',
          message: '你合上了成立基金的文件——市场的肾上腺素还在召唤你。你重新坐回交易台，继续这场没有终局的博弈。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'crypto_scam': {
    id: 'crypto_scam',
    title: '【投机诱惑】微信群里的财富密码与土狗币',
    description: '一个高中同学突然拉你进了一个 Web3 交流群，里面的人天天晒豪车和几十倍收益的截图。',
    choices: [
      {
        text: '【高杠杆冲土狗币】搏一搏，单车变摩托！全仓买入社区 Meme 币与链上衍生品',
        costBadge: '投入 $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const winRate = 0.01 + (Math.min(45, s.luck) / 100) * 0.15;
          const win = gameRandom() < winRate;
          return win 
            ? { cash: s.cash + 15, story_flags: { ...(s.story_flags || {}), crypto_whale_win: true }, message: '你买的土狗币居然真的小火了一把！你在高点果断卖出提现，狠赚了一笔！' }
            : { cash: Math.max(0, s.cash - 5), health: Math.max(0, s.health - 7), imageUrl: 'images/crypto_crash.jpg', message: '经典的杀猪盘。项目方第二天就跑路了，你的钱全都变成了空气币。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【退群保平安避坑】天上不会掉馅饼，退群保平安',
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
          const win = gameRandom() < 0.45;
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
  },

  'trader_fed_rate_cpi_night': {
    id: 'trader_fed_rate_cpi_night',
    title: '【狂暴波动夜】美联储鲍威尔决议与 CPI 通胀数据',
    description: '今晚美东早 8:30 鲍威尔发表演讲，大盘期权波动率 (IV) 飙升到极致！纳斯达克期货在非农与 CPI 数据公布瞬间剧烈上下插针！',
    choices: [
      {
        text: '【平仓观望保护本金】严格纪律：提前平掉所有高杠杆 0DTE 末日轮，空仓观望保护本金',
        effect: (s) => ({
          health: Math.min(100, s.health + 4),
          message: '【纪律战胜贪婪】市场插针剧烈多空双爆，许多赌徒惨遭爆仓，而你空仓喝着咖啡，稳稳保住了本金与胜利果实！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【双向跨式做多波动】双向跨式策略 (Straddle)：做多两端波动率，靠大幅跳空捕获暴利',
        effect: (s) => {
          const win = gameRandom() < 0.55;
          return win
            ? {
                cash: parseFloat((s.cash + 6.5).toFixed(1)),
                health: Math.max(0, s.health - 4),
                message: '【波动率拉满】数据公布后纳指瞬间暴跌 3%，你的 Put 腿期权飙升 400%，扣除 Call 成本后净赚 +$6.5w！'
              }
            : {
                cash: Math.max(0, parseFloat((s.cash - 2).toFixed(1))),
                health: Math.max(0, s.health - 6),
                message: '【波动率双杀 (IV Crush)】大盘窄幅震荡收盘，双向期权的时间价值全部被做市商吃光，损失了 $2w 权利金。'
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【单边重仓科技七巨头】单边重仓做多科技七巨头 (Magnificent 7) 业绩预期',
        reqBadge: '需现金 >= $10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => {
          const win = gameRandom() < 0.50;
          return win
            ? {
                cash: parseFloat((s.cash + 14).toFixed(1)),
                stocks: (s.stocks || 0) + 10,
                luck: Math.min(99, s.luck + 4),
                message: '【科技巨头暴击大赚】巨头财报全线超预期！大盘高开高走，你重仓的多单斩获 +$14w 暴利与股票浮盈！'
              }
            : {
                cash: Math.max(0, parseFloat((s.cash - 5).toFixed(1))),
                health: Math.max(0, s.health - 10),
                message: '【业绩雷暴】某核心巨头下调全年指引导致盘后跳水，你的重仓多头止损离场，亏损 $5w。'
              };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'trader_wallstreetbets_short_squeeze': {
    id: 'trader_wallstreetbets_short_squeeze',
    title: '【散户暴动】WallStreetBets 逼空妖股与 Gamma 轧空狂欢',
    description: 'Reddit WSB 论坛千万散户集结，猛烈买入深度虚值 Call 期权，将一只空头占比高达 40% 的科技小盘股推向多重熔断！',
    choices: [
      {
        text: '【跟风追涨精准止盈】火中取栗：顺势跟风买入，在盘中剧烈震荡中精准止盈',
        effect: (s) => {
          const win = gameRandom() < 0.60;
          return win
            ? {
                cash: parseFloat((s.cash + 8).toFixed(1)),
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
                message: '【逃顶大师】你在股票第 4 次向上熔断时果断挂单市价全平，精准收割了 +$8w 游资利润！'
              }
            : {
                cash: Math.max(0, parseFloat((s.cash - 3).toFixed(1))),
                health: Math.max(0, s.health - 8),
                message: '【庄家砸盘闪崩】主力资金在盘尾大举抛售，流动性枯竭导致你的单子踩踏止损，亏损 $3w。'
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【反手做空远期 Put】等待非理性狂热情绪见顶，反手布局 Put 远期看跌期权',
        // Shorting a live short-squeeze is one of the most dangerous trades — it's now a
        // real gamble, not a guaranteed free win that dominated the "跟风" option.
        effect: (s) => {
          const timedRight = gameRandom() < 0.5;
          return timedRight
            ? { cash: parseFloat((s.cash + 7).toFixed(1)), leetcode: Math.min(100, s.leetcode + 3), message: '【价值回归做空】狂欢次日妖股暴跌 45%，你精准抄顶的做空仓位兑现 +$7w 丰厚收益！' }
            : { cash: Math.max(0, parseFloat((s.cash - 4).toFixed(1))), health: Math.max(0, s.health - 6), message: '【逼空绞杀】散户抱团继续拉爆，你的 Put 在 Gamma Squeeze 下被反向绞杀，倒亏 $4w！' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【吃瓜看戏发 Meme】吃瓜看戏：拒绝情绪化交易，在 Twitter/X 上发 Meme 表情包',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          health: Math.min(100, s.health + 6),
          message: '【心态超然】你在社交媒体上输出神级 Meme 嘲讽空头与散户互割，收获 10 万浏览量与点赞！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'trader_bloomberg_terminal_caffeine': {
    id: 'trader_bloomberg_terminal_caffeine',
    title: '【操盘手作息】四屏盯盘、摄入过量冷萃咖啡与失眠焦虑',
    description: '连续两周美东开盘（美西清晨 6:30）高强度盯盘，你每天灌下 3 大杯 Cold Brew，心率飙升但精神处于高度亢奋与紧绷状态。',
    choices: [
      {
        text: '【关机休市海边养生】强行关机休市：去 Half Moon Bay 半月湾吹海风吃海鲜，深度养生回血',
        effect: (s) => ({
          health: Math.min(100, s.health + 16),
          cash: Math.max(0, parseFloat((s.cash - 0.3).toFixed(1))),
          message: '【自然疗愈】放下所有行情波动，在太平洋海风与夕阳中彻底放松，心率回归正常，身心满血恢复！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【全量托管自动网格】将核心策略全量托管给 Python/AWS 自动交易网格系统，解放肉身',
        // 去掉原先的 cash +3:反 burnout 的"自我关怀"选项不应还白送钱(否则成零成本严格优选)。
        // 现定位为纯粹的休养生息(health/leetcode),与"通宵复盘"的高强度研究形成取舍。
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          leetcode: Math.min(100, s.leetcode + 4),
          message: '【算法解放肉身】自动化网格交易脚本无缝接管，你终于睡上了安稳觉，趁机养精蓄锐、补了补交易理论功课。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【通宵复盘拆解财报】通宵复盘：拆解 10-K 年报与美股大宗交易 Dark Pool (暗池) 资金流',
        // 提高研究回报(leetcode +8)并降低健康代价(-6):让"熬夜苦研"成为真正划算的技能交易,
        // 而非相对自动网格的纯亏项。
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          leetcode: Math.min(100, s.leetcode + 8),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          message: '【深度研报收获】通宵研读让你发现了某半导体产业链的隐藏预期差，交易认知大幅进化！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  }
};
