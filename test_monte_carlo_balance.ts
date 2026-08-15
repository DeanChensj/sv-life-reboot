import { events, generateInitialState } from './src/data/events';
import { GameState, Choice } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';

console.log('🎰 === 启动蒙特卡洛数值平衡与寿命保障自动化门禁 (Monte Carlo Balance CI) ===\n');

function simulateGame(strategy: 'balanced' | 'smart_tech_worker' | 'roll_king_healer'): {
  status: 'win' | 'game_over' | 'playing' | 'retired';
  age: number;
  netWorth: number;
  tc: number;
  cause?: string;
  hopsAttempted: number;
  hopsSucceeded: number;
} {
  let state = generateInitialState();
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

    const validChoices = ev.choices.filter(c => !c.condition || c.condition(state));
    if (validChoices.length === 0) break;

    let chosen: Choice;
    if (currentEventId === 'sv_daily_life') {
      if (state.health < 60) {
        const healChoice = validChoices.find(c => c.text.includes('躺平') || c.text.includes('WLB') || c.text.includes('火人节'));
        chosen = healChoice || validChoices[0];
      } else if (state.leetcode < 40) {
        const grindChoice = validChoices.find(c => c.text.includes('刷题跳槽') || c.text.includes('疯狂内卷'));
        chosen = grindChoice || validChoices[0];
      } else if (state.tc < 50 && Math.random() < 0.6) {
        const hopChoice = validChoices.find(c => c.text.includes('刷题跳槽'));
        const sprintChoice = validChoices.find(c => c.text.includes('战时冲刺') || c.text.includes('疯狂内卷'));
        chosen = hopChoice || sprintChoice || validChoices[0];
      } else {
        const hopChoice = validChoices.find(c => c.text.includes('刷题跳槽'));
        const investChoice = validChoices.find(c => c.text.includes('投资理财') || c.text.includes('拓展副业'));
        chosen = (Math.random() < 0.40 && hopChoice) ? hopChoice : (investChoice || validChoices[Math.floor(Math.random() * validChoices.length)]);
      }
    } else {
      chosen = validChoices[Math.floor(Math.random() * validChoices.length)];
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
  const strat = i % 3 === 0 ? 'balanced' : (i % 3 === 1 ? 'smart_tech_worker' : 'roll_king_healer');
  const res = simulateGame(strat);
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
console.log(`  - 全局 FIRE 胜率: ${winRateNum.toFixed(1)}% (基准范围: 20.0% ~ 40.0%)`);
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

// 2. Invariant Assertion: Win Rate to FIRE (20.0% ~ 40.0%)
if (winRateNum < 20.0 || winRateNum > 40.0) {
  console.error(`❌ [胜率平衡违规] 全局 FIRE 胜率为 ${winRateNum.toFixed(1)}%，未在 20.0% ~ 40.0% 预设耐玩区间！`);
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
