import { events, generateInitialState } from './src/data/events';
import { GameState, Choice } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';
import { gameRandom } from './src/utils/random';

console.log('🎰 === 启动蒙特卡洛数值平衡与寿命保障自动化门禁 (Monte Carlo Balance CI) ===\n');

function simulateGame(strategy: 'balanced' | 'smart_tech_worker' | 'roll_king_healer', seed: number): {
  status: 'win' | 'game_over' | 'playing' | 'retired';
  age: number;
  netWorth: number;
  tc: number;
  cause?: string;
  hopsAttempted: number;
  hopsSucceeded: number;
} {
  // #1 种子复现:seed 作为 customSeed 传入,generateInitialState 内部 setGameSeed(seed),使开局面板
  // 与全程 gameRandom() 消耗完全确定(外部单独 setGameSeed 会被无参重播覆盖,见 helpers.ts)。
  let state = generateInitialState(seed);
  if (strategy === 'roll_king_healer') {
    state.trait_title = '卷王之王';
    state.leetcode = 40;
  }

  let currentEventId = 'choose_trait';
  let turns = 0;
  let hopsAttempted = 0;
  let hopsSucceeded = 0;

  while (turns < 150 && state.status === 'playing') {
    turns++;
    const ev = events[currentEventId];
    if (!ev || !ev.choices || ev.choices.length === 0) break;

    // The FIRE-win-rate metric models a player *trying* to reach FIRE, so the bot never
    // takes voluntary give-up / early-exit off-ramps (they end the run as a content ending,
    // NOT a FIRE win, which would skew the rate — and 大理躺平 previously even mis-set
    // status:'win', inflating it). These are deliberate human-agency choices, covered for
    // correctness by CUJ 16 / CUJ 17, not by this balance gate.
    const GIVE_UP_MARKERS = ['提前上岸', '回大理', '放弃求职'];
    const validChoices = ev.choices.filter(c => (!c.condition || c.condition(state))
      && !GIVE_UP_MARKERS.some(m => c.text.includes(m)));
    if (validChoices.length === 0) break;

    let chosen: Choice;
    if (currentEventId === 'sv_daily_life') {
      if (state.health < 60) {
        const healChoice = validChoices.find(c => c.text.includes('躺平') || c.text.includes('WLB') || c.text.includes('火人节'));
        chosen = healChoice || validChoices[0];
      } else if (state.leetcode < 40) {
        const grindChoice = validChoices.find(c => c.text.includes('刷题跳槽') || c.text.includes('疯狂内卷'));
        chosen = grindChoice || validChoices[0];
      } else if (state.tc < 50 && gameRandom() < 0.6) {
        const hopChoice = validChoices.find(c => c.text.includes('刷题跳槽'));
        const sprintChoice = validChoices.find(c => c.text.includes('疯狂内卷'));
        chosen = hopChoice || sprintChoice || validChoices[0];
      } else {
        const hopChoice = validChoices.find(c => c.text.includes('刷题跳槽'));
        const investChoice = validChoices.find(c => c.text.includes('投资理财') || c.text.includes('拓展副业'));
        chosen = (gameRandom() < 0.40 && hopChoice) ? hopChoice : (investChoice || validChoices[Math.floor(gameRandom() * validChoices.length)]);
      }
    } else if (currentEventId === 'founder_annual_strategy') {
      // Founders now make their PRIMARY annual decision here (year-end settlement routes them
      // straight to their hub instead of the generic sv_daily_life panel, which the bot alone
      // played with a smart policy). Model a competent founder: raise to advance the round
      // (the main valuation engine), cash out the unicorn once late-stage, otherwise push
      // product growth — and only pull the defensive 苟活 lever when health is critical.
      const fund = validChoices.find(c => c.text.includes('沙丘路'));
      const exit = validChoices.find(c => c.text.includes('终局退场'));
      const pmf = validChoices.find(c => c.text.includes('死磕产品'));
      const talk = validChoices.find(c => c.text.includes('TechCrunch'));
      const hire = validChoices.find(c => c.text.includes('高举高打招聘'));
      const survive = validChoices.find(c => c.text.includes('苟活'));
      // 能力型创始人先读仪表盘的「痛点」信号对症下药 (估值停滞→演讲 / 客户流失→死磕PMF /
      // 线上事故→招架构师),把年度痛点化解掉拿对症加成;健康告急则苟活保命;后期冲刺退场;
      // 无痛点信号时以融资推进轮次为主。(与 startup.ts 的 founder_situation 对症加成对齐。)
      const remedy = state.founder_situation === 'valuation_stall' ? talk
        : state.founder_situation === 'churn' ? pmf
        : state.founder_situation === 'outage' ? hire
        : undefined;
      if (state.health < 40 && survive) chosen = survive;
      else if ((state.founder_stage === 'series_b' || state.founder_stage === 'exit') && exit) chosen = exit;
      else if (remedy) chosen = remedy;
      else chosen = fund || pmf || validChoices[Math.floor(gameRandom() * validChoices.length)];
    } else if (currentEventId === 'trader_annual_strategy') {
      // Competent trader: compound via the moderate-risk growth play, hedge when health is
      // critical. (Was played fully at random once routed off sv_daily_life.)
      // 能力型 trader 会读仪表盘的牛熊 regime 顺势下注:牛市重仓科技龙头、熊市做空/买债、
      // 横盘走量化套利;健康告急则退守稳健对冲。(与 trading.ts 的 regime 化收益对齐,否则一直
      // 梭哈龙头会在熊市持续挨打、拉低 trader 路径 FIRE。)
      const hedge = validChoices.find(c => c.text.includes('对冲股息'));
      const growth = validChoices.find(c => c.text.includes('重仓科技龙头'));
      const short = validChoices.find(c => c.text.includes('做空避险'));
      const quant = validChoices.find(c => c.text.includes('量化自动套利'));
      if (state.health < 40 && hedge) chosen = hedge;
      else if (state.macro_economy === 'bull' && growth) chosen = growth;
      else if (state.macro_economy === 'bear' && short) chosen = short;
      else chosen = quant || hedge || growth || validChoices[Math.floor(gameRandom() * validChoices.length)];
    } else if (currentEventId === 'side_hustle_hub') {
      // 副业子菜单:玩家仍是全职,来这里挑一条第二曲线。模型一个「有能力的」副业玩家——
      // 按自身强项选最优赛道,而不是随机乱点(否则测出的胜率是「乱点」水平,系统性低估真实平衡)。
      // 算法强→独立开发(收购上行+impact);资深/人脉→顾问(稳定现金+人脉);颜值高→自媒体;
      // 否则有现金且非熊市→实体投资。绝不选「暂不发展」(competent 玩家既然进来了就会做一个)。
      const saas = validChoices.find(c => c.text.includes('独立开发'));
      const advisor = validChoices.find(c => c.text.includes('高阶咨询'));
      const creator = validChoices.find(c => c.text.includes('流量自媒体'));
      const boba = validChoices.find(c => c.text.includes('实体投资'));
      if (state.leetcode >= 45 && saas) chosen = saas;
      else if (advisor) chosen = advisor;
      else if (saas) chosen = saas;
      else if ((state.charm || 10) >= 16 && creator) chosen = creator;
      else if (boba && state.macro_economy !== 'bear') chosen = boba;
      else chosen = creator || boba || validChoices[Math.floor(gameRandom() * validChoices.length)];
    } else if (currentEventId.startsWith('founder_')) {
      // 创始人专属 H2 动态事件(合伙人撕逼/VC 跳票/断粮/黑客松/YC/巨头大单/退场)。这些过去由
      // bot 纯随机选择,系统性低估了「有能力创始人」的真实表现,人为压低 FIRE 并逼出 #65 的降频
      // 创可贴。改为健康感知的能力型策略:健康告急时选防守/回血选项,否则选增长/上行选项。
      const pick = (subs: string[]) => subs.map(t => validChoices.find(c => c.text.includes(t))).find(Boolean);
      if (state.health < 45) {
        chosen = pick(['佛系', '云厂商', '稳健', '协商妥协', '断臂', '婉拒']) || validChoices[0];
      } else {
        chosen = pick(['接受 YC', '全力接单', '冠军', 'IPO', '咖啡馆', '仲裁', 'MVP', '备选应急', '协商妥协'])
          || validChoices[Math.floor(gameRandom() * validChoices.length)];
      }
    } else if (currentEventId === 'marriage_divorce_crisis') {
      const reconcile = validChoices.find(c => c.text.includes('婚姻咨询') || c.text.includes('蜜月'));
      chosen = reconcile || validChoices[0];
    } else if (currentEventId === 'choose_school') {
      // 转码是少数派起点(~15%,现实中多数玩家走 CS 科班);其余在 CS 排名档里随机。
      const zhuanma = validChoices.find(c => c.text.includes('转码'));
      const csChoices = validChoices.filter(c => !c.text.includes('转码'));
      chosen = (zhuanma && gameRandom() < 0.15) ? zhuanma : csChoices[Math.floor(gameRandom() * csChoices.length)];
    } else if (currentEventId === 'zhuanma_background') {
      // 能力型转码:美本非CS(三条路全开)最灵活。
      chosen = validChoices.find(c => c.text.includes('美本非CS')) || validChoices[0];
    } else if (currentEventId === 'zhuanma_decision') {
      // 付得起就读 CS 美硕(最稳,复用科班管线);否则自学(免费且 signal 略高于 bootcamp)。
      const ms = validChoices.find(c => c.text.includes('CS 美硕'));
      const self = validChoices.find(c => c.text.includes('纯自学'));
      const canAffordMs = (state.cash + (state.stocks || 0)) >= 10;
      chosen = (canAffordMs && ms) ? ms : (self || validChoices[0]);
    } else if (currentEventId === 'zhuanma_setback') {
      // 只要还能再战就不放弃(competent 玩家坚持);实在不行才止损 washout。
      chosen = validChoices.find(c => c.text.includes('再刷一年')) || validChoices[validChoices.length - 1];
    } else {
      chosen = validChoices[Math.floor(gameRandom() * validChoices.length)];
    }

    const isHopGrind = currentEventId === 'sv_daily_life' && chosen.text.includes('刷题跳槽');
    const prevCompany = state.company;
    const eff = chosen.effect(state);
    const transition = applyStateTransition(state, eff, { eventId: currentEventId });
    state = transition.nextState;

    if (isHopGrind) {
      hopsAttempted += state.hop_applied_count || 3;
      hopsSucceeded += (state.hop_offers || []).length;
    }

    if (state.status !== 'playing') break;

    if (typeof chosen.nextEventId === 'string') {
      currentEventId = chosen.nextEventId;
    } else if (typeof chosen.nextEventId === 'function') {
      currentEventId = chosen.nextEventId(state);
    } else {
      break;
    }

    if (currentEventId === 'end') break;
  }

  const netWorth = state.cash + (state.stocks || 0);
  let cause = 'natural_retirement';
  if (state.health <= 0) cause = 'burnout_health_zero';
  else if (state.status === 'game_over') cause = 'visa_or_layoff_game_over';
  else if (state.status === 'win') cause = 'fire_target_achieved';

  return {
    status: state.status,
    age: state.age,
    netWorth,
    tc: state.tc,
    cause,
    hopsAttempted,
    hopsSucceeded,
  };
}

