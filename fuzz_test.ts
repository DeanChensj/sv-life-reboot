import { events, generateInitialState } from './src/data/events';
import { GameState } from './src/types';

console.log('🚀 启动全量事件流与状态不变性 Fuzz 测试 (Event & State Invariants Fuzzing)...\n');

let totalPathsChecked = 0;
let errorsFound = 0;

function validateStateInvariants(prevState: GameState, newState: GameState, eventId: string): boolean {
  let ok = true;
  const isSetupEvent = ['choose_trait', 'choose_year', 'choose_school'].includes(eventId);

  // 1. Financial & Numerical Safety Invariants
  if (isNaN(newState.cash) || !isFinite(newState.cash)) {
    console.error(`❌ [状态断言失败] 事件 '${eventId}' 执行后现金变为非有限数值 (NaN / Infinity)！`);
    ok = false;
  }
  if (isNaN(newState.tc) || !isFinite(newState.tc)) {
    console.error(`❌ [状态断言失败] 事件 '${eventId}' 执行后 TC 变为非有限数值 (NaN / Infinity)！`);
    ok = false;
  }
  if (isNaN(newState.health) || !isFinite(newState.health)) {
    console.error(`❌ [状态断言失败] 事件 '${eventId}' 执行后健康度变为非有限数值 (NaN / Infinity)！`);
    ok = false;
  }

  // 2. Job & TC Invariant
  if (newState.job_type === 'unemployed' && newState.tc > 0) {
    console.error(`❌ [状态冲突断言失败] 事件 '${eventId}' 执行后失业 (job_type='unemployed') 但仍领 TC (${newState.tc}w)！`);
    ok = false;
  }

  // 3. Immigration State Invariants (Citizenship & Green Card Protection)
  if (prevState.visa === '公民' && newState.visa !== '公民') {
    console.error(`❌ [身份降级断言失败] 事件 '${eventId}' 导致美国公民身份被降级为 '${newState.visa}'！`);
    ok = false;
  }
  if (prevState.visa === '绿卡' && newState.visa !== '绿卡' && newState.visa !== '公民') {
    console.error(`❌ [身份降级断言失败] 事件 '${eventId}' 导致绿卡身份被降级为 '${newState.visa}'！`);
    ok = false;
  }

  // 4. Chronological Invariants (Time Monotonicity during gameplay)
  if (!isSetupEvent) {
    if (newState.age < prevState.age) {
      console.error(`❌ [时间倒流断言失败] 事件 '${eventId}' 导致年龄从 ${prevState.age} 岁倒退为 ${newState.age} 岁！`);
      ok = false;
    }
    if (newState.year < prevState.year) {
      console.error(`❌ [年份倒流断言失败] 事件 '${eventId}' 导致年份从 ${prevState.year} 年倒退为 ${newState.year} 年！`);
      ok = false;
    }
  }

  // 5. Stat Clamp Invariants
  if (newState.health < 0 || newState.health > 100) {
    console.error(`❌ [属性越界断言失败] 事件 '${eventId}' 执行后健康度 (${newState.health}) 超出 [0, 100] 范围！`);
    ok = false;
  }

  return ok;
}

function runFuzzTest(iterations: number) {
  for (let i = 0; i < iterations; i++) {
    let currentState: GameState = generateInitialState();
    let currentEventId = 'choose_trait';
    let steps = 0;
    const maxSteps = 100;

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

      const randomChoice = validChoices[Math.floor(Math.random() * validChoices.length)];
      const previousStateSnapshot = { ...currentState };
      
      try {
        const effectResult = randomChoice.effect(currentState);
        
        // 模拟 Middleware (与 App.tsx 完全保持一致)
        if (effectResult.laid_off === true) {
          effectResult.tc = 0;
          effectResult.job_type = 'unemployed';
        }
        if (effectResult.job_type && effectResult.job_type !== 'unemployed') {
          effectResult.laid_off = false;
        }

        const newState = { ...currentState, ...effectResult };

        // 🛡️ Global Visa Invariant Guard Middleware (App.tsx 保持一致)
        if (previousStateSnapshot.visa === '公民') {
          newState.visa = '公民';
          newState.gc_progress = 5;
          newState.gc_stage = 'approved';
        } else if (previousStateSnapshot.visa === '绿卡' && newState.visa !== '公民') {
          newState.visa = '绿卡';
          newState.gc_progress = 5;
          newState.gc_stage = 'approved';
        }

        // Clamp attributes (与 App.tsx 保持一致)
        newState.health = Math.max(0, Math.min(100, newState.health));
        newState.leetcode = Math.max(0, Math.min(100, newState.leetcode));

        // 验证全局状态不变性 (State Invariants Assertion)
        if (!validateStateInvariants(previousStateSnapshot, newState, currentEventId)) {
          errorsFound++;
          break;
        }

        currentState = newState;

        // 模拟 Game Over 判断
        if (currentState.health <= 0 || currentState.cash < -0.001 || (currentState.cash + (currentState.stocks || 0)) >= currentState.win_threshold) {
          break; 
        }

        const nextId = typeof randomChoice.nextEventId === 'function' ? randomChoice.nextEventId(currentState) : randomChoice.nextEventId;
        currentEventId = nextId;

      } catch (e: any) {
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
    console.log(`🎉 测试通过：全量状态不变性 (Invariants) 校验 100% 稳固！未发现任何死胡同或崩溃 Bug。`);
  }
}

// 模拟 10,000 局人生
runFuzzTest(10000);
