import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear , gameRandom, addImpact } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

// Market x luck modulation for a founder's yearly valuation change. A startup's valuation is
// NOT a guaranteed +X: it rides the macro regime (bull/neutral/bear) and a good/bad-luck roll,
// and in a bear market it can be a DOWN ROUND (markdown) instead of growth. Pain-point rescues
// pass shieldDownRound=true, so actively correcting the year's problem is at worst flat.
// Returns the new valuation (floored at 80).
function founderValuationGrowth(s: GameState, baseGain: number, onPoint = false): number {
  const cur = s.company_valuation || 180;
  const eco = s.macro_economy;
  // onPoint = you correctly diagnosed and fixed the year's specific pain point. Correct play is
  // rewarded reliably: the full baseGain always lands (never a markdown, never a bear penalty),
  // with bull-market + luck upside on top. So onPoint growth is >= baseGain by construction.
  if (onPoint) {
    const bull = eco === 'bull' ? 1.2 : 1.0;
    const luckUp = 1 + (Math.min(80, s.luck || 20) / 100) * 0.3 + gameRandom() * 0.2; // 1.0 – ~1.5
    return Math.max(80, cur + Math.round(baseGain * bull * luckUp));
  }
  // General yearly growth rides the macro regime and a luck roll; a bear market can be a DOWN
  // ROUND (~40% of bear years) where the valuation marks down instead of growing.
  if (eco === 'bear' && gameRandom() < 0.4) {
    const markdown = 0.85 + gameRandom() * 0.07; // x0.85 – x0.92
    return Math.max(80, Math.round(cur * markdown));
  }
  const marketMult = eco === 'bull' ? 1.25 : eco === 'bear' ? 0.4 : 0.8;
  const luckMult = 0.65 + (Math.min(80, s.luck || 20) / 100) * 0.5 + gameRandom() * 0.4; // ~0.65 – 1.55
  return Math.max(80, cur + Math.round(baseGain * marketMult * luckMult));
}

// Sign-aware valuation-outcome clause reflecting the market/luck result of a growth action.
function founderValMsg(eco: GameState['macro_economy'], cur: number, newVal: number): string {
  const delta = newVal - cur;
  if (delta > 0) {
    return eco === 'bull'
      ? `恰逢科技牛市顺风，公司估值大涨 +$${delta}w (至 $${newVal}w)！`
      : `公司估值增长 +$${delta}w (至 $${newVal}w)。`;
  }
  if (delta < 0) {
    return `但恰逢资本寒冬，一级市场重新定价，公司估值不升反降 (down round) $${delta}w (至 $${newVal}w)。`;
  }
  return `但资本寒冬下市场情绪低迷，公司估值原地踏步 (维持 $${newVal}w)。`;
}

