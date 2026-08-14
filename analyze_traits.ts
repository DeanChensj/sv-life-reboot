import { events, generateInitialState } from './src/data/events';
import { GameState } from './src/types';

console.log('🚀 分析各身份开局的通关概率和平均寿命...\n');

interface TraitStat {
  total: number;
  wins: number;
  totalAge: number;
  winTotalAge: number;
  deaths: number;
}

const stats: Record<string, TraitStat> = {};

function runFuzzTest(iterations: number) {
  for (let i = 0; i < iterations; i++) {
    let currentState: GameState = generateInitialState();
    let currentEventId = 'choose_trait';
    let steps = 0;
    const maxSteps = 150; 

    while (steps < maxSteps) {
      if (currentEventId === 'end' || currentState.status !== 'playing') {
        // Evaluate Win / Loss
        if (currentState.cash >= currentState.win_threshold) {
          currentState.status = 'win';
        } else if (currentState.health <= 0 || currentState.cash < -0.001) {
          currentState.status = 'game_over';
        }
        break;
      }

      const event = events[currentEventId];
      if (!event) break;

      const validChoices = event.choices.filter(c => !c.condition || c.condition(currentState));
      if (validChoices.length === 0) break;

      const randomChoice = validChoices[Math.floor(Math.random() * validChoices.length)];
      
      try {
        const effectResult = randomChoice.effect(currentState);
        
        if (effectResult.laid_off === true) {
          effectResult.tc = 0;
          effectResult.job_type = 'unemployed';
        }
        if (effectResult.job_type && effectResult.job_type !== 'unemployed') {
          effectResult.laid_off = false;
        }

        Object.assign(currentState, effectResult);
        
        if (currentState.health <= 0 || currentState.cash < -0.001) {
          currentState.status = 'game_over';
          break; 
        }
        if (currentState.cash >= currentState.win_threshold) {
          currentState.status = 'win';
          break;
        }

        const nextId = typeof randomChoice.nextEventId === 'function' ? randomChoice.nextEventId(currentState) : randomChoice.nextEventId;

        currentEventId = nextId;

      } catch (e) {
        break;
      }

      steps++;
    }

    const trait = currentState.trait_title || 'Unknown';
    if (!stats[trait]) {
      stats[trait] = { total: 0, wins: 0, totalAge: 0, winTotalAge: 0, deaths: 0 };
    }

    stats[trait].total++;
    stats[trait].totalAge += currentState.age;

    if (currentState.status === 'win') {
      stats[trait].wins++;
      stats[trait].winTotalAge += currentState.age;
    } else {
      stats[trait].deaths++;
    }
  }

  // Print Report
  console.log('📊 【各初始身份数据报告 (样本量: 100,000)】');
  console.log('----------------------------------------------------');
  for (const trait in stats) {
    const s = stats[trait];
    if (s.total === 0) continue;
    const winRate = (s.wins / s.total) * 100;
    const avgAge = s.totalAge / s.total;
    const avgWinAge = s.wins > 0 ? s.winTotalAge / s.wins : 0;
    console.log(`[${trait}]`);
    console.log(`  通关概率 (Win Rate): ${winRate.toFixed(2)}% (${s.wins}/${s.total})`);
    console.log(`  平均寿命/结束年龄:   ${avgAge.toFixed(1)} 岁`);
    if (s.wins > 0) {
      console.log(`  成功 FIRE 平均年龄: ${avgWinAge.toFixed(1)} 岁`);
    }
    console.log('----------------------------------------------------');
  }
}

runFuzzTest(100000);