const TOTAL_RUNS = 3000;
let wins = 0;
let totalAge = 0;
let totalNetWorth = 0;
let totalTC = 0;
let winAges: number[] = [];
let totalHopsAttempted = 0;
let totalHopsSucceeded = 0;
const causes: Record<string, number> = {};

for (let i = 0; i < TOTAL_RUNS; i++) {
  // #1 种子复现:每局用确定性 seed=i,使整个门禁 100% 可复现(不再受运行间随机波动影响,
  // FIRE/寿命/跳槽率变成代码的确定函数),且任意一局可用该 seed 单独回放调试。
  const strat = i % 3 === 0 ? 'balanced' : (i % 3 === 1 ? 'smart_tech_worker' : 'roll_king_healer');
  const res = simulateGame(strat, i);
  if (res.status === 'win') {
    wins++;
    winAges.push(res.age);
  }
  totalAge += res.age;
  totalNetWorth += res.netWorth;
  totalTC += res.tc;
  causes[res.cause || 'other'] = (causes[res.cause || 'other'] || 0) + 1;
  totalHopsAttempted += res.hopsAttempted;
  totalHopsSucceeded += res.hopsSucceeded;
}

const winRateNum = (wins / TOTAL_RUNS) * 100;
const avgAgeNum = totalAge / TOTAL_RUNS;
const avgWinAgeNum = winAges.length > 0 ? (winAges.reduce((a, b) => a + b, 0) / winAges.length) : 0;
const hopSuccessRateNum = totalHopsAttempted > 0 ? (totalHopsSucceeded / totalHopsAttempted) * 100 : 0;