export const startupEvents: Record<string, GameEvent> = {
  'startup_crisis': {
    id: 'startup_crisis',
    title: '【初创危机】期权缩水与核心团队动荡',
    description: '你的 Startup 最近融资不太顺利，账上的钱只够发 3 个月工资了。',
    choices: [
      {
        text: '【相信老板期权大饼】相信创始团队愿景与 PPT，自愿降薪换取更多早期期权',
        effect: (s) => {
          const win = gameRandom() < 0.05;
          return win 
            ? { cash: s.cash + 150, message: ' 奇迹爆发！公司被大厂以数亿美元溢价收购，你的早期期权直接兑现 $150w 现金！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, job_type: 'unemployed', message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '【带资领投】自己掏 $10w 领投公司 Seed 轮自救',
        costBadge: '出资 $10w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 10,
        effect: (s) => {
          const win = gameRandom() < 0.25;
          return win
            ? { cash: s.cash + 60, tc: s.tc + 10, message: '你出资 $10w 带资入组！公司靠你的过桥资金撑到了 A 轮融资估值大暴涨，早期天使投资净赚 $60w 现金，TC 与期权双双调升！' }
            : { cash: s.cash - 10, tc: 0, laid_off: true, job_type: 'unemployed', health: s.health - 15, message: '砸进去的 $10w 没能挽救寒冬，公司还是倒闭了...你不仅没了工作还心痛不已。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '【骑驴找马准备跑路】偷偷骑驴找马，准备跑路',
        effect: (s) => ({ health: s.health - 5, tc: 0, cash: s.cash, laid_off: true, job_type: 'unemployed', message: '你一边假装努力工作，一边偷偷刷题。不久后公司果然资金链断裂，你不得不重新找工作。' }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'founder_annual_strategy': {
    id: 'founder_annual_strategy',
    title: '【全职 Founder】公司战略与轮次推进',
    description: '作为初创公司 CEO，你手下带着团队在硅谷创业。烧钱率 (Burn Rate) 与公司生命线全掌握在你手里。请决定本年度的核心战略：',
    choices: [
      {
        text: '【沙丘路路演融资】前往 Sand Hill Road (沙丘路) 向顶级 VC 演示 Pitch 寻求融资',
        reqBadge: '需丰富人脉或出众形象',
        condition: (s) => (s.network || 0) >= 15 || (s.charm || 0) >= 14,
        effect: (s) => {
          const stage = s.founder_stage || 'pre_seed';
          const ecoBonus = s.macro_economy === 'bull' ? 0.15 : s.macro_economy === 'bear' ? -0.20 : 0;
          const networkBonus = Math.min(0.18, ((s.network || 0) - 10) / 80);
          const charmBonus = Math.min(0.12, ((s.charm || 0) - 10) / 80);
          const baseChance = stage === 'pre_seed' ? 0.48 : stage === 'seed' ? 0.32 : 0.22;
          const successChance = Math.max(0.12, Math.min(0.75, baseChance + ecoBonus + networkBonus + charmBonus));
          const pass = gameRandom() < successChance;

          if (pass) {
            if (stage === 'pre_seed') {
              const newVal = Math.max((s.company_valuation || 0) + 400, 600);
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'seed',
                company_valuation: newVal,
                cash: parseFloat((s.cash + 4).toFixed(1)),
                tc: 10,
                health: Math.max(0, s.health - 4),
                message: `【种子轮领投】凭借扎实的原型 Demo，顶级天使基金领投 $100w 支票（估值 $${newVal}w）！公司获得 18 个月跑道，创始人津贴调升至 $10w！`
              };
            } else if (stage === 'seed') {
              const newVal = Math.max((s.company_valuation || 0) + 1600, 2200);
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'series_a',
                company_valuation: newVal,
                cash: parseFloat((s.cash + 8).toFixed(1)),
                tc: 16,
                health: Math.max(0, s.health - 6),
                message: `【突破 A 轮死亡谷】经过残酷的 Series A 筛选，一线 VC 领投 $350w（估值 $${newVal}w）！公司完成 PMF 突破，创始人津贴提升至 $16w！`
              };
            } else if (stage === 'series_a') {
              const newVal = Math.max((s.company_valuation || 0) + 5000, 7500);
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'series_b',
                company_valuation: newVal,
                cash: parseFloat((s.cash + 18).toFixed(1)),
                tc: 24,
                health: Math.max(0, s.health - 8),
                message: `【B 轮超级融资】红杉与 A16Z 联合领投，公司估值冲上 $${newVal}w 美元！ARR 突破 $800w，准独角兽地位确立！`
              };
            } else {
              // series_b (or already at exit): advance to exit; never DROP valuation.
              const newVal = Math.max((s.company_valuation || 0) + 7500, 15000);
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'exit',
                company_valuation: newVal,
                cash: parseFloat((s.cash + 30).toFixed(1)),
                tc: 30,
                health: Math.max(0, s.health - 8),
                message: `【终局轮/Pre-IPO】主权基金与顶级 Crossover 基金入场，公司估值突破 $${newVal}w，独角兽地位坐实，只待敲钟或并购！`
              };
            }
          } else {
            // Failed raise. If the war chest is empty, the company runs out of
            // runway and dies — a real founder ruin outcome (was impossible before).
            if ((s.cash + (s.stocks || 0)) < 3) {
              return {
                status: 'game_over',
                cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
                health: Math.max(0, s.health - 12),
                message: '【弹尽粮绝】融资失败且账上现金见底，无力支付团队工资与云账单，公司被迫关停清算。你的创业梦碎，背负债务黯然离场。'
              };
            }
            const isDownRound = gameRandom() < 0.35;
            if (isDownRound) {
              const currentVal = s.company_valuation || 180;
              const reducedVal = Math.max(100, Math.round(currentVal * 0.85));
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, parseFloat((s.cash - 2).toFixed(1))),
                company_valuation: reducedVal,
                health: Math.max(0, s.health - 12),
                message: `【估值倒挂 (Down Round)】资本寒冬下 VC 极度挑剔，只肯给折价过桥贷款（估值折让至 $${reducedVal}w），严苛的对赌协议让你彻夜难眠。`
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
                health: Math.max(0, s.health - 8),
                message: '【融资遇冷】沙丘路跑了 20 家 VC 均表示“赛道拥挤、继续观察”，未能发出 Term Sheet。公司只能继续靠现有资金死撑。'
              };
            }
          }
        },
        // 弹尽粮绝分支会设 status:'game_over'（cash>=0，中间件不会兜底 target='end'），
        // 故此处须像其他 game_over 出口一样显式路由到 'end'，与全代码库惯例一致。
        nextEventId: (s) => s.status === 'game_over' ? 'end' : h1ToH2Router(s),
      },
      {
        text: '【死磕产品 PMF 与企业大单】带领全员攻坚核心功能，冲刺 ARR 并拿下企业采购合同',
        condition: (s) => s.job_type === 'startup_founder',
        effect: (s) => {
          const onPoint = s.founder_situation === 'churn';
          const cur = s.company_valuation || 180;
          const newVal = founderValuationGrowth(s, onPoint ? 700 : 350, onPoint);
          return {
            mid_year: true, season_stage: 'h1',
            health: Math.max(0, s.health - 8),
            cash: parseFloat((s.cash + (onPoint ? 10 : 5)).toFixed(1)),
            company_valuation: newVal,
            ...(onPoint ? { founder_situation: undefined } : {}),
            message: (onPoint
              ? '【死磕 PMF·成功止血】正值客户流失当口，你带队死磕 PMF 与企业大单，续约率触底反弹、ARR 破 $80w！'
              : '【产品迭代·上门攻坚】经过半年高强度产品迭代，公司拿下多家科技企业采购合同，实现微利造血！')
              + founderValMsg(s.macro_economy, cur, newVal),
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【TechCrunch 巅峰演讲与公关】登上顶级科技峰会做 Live Demo，引爆行业与资本关注度',
        condition: (s) => s.job_type === 'startup_founder',
        effect: (s) => {
          const onPoint = s.founder_situation === 'valuation_stall';
          const cur = s.company_valuation || 180;
          const newVal = founderValuationGrowth(s, onPoint ? 500 : 200, onPoint);
          return {
            mid_year: true, season_stage: 'h1',
            health: Math.max(0, s.health - 4),
            network: Math.min(100, (s.network || 0) + 3),
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
            company_valuation: newVal,
            ...(onPoint ? { founder_situation: undefined } : {}),
            message: (onPoint
              ? '【重夺聚光灯】正值估值停滞期，你一场技惊四座的 Live Demo 登上 Hacker News 首页并引爆媒体热度，资本市场重新追捧！'
              : '【Live Demo 技惊全场】你在 TechCrunch Disrupt 上的演讲登上 Hacker News 首页，吸引上千名早期极客用户注册体验！')
              + founderValMsg(s.macro_economy, cur, newVal),
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高举高打招聘架构师】重金从一线大厂挖角资深大牛，重构底层系统补齐工程短板',
        costBadge: '花费 $8w',
        condition: (s) => s.cash >= 8,
        effect: (s) => {
          const onPoint = s.founder_situation === 'outage';
          // 对症(线上事故频发)时,资深架构师正中要害:必然稳住系统并大幅提升交付,估值强修复。
          const success = onPoint || gameRandom() < 0.65;
          const cur = s.company_valuation || 180;
          if (success) {
            const newVal = founderValuationGrowth(s, onPoint ? 550 : 300, onPoint);
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 8).toFixed(1)),
              company_valuation: newVal,
              leetcode: Math.min(100, s.leetcode + 6),
              ...(onPoint ? { founder_situation: undefined } : {}),
              message: (onPoint
                ? '【稳住系统·交付提速】正值线上事故频发，你重金请来的大厂资深架构师重构了底层服务，故障率骤降、SLA 达标！'
                : '【核心架构师加盟】大厂 Senior 大牛加盟后研发出高效的 AI 底层服务，产品交付速度明显提升！')
                + founderValMsg(s.macro_economy, cur, newVal),
            };
          } else {
            const newVal = founderValuationGrowth(s, 100, false);
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 8).toFixed(1)),
              company_valuation: newVal,
              health: Math.max(0, s.health - 8),
              message: `【团队磨合阵痛】空降大牛与早期极客团队理念冲突，消耗了大笔安家费预算。` + founderValMsg(s.macro_economy, cur, newVal),
            };
          }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : h1ToH2Router(s),
      },
      {
        text: '【终局退场 Exit】启动并购评估 Acqui-hire 或 纳斯达克 IPO 挂牌上市',
        condition: (s) => s.job_type === 'startup_founder' && !s.story_flags?.exit_deliberated,
        hideIfUnavailable: true,
        effect: () => ({ message: '你召开董事会紧急闭门会议，正式启动退场与并购/IPO 评估！' }),
        nextEventId: 'founder_exit_event',
      },
      {
        text: '【断臂求生：开源节流】挥泪裁撤非核心人员与非主营业务，收缩战线保住现金流',
        // The defensive cash-preservation play: extends runway (gains cash, low health
        // cost) at the price of valuation. No longer a strict trap vs the growth options.
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: parseFloat((s.cash + 3).toFixed(1)),
          company_valuation: Math.max(80, (s.company_valuation || 180) - 40),
          health: Math.max(0, s.health - 4),
          message: '你壮士断腕开源节流，挥泪解雇了一批非核心人员。虽然公司估值缩水、士气受挫，但账上现金流大大延长了生死线 Runway。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'founder_exit_event': {
    id: 'founder_exit_event',
    title: '【创始人退场】初创公司终局抉择 (Exit & M&A)',
    description: '作为初创公司 CEO，你手握公司的核心技术与商业壁垒，站在了终局退场的十字路口。请选择最符合当前利益的退场方案：',
    choices: [
      {
        text: '【纳斯达克挂牌敲钟 (IPO)】向 SEC 递交招股书，实现全球资本市场上市套现',
        reqBadge: '需进入 Exit 阶段或估值>=3000w',
        condition: (s) => (s.company_valuation || 0) >= 3000 || s.founder_stage === 'exit',
        hideIfUnavailable: true,
        effect: (s) => {
          const val = s.company_valuation || 3000;
          const isHuge = val >= 6000;
          const founderCash = parseFloat((Math.max(isHuge ? 350 : 220, Math.round(val * 0.07))).toFixed(1));
          return {
            status: 'win',
            founder_stage: 'exit',
            company_valuation: val,
            cash: parseFloat((s.cash + founderCash).toFixed(1)),
            message: `【纳斯达克挂牌敲钟！】随着金色钟声在时代广场敲响，公司正式挂牌上市！扣除 VC 稀释后创始人股权套现 $${founderCash}w 美元现金，达成传奇 IPO 终局！`
          };
        },
        nextEventId: 'end',
      },
      {
        text: '【接受科技巨头溢价并购 (Acqui-hire)】打包技术与核心团队卖给大厂，变现套现并受聘为大厂资深架构师',
        condition: (s) => (s.company_valuation || 0) >= 300 || s.founder_stage === 'seed' || s.founder_stage === 'series_a' || s.founder_stage === 'series_b' || s.founder_stage === 'exit',
        hideIfUnavailable: true,
        effect: (s) => {
          const val = s.company_valuation || 400;
          const payout = val >= 5000 ? 160 : (val >= 2000 ? 95 : (val >= 800 ? 55 : 30));
          const isHigh = val >= 3000;
          const newLevel = isHigh ? 'L7 (Senior Staff)' : 'L6 (Staff)';
          const newTc = isHigh ? 68 : 52;
          return {
            cash: parseFloat((s.cash + payout).toFixed(1)),
            job_type: 'big_tech',
            company: 'google',
            level: newLevel,
            last_promo_age: s.age,
            tc: newTc,
            laid_off: false,
            founder_stage: undefined,
            company_valuation: 0,
            health: Math.max(0, s.health - 2),
            network: Math.min(100, (s.network || 0) + 8),
            story_flags: { ...(s.story_flags || {}), acqui_hire_done: true },
            message: `【成功被科技巨头并购】Google/Meta 科技巨头以溢价全资收购了你们团队！扣除 VC 清算优先权后，创始人分得 $${payout}w 现金，并受聘为大厂 ${newLevel} 架构师 (TC $${newTc}w)！`
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【折价清盘与友好关停】清偿员工薪酬与 VC 清算优先权，保留离场资金重返职场求职',
        condition: (s) => true,
        effect: (s) => {
          const val = s.company_valuation || 180;
          const recovery = val >= 1000 ? 30 : 15;
          return {
            cash: parseFloat((s.cash + recovery).toFixed(1)),
            job_type: 'unemployed',
            company: undefined,
            level: undefined,
            laid_off: true,
            founder_stage: undefined,
            company_valuation: 0,
            tc: 0,
            health: Math.max(0, s.health - 6),
            network: Math.min(100, (s.network || 0) + 6),
            message: `【公司清盘退场】在与董事会协商后，公司友好关停清盘。VC 拿走剩余资产后，你保留了 $${recovery}w 离场资金与核心人脉。创业告一段落，你带着宝贵经验重新回归求职市场！`
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【暂缓退场 · 重燃斗志继续带领团队冲刺】取消退场流程，继续作为 CEO 带领团队战斗',
        condition: (s) => true,
        effect: (s) => ({
          story_flags: { ...(s.story_flags || {}), exit_deliberated: true },
          message: '你深吸一口气，决定暂缓退场计划，重新召集团队全力以赴推进业务增长！'
        }),
        nextEventId: 'founder_annual_strategy',
      }
    ]
  },

  'ai_research_crisis': {
    id: 'ai_research_crisis',
    title: '【行业变革】AGI 浪潮与顶会前沿',
    description: '最近 OpenAI 又发了新模型，你在实验室里的项目面临被降维打击的危险。',
    choices: [
      {
        text: '【抢占先机写 Paper】抢占先机，连夜写 Paper 冲击顶会！',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.9, 0.55 + ((s.impact || 0) / 250) + s.leetcode / 400);
          return win 
            ? { tc: s.tc + 5, cash: s.cash + 30, stocks: (s.stocks || 0) + 20, impact: addImpact(s, 15), visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4), health: s.health - 15, message: ' 论文斩获 NeurIPS Best Paper！你提出的推理大模型架构震惊学术界与工业界，行业影响力飙升 (Impact +15)！公司立刻发了 $30w Retention Bonus、加配了 $20w 核心股票，并协助加急批复了 O1 签证！' }
            : { health: s.health - 15, cash: s.cash, impact: addImpact(s, 4), message: '熬了半个月，结果撞车了别人的工作被直接 Reject，但实验沉淀与代码库仍为你积累了前沿影响力 (Impact +4)。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【佛系跟进不争不抢】佛系跟进，不争不抢',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '反正公司也不差你这一个项目，你按时下班，每天看着同事们卷生卷死。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'founder_co_founder_drama': {
    id: 'founder_co_founder_drama',
    title: '【创始人危机】CTO 合伙人股权纷争与离职摊牌',
    description: '创业初期和你一起在车库吃泡面的联合创始人兼 CTO 突然在周一早会摊牌：要求重签协议将股权提升至 50%，否则就带走核心模型架构去投奔竞对。',
    choices: [
      {
        text: '【依法强硬回购股份】依法办事：依据最初签署的 4 年 Vesting 协议回购未行权股份，强硬止损',
        effect: (s) => ({
          health: Math.max(0, s.health - 10),
          company_valuation: Math.max(100, (s.company_valuation || 180) - 60),
          leetcode: Math.min(100, s.leetcode + 4),
          message: '【强硬换帅】你依照法律条款回购了对方股份。短期内虽经历代码交接阵痛，但成功捍卫了公司股权结构与治理底线！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【协商妥协稳定架构】协商妥协：释放 5% 股权池与晋升薪酬，维持技术架构稳定推进',
        // The "keep building" play: the retained CTO ships (leetcode) — a real edge over
        // the VC-arbitration option (so it isn't strictly dominated once you've raised).
        effect: (s) => ({
          health: Math.max(0, s.health - 4),
          network: Math.min(100, (s.network || 0) + 4),
          leetcode: Math.min(100, s.leetcode + 4),
          message: '【务实维稳】你让渡少量期权池与奖金抚平了矛盾，CTO 同意留任并带队攻坚核心大模型版本，技术底盘更稳了。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【引入 VC 仲裁调解】引入沙丘路 VC 投资人做仲裁调解，以专业治理架构稳定董事会',
        condition: (s) => Boolean(s.founder_stage === 'seed' || s.founder_stage === 'series_a' || s.founder_stage === 'series_b' || s.founder_stage === 'exit'),
        hideIfUnavailable: true,
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 80;
          return {
            network: Math.min(100, (s.network || 0) + 4),
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
            company_valuation: newVal,
            message: `【VC 出面平息】沙丘路领投合伙人亲自出面做利益平衡与期权重组，公司治理结构走向规范化（估值稳步提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_vc_term_sheet_ghost': {
    id: 'founder_vc_term_sheet_ghost',
    title: '【沙丘路惊魂】周日晚 11 点 VC 撤回 Term Sheet',
    description: '沙丘路一线 VC 合伙人口头承诺领投下轮融资后，却在正式签署前夕的周日深夜发来邮件表示“投委会因宏观不确定性决定暂缓”，单方面反悔撤回。',
    choices: [
      {
        text: '【连夜启动备选预案】连夜启动备选应急预案，向 Stanford 校友网络与天使投资人路演求助',
        effect: (s) => {
          const win = gameRandom() < 0.60;
          return win
            ? {
                cash: parseFloat((s.cash + 2).toFixed(1)),
                network: Math.min(100, (s.network || 0) + 3),
                company_valuation: (s.company_valuation || 180) + 120,
                message: '【绝地反击】斯坦福校友天使基金在 48 小时内火速过桥领投，不仅填补了缺口，还带来了顶级企业资源！'
              }
            : {
                health: Math.max(0, s.health - 12),
                cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
                message: '【四处碰壁】沙丘路其他机构听闻领投方撤回后纷纷观望，公司不得不进入极其严苛的紧缩状态。'
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【沙丘路咖啡馆堵门】直接杀到 Sand Hill Road 咖啡馆堵门当面 Re-pitch，力挽狂澜',
        condition: (s) => (s.charm || 0) >= 14,
        hideIfUnavailable: true,
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 150;
          return {
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
            health: Math.max(0, s.health - 6),
            company_valuation: newVal,
            message: `【强大的 Founder 气场】你在咖啡馆用极具感染力的 Demo 与最新 ARR 增长数据彻底打消了合伙人的顾虑，促成对方重新盖章签字（估值提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【断臂求生全员降薪】断臂求生：立刻收紧每月烧钱率，全员降薪延缓 Runway',
        // Cutting burn actually preserves cash (extends runway) — a real cash edge so
        // it isn't dominated by the charm-gated Re-pitch option.
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          cash: parseFloat((s.cash + 2).toFixed(1)),
          message: '【开源节流】你挥泪推迟了招聘计划并砍掉非必要云服务，账上留存了宝贵现金，成功将公司生命线延长了 6 个月。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_runway_cash_crunch': {
    id: 'founder_runway_cash_crunch',
    title: '【算力账单危机】Mercury 银行账户只剩 2 个月生命线',
    description: '随着 AI 算力与 GPU 训练开销激增，公司 Mercury 银行账户里的资金仅够支撑 60 天了。如果无法及时止血，公司将面临断粮关停。',
    choices: [
      {
        text: '【创始人自掏腰包垫资】创始人自掏腰包垫资 $4w，全力扛到下半年企业客户续约',
        costBadge: '垫资 $4w',
        condition: (s) => s.cash >= 4,
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 150;
          return {
            cash: parseFloat((s.cash - 4).toFixed(1)),
            company_valuation: newVal,
            health: Math.max(0, s.health - 8),
            message: `【创始人担当】你垫付的资金撑过了最艰难的两个月，随后几笔大型企业采购款顺利到账，公司转危为安（估值提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【申请云厂商算力额度】申请云厂商（AWS/Azure/GCP）创业加速算力额度抵扣，死里逃生',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 80;
          return {
            health: Math.min(100, s.health + 4),
            company_valuation: newVal,
            message: `【拿下十万美元算力 Grant】你的技术架构打动了云厂商评委会，成功斩获 $100,000 免费算力额度，瞬间解除了资金危机（估值提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【交付 MVP 补充现金流】带领全员极速交付 MVP 商业化功能，以预付订金补充现金流',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 100;
          return {
            health: Math.max(0, s.health - 10),
            cash: parseFloat((s.cash + 2.5).toFixed(1)),
            company_valuation: newVal,
            message: `【自造血成功】连续两周高强度上线付费功能，吸引了数百名付费企业客户，实现了正向现金流（估值提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_hacker_house_hackathon': {
    id: 'founder_hacker_house_hackathon',
    title: '【旧金山黑客松】Hayes Valley 48小时 Red Bull 通宵攻坚',
    description: '旧金山 Hayes Valley / SOMA 的极客 Hacker House 正在举办周末 48 小时 AI Agent 黑客松，满屋子都是喝着 Red Bull 狂敲代码的狂热 Founder 与工程师。',
    choices: [
      {
        text: '【通宵打磨冠军 Demo】带领团队通宵打磨杀手级 Feature，斩获全场冠军 Demo',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 120;
          return {
            health: Math.max(0, s.health - 6),
            leetcode: Math.min(100, s.leetcode + 5),
            company_valuation: newVal,
            message: `【黑客松夺冠】你们的 Live Demo 惊艳全场夺得第一！Product Hunt 首页推荐，收获了数千名早期极客种子用户（估值提升至 $${newVal}w）！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【现场疯狂 Network】在黑客松现场疯狂 Networking，结识顶级天使投资人与硬核天才',
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 4),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          message: '【人脉大丰收】在酒会与披萨台前认识了数位 Sandbox 与 YC 背景的顶尖极客，为下一轮招聘打下了坚实基础。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【佛系参赛蹭吃蹭券】佛系参赛：蹭免费披萨、精酿啤酒与 $10,000 云算力代金券',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          message: '【白嫖算力与放松】没有参赛心理负担，白嫖了满满一袋纪念品与云服务算力 Credits，身心舒畅。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  // === 创始人专属动态奇遇 (由 settlement 的 founderAnnualEntry 低频派发, 与既有危机同池) ===
  'founder_yc_batch': {
    id: 'founder_yc_batch',
    title: '【YC 孵化营 Offer】Garry Tan 亲自发来 Batch 面试邀请',
    description: 'Y Combinator 合伙人看到了你的增长曲线，邀请你参加下一期 Batch。标准 Deal：出让 7% 股权，换取种子资金、全明星校友网络与 Demo Day 全球曝光。',
    choices: [
      {
        text: '【接受 YC 孵化 Deal】接受 YC Deal：出让 7% 股权，加入 Batch 冲刺 Demo Day',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 400;
          return {
            mid_year: true, season_stage: 'h1',
            cash: parseFloat((s.cash + 6).toFixed(1)),
            network: Math.min(100, (s.network || 0) + 10),
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
            company_valuation: newVal,
            health: Math.max(0, s.health - 6),
            message: `【YC 加持】你在 Demo Day 面对上千投资人路演，公司估值跃升至 $${newVal}w！虽然稀释了 7% 股权，但拿到了顶级校友网络与后续融资的敲门砖！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【婉拒 YC 独立自筹】婉拒：不愿被稀释 7%，坚持独立自筹发展',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 60;
          return {
            mid_year: true, season_stage: 'h1',
            company_valuation: newVal,
            health: Math.max(0, s.health - 2),
            message: `【自力更生】你婉拒了 YC 的股权稀释，选择靠自有营收与团队硬实力独立成长，公司估值微增至 $${newVal}w。`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_enterprise_whale': {
    id: 'founder_enterprise_whale',
    title: '【Fortune 500 超大单】巨头意向 $200w 年度采购，限 3 个月交付企业版',
    description: '一家世界 500 强巨头释放了 $200w 年度采购意向，但要求你的团队在 3 个月内交付满足企业级合规与 SLA 的私有化部署版本。这是一次决定公司命运的豪赌。',
    choices: [
      {
        text: '【全力接单赶工交付】集中全员通宵赶工，3 个月啃下企业级版本',
        effect: (s) => {
          const win = gameRandom() < (0.55 + (s.leetcode >= 60 ? 0.15 : 0));
          if (win) {
            const newVal = (s.company_valuation || 180) + 600;
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + 12).toFixed(1)),
              company_valuation: newVal,
              health: Math.max(0, s.health - 16),
              message: `【拿下灯塔客户】你们如期交付了企业级私有化版本！$200w 大单落地成为标杆案例，公司估值暴涨至 $${newVal}w！`
            };
          }
          const newVal = (s.company_valuation || 180) + 80;
          return {
            mid_year: true, season_stage: 'h1',
            company_valuation: newVal,
            health: Math.max(0, s.health - 16),
            message: `【交付延期】企业级合规与 SLA 远比预想复杂，团队累垮仍未如期交付，巨头改签了竞品，只留下宝贵的踩坑经验（估值微增至 $${newVal}w）。`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【分阶段里程碑交付】分阶段签署里程碑交付合同，不透支团队健康',
        effect: (s) => {
          const newVal = (s.company_valuation || 180) + 220;
          return {
            mid_year: true, season_stage: 'h1',
            cash: parseFloat((s.cash + 4).toFixed(1)),
            company_valuation: newVal,
            health: Math.max(0, s.health - 6),
            message: `【稳健推进】你与巨头谈成分阶段里程碑付款，先交付核心模块。回款稳健（公司估值提升至 $${newVal}w），团队也没被拖垮。`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  }
};
