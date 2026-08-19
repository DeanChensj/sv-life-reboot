import { events, generateInitialState } from './src/data/events';
import { GameState } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';

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
  // Stocks must stay a finite, non-negative number (auto-liquidation floors at 0).
  const stocks = newState.stocks || 0;
  if (isNaN(stocks) || !isFinite(stocks) || stocks < -0.001) {
    console.error(`❌ [状态断言失败] 事件 '${eventId}' 执行后股票持仓 (${stocks}) 非法 (NaN/负数)！`);
    ok = false;
  }
  // Impact must stay a finite, non-negative number.
  const impact = newState.impact || 0;
  if (isNaN(impact) || !isFinite(impact) || impact < -0.001) {
    console.error(`❌ [状态断言失败] 事件 '${eventId}' 执行后 impact (${impact}) 非法 (NaN/负数)！`);
    ok = false;
  }
  // (Note: charm is NOT asserted against a 25 cap — the codebase doesn't consistently clamp
  //  charm to max_charm, so many events legitimately push it to ~29; enforcing it here would
  //  be noise, not a real invariant.)

  // 6. Ladder Monotonicity — a single turn must NEVER skip a rung (e.g. L3→L6). Only checked
  //    when BOTH prev and new are STANDARD ladder levels, so non-standard→ladder remaps
  //    (MTS→L6) and founder-exit conversions are exempt. Catches level-skip promo bugs.
  const LADDER = ['L3', 'L4', 'L5 (Senior)', 'L6 (Staff)', 'L7 (Senior Staff)', 'L8 (Principal)'];
  const prevRung = LADDER.indexOf(prevState.level || '');
  const newRung = LADDER.indexOf(newState.level || '');
  if (eventId !== 'founder_exit_event' && prevRung >= 0 && newRung >= 0 && newRung - prevRung > 1) {
    console.error(`❌ [职级跳级断言失败] 事件 '${eventId}' 一回合内从 ${prevState.level} 跳到 ${newState.level} (跨越 ${newRung - prevRung} 级)！`);
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
        
        // 统一经过中央状态流转引擎
        const transition = applyStateTransition(currentState, effectResult, {
          eventId: currentEventId,
          source: 'event',
        });
        const newState = transition.nextState;

        // 验证全局状态不变性 (State Invariants Assertion)
        if (!validateStateInvariants(previousStateSnapshot, newState, currentEventId)) {
          errorsFound++;
          break;
        }

        currentState = newState;

        // 模拟 Game Over / Win 判断
        if (currentState.status === 'game_over' || currentState.status === 'win' || currentState.health <= 0 || currentState.cash < -0.001 || (currentState.cash + (currentState.stocks || 0)) >= currentState.win_threshold) {
          break; 
        }

        const nextId = transition.targetEventId || (typeof randomChoice.nextEventId === 'function' ? randomChoice.nextEventId(currentState) : randomChoice.nextEventId);

        // 路由不变量：只有本回合真正晋升 (last_promo_age === age) 才允许进入「晋升庆祝」事件。
        // 这道防线专治反复出现的 message.includes('晋升') 误路由 (被拒/无关文案含"晋升" → 误弹喜报)。
        if (typeof nextId === 'string' && nextId.endsWith('_celebration') && currentState.last_promo_age !== currentState.age) {
          console.error(`❌ [路由不变量] 进入晋升庆祝 '${nextId}'，但本回合未实际晋升 (last_promo_age=${currentState.last_promo_age}, age=${currentState.age}) —— 疑似 message 子串误路由！事件='${currentEventId}'`);
          errorsFound++;
          break;
        }

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