console.log(`📊 蒙特卡洛测试样本数: ${TOTAL_RUNS} 局`);
  console.log(`  - 全局 FIRE 胜率: ${winRateNum.toFixed(1)}% (基准范围: 20.0% ~ 43.0%)`);
console.log(`  - 玩家平均寿命: ${avgAgeNum.toFixed(1)} 岁 (基准范围: 35.0 ~ 55.0 岁)`);
console.log(`  - FIRE 通关平均年龄: ${avgWinAgeNum.toFixed(1)} 岁 (基准范围: 33.0 ~ 45.0 岁)`);
console.log(`  - 跳槽面试通过率: ${hopSuccessRateNum.toFixed(1)}% (基准范围: 50.0% ~ 75.0%)`);
console.log(`  - 终局结局分布:`, causes);

let hasError = false;

// 1. Invariant Assertion: Lifespan Guarantee (35.0 ~ 55.0 years)
if (avgAgeNum < 35.0 || avgAgeNum > 55.0) {
  console.error(`❌ [寿命平衡违规] 玩家平均寿命为 ${avgAgeNum.toFixed(1)} 岁，未在 35.0 ~ 55.0 岁健康保障区间！`);
  hasError = true;
}

// 2. Invariant Assertion: Win Rate to FIRE (20.0% ~ 43.0%)
// 上限从 40% 上调到 43%(PR #100):#100 修复了大量事件从年中错误跳回 sv_daily_life 造成的
// 「同回合死循环」——那种循环会跳过年终结算(不回血、不加岁数)却持续叠加扣血事件,人为制造
// 了 ~550/3000 局的 burnout 假死亡,把旧的 35% FIRE 基线压了出来。修复后「有能力玩家」的
// 真实 FIRE 率稳定在 ~41%(蒙卡 3000 局波动 39-42)。这是对基线的校正,而非放水;43% 给
// 概率波动留出余量,同时仍能拦住真正的失衡回归。详见 h1ToH2Router / career.ts 的路由修复。
if (winRateNum < 20.0 || winRateNum > 43.0) {
  console.error(`❌ [胜率平衡违规] 全局 FIRE 胜率为 ${winRateNum.toFixed(1)}%，未在 20.0% ~ 43.0% 预设耐玩区间！`);
  hasError = true;
}

// 3. Invariant Assertion: Job hop pass rate (50.0% ~ 75.0%)
if (hopSuccessRateNum < 50.0 || hopSuccessRateNum > 75.0) {
  console.error(`❌ [跳槽真实性违规] 跳槽通过率为 ${hopSuccessRateNum.toFixed(1)}%，未在 50.0% ~ 75.0% 真实区间！`);
  hasError = true;
}

if (hasError) {
  console.error('\n❌ 蒙特卡洛数值平衡门禁未通过！');
  process.exit(1);
} else {
  console.log('\n🎉 蒙特卡洛数值平衡门禁 100% 验证通过！系统核心寿命与胜率指标极其稳健。\n');
}
