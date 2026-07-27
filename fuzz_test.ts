import { events, generateInitialState } from './src/data/events';
import { GameState } from './src/types';

console.log('🚀 启动事件流自动化 Fuzz 测试 (Event Fuzzing)...\n');

let totalPathsChecked = 0;
let errorsFound = 0;

function runFuzzTest(iterations: number) {
  for (let i = 0; i < iterations; i++) {
    let currentState: GameState = generateInitialState();
    let currentEventId = 'choose_trait';
    let steps = 0;
    const maxSteps = 100; // 防止无限循环

    while (steps < maxSteps) {
      if (currentEventId === 'end' || currentState.status !== 'playing') {
        break;
      }

      const event = events[currentEventId];
      if (!event) {
        console.error(`❌ [错误] 遇到未定义的事件 ID: '${currentEventId}'`);
        errorsFound++;
        break;
      }

      // 找出所有 condition 满足的合法选项
      const validChoices = event.choices.filter(c => !c.condition || c.condition(currentState));
      
      if (validChoices.length === 0) {
        console.error(`❌ [死胡同 Dead-End] 事件 '${currentEventId}' 没有任何合法的选项可供点击！玩家将卡死。`);
        errorsFound++;
        break;
      }

      // 随机选一个
      const randomChoice = validChoices[Math.floor(Math.random() * validChoices.length)];
      
      try {
        const effectResult = randomChoice.effect(currentState);
        
        // 模拟 Middleware
        if (effectResult.laid_off === true) {
          effectResult.tc = 0;
          effectResult.job_type = 'unemployed';
        }
        if (effectResult.job_type && effectResult.job_type !== 'unemployed') {
          effectResult.laid_off = false;
        }

        Object.assign(currentState, effectResult);
        
        // 模拟 Game Over 判断
        if (currentState.health <= 0 || currentState.cash < -0.001 || currentState.cash >= currentState.win_threshold) {
          break; 
        }

        const nextId = typeof randomChoice.nextEventId === 'function' ? randomChoice.nextEventId(currentState) : randomChoice.nextEventId;
        currentEventId = nextId;

      } catch (e) {
        console.error(`❌ [运行时崩溃] 在事件 '${currentEventId}' 中执行 choice 时报错:`, e);
        errorsFound++;
        break;
      }

      steps++;
      totalPathsChecked++;
    }
  }

  console.log(`✅ Fuzz 测试完成！模拟了 ${iterations} 局人生。`);
  console.log(`📊 总计校验了 ${totalPathsChecked} 次状态流转。`);
  
  if (errorsFound > 0) {
    console.error(`🚨 测试失败：共发现 ${errorsFound} 个致命错误！请向上查看日志修复。`);
    process.exit(1);
  } else {
    console.log(`🎉 测试通过：未发现任何死胡同 (Dead-End) 或崩溃 Bug。事件图非常稳固！`);
  }
}

// 模拟 10,000 局人生
runFuzzTest(10000);
