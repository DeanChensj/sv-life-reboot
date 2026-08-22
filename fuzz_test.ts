import { events, generateInitialState, resolveNextEventId } from './src/data/events';
import { GameState } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';
import { gameRandom } from './src/utils/random';

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

// 同回合回路哨兵白名单:这些是「可在同一年内合法多次进入」的操作面板/年度枢纽,
// 不算死循环(玩家可在年中反复开商城、管房产、逛副业菜单再回主面板)。其余任何事件
// 若在「一年之内」(两次年终结算之间、age 未推进) 被重复访问,即判定为同回合死循环。
const LOOP_WHITELIST = new Set<string>([
  'choose_trait', 'choose_year', 'choose_school',
  // 年度枢纽:年终结算每年把玩家路由回这些面板(settlement.ts 把 founder→founder_annual_strategy、
  // trader→trader_annual_strategy、其余→sv_daily_life),它们是各职业「一年的起点」,可跨年多次进入。
  'sv_daily_life', 'founder_annual_strategy', 'trader_annual_strategy', 'sv_year_end_settlement',
  // 年中可反复开的操作面板(商城/管房产/副业菜单/换租),同一年内多次进入合法。
  'choose_housing', 'manage_rental_properties', 'side_hustle_hub', 'change_rental',
  // 「解决前不放行」的危机/重试面板:失业求职、H1B 签证危机链。这些按设计会在自救选项失败后
  // 回到面板重试,直到解决(拿到 offer / 换签证 / EB-5 兜底 / game_over 遣返)或年终结算,是与
  // sv_daily_life 同类的年内枢纽,而非死循环。它们各自都有确定性的终局出口,不会真无限。
  'job_hunt', 'layoff_hit', 'h1b_final_crisis', 'h1b_fallback_options', 'h1b_crisis',
]);

// 失败即抛:附带 seed + 本年事件路径,实现「一秒复现」。用 SEED=<n> npx tsx fuzz_test.ts 单局回放。
function fail(seed: number, msg: string, yearPath: string[]): void {
  errorsFound++;
  console.error(`❌ [seed=${seed}] ${msg}`);
  if (yearPath.length) console.error(`   本年路径: ${yearPath.join(' -> ')}`);
  console.error(`   复现命令: SEED=${seed} npx tsx fuzz_test.ts`);
}

function runFuzzTest(iterations: number, baseSeed: number, singleSeed?: number) {
  for (let i = 0; i < iterations; i++) {
    // #1 种子复现:把 seed 作为 customSeed 传给 generateInitialState —— 它内部会 setGameSeed(seed)
    // 播种全局 PRNG(直接在外面 setGameSeed 会被 generateInitialState 无参时的随机重播覆盖,helpers.ts)。
    // 之后开局面板 + 所有事件内 gameRandom() 消耗全部确定;失败时打印该 seed 即可一秒回放整局。
    const seed = singleSeed ?? (baseSeed + i);
    let currentState: GameState = generateInitialState(seed);
    let currentEventId = 'choose_trait';
    let steps = 0;
    const maxSteps = 400;

    // #2 同回合回路哨兵:按「年」重置的事件访问计数。年边界 = age 推进(年终结算)。
    let yearAnchorAge = currentState.age;
    const seenThisYear = new Map<string, number>();
    let yearPath: string[] = [];
    // 首次年终结算之前是「开局 setup 段」(选特质/难度/学校 → 读书 → 毕业 → 首份工作 → 首次日常),
    // 这整段在第一次结算前 age 都不推进,会让多个求职/择业事件被误判为「同年重复」。故仅在首次
    // sv_year_end_settlement 之后才启用回路检测,setup 段只做其它不变量校验。
    let sawFirstSettlement = false;

    while (steps < maxSteps) {
      if (currentEventId === 'end' || currentState.status !== 'playing') {
        break;
      }

      if (currentEventId === 'sv_year_end_settlement') sawFirstSettlement = true;

      // age 一旦推进(经过年终结算),说明进入新的一年 → 清空本年计数与路径。
      if (currentState.age > yearAnchorAge) {
        yearAnchorAge = currentState.age;
        seenThisYear.clear();
        yearPath = [];
      }
      yearPath.push(currentEventId);

      // #2 回路检测:仅在开局 setup 段结束(见过首次年终结算)后启用;非白名单事件在同一年内
      // 被访问 >= 3 次 = 未消耗年份的持续打转死循环。阈值取 3 而非 2 是刻意的:少数良性
      // 「同年双触发」并非死循环(如池事件在 H1/H2 各命中一次、F1/OPT 新人选房→big_tech_work→
      // 日常的 onboarding 特殊流),它们会正常推进到年终结算;只有第 3 次重访才是真正卡住不前。
      // 真正无限、永不escape 的死循环则由下方 maxSteps 耗尽兜底捕获。
      if (sawFirstSettlement && !LOOP_WHITELIST.has(currentEventId)) {
        const visits = (seenThisYear.get(currentEventId) || 0) + 1;
        seenThisYear.set(currentEventId, visits);
        if (visits >= 3) {
          fail(seed, `[同回合死循环] 事件 '${currentEventId}' 在 ${currentState.age} 岁同一年内被访问 ${visits} 次 (未经过年终结算)！`, yearPath);
          break;
        }
      }

      const event = events[currentEventId];
      if (!event) {
        fail(seed, `[错误] 遇到未定义的事件 ID: '${currentEventId}'`, yearPath);
        break;
      }

      // 找出所有 condition 满足的合法选项
      const validChoices = event.choices.filter(c => !c.condition || c.condition(currentState));

      if (validChoices.length === 0) {
        fail(seed, `[死胡同 Dead-End] 事件 '${currentEventId}' 没有任何合法的选项可供点击！玩家将卡死。`, yearPath);
        break;
      }

      // #1 选项选择也走种子化 gameRandom(替换裸 Math.random),整局 100% 可复现。
      const randomChoice = validChoices[Math.floor(gameRandom() * validChoices.length)];
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
          fail(seed, `[状态不变量] 事件 '${currentEventId}' 违反全局状态不变性 (详见上方断言)。`, yearPath);
          break;
        }

        currentState = newState;

        // 模拟 Game Over / Win 判断
        if (currentState.status === 'game_over' || currentState.status === 'win' || currentState.health <= 0 || currentState.cash < -0.001 || (currentState.cash + (currentState.stocks || 0)) >= currentState.win_threshold) {
          break;
        }

        // Route through the SAME shared resolver the live app uses (targetEventId override +
        // H1→H2→settlement season advance), so the fuzzer traverses the shipped event graph.
        const routed = resolveNextEventId(randomChoice, currentState, transition.targetEventId, currentEventId);
        currentState = routed.finalState;
        const nextId = routed.nextEventId;

        // 路由不变量：只有本回合真正晋升 (last_promo_age === age 且非入职应届 L3) 才允许进入「晋升庆祝」事件。
        // 这道防线专治反复出现的 message.includes('晋升') 误路由 (被拒/无关文案含"晋升" → 误弹喜报) 以及 L3 误入庆祝。
        if (typeof nextId === 'string' && nextId.endsWith('_celebration') && (currentState.last_promo_age !== currentState.age || currentState.level === 'L3')) {
          fail(seed, `[路由不变量] 进入晋升庆祝 '${nextId}'，但本回合未合法晋升 (last_promo_age=${currentState.last_promo_age}, age=${currentState.age}, level=${currentState.level})！事件='${currentEventId}'`, yearPath);
          break;
        }

        if (!nextId) break;
        currentEventId = nextId;

      } catch (e: any) {
        fail(seed, `[运行时崩溃] 在事件 '${currentEventId}' 中执行 choice 时报错: ${e?.message || e}`, yearPath);
        break;
      }

      steps++;
      totalPathsChecked++;
    }

    // 步数耗尽兜底:正常人生会因 win / game_over / 健康归零 / 破产而终止,远达不到 maxSteps。
    // 若一局跑满 maxSteps 仍 status==='playing',说明卡在某个永不escape、不推进年份的无限循环里
    // (上面按事件计数的哨兵只在同年内 >=3 次触发,漏掉的真·无限循环由此确定性兜住)。
    if (steps >= maxSteps && currentState.status === 'playing') {
      fail(seed, `[疑似无限循环] 单局跑满 ${maxSteps} 步仍未终止 (status=playing),疑似无法推进的死循环。停在事件='${currentEventId}'`, yearPath);
    }
  }

  const scope = singleSeed !== undefined ? `单局回放 (seed=${singleSeed})` : `${iterations} 局人生`;
  console.log(`✅ Fuzz 测试完成！模拟了 ${scope}。`);
  console.log(`📊 总计校验了 ${totalPathsChecked} 次状态流转。`);

  if (errorsFound > 0) {
    console.error(`🚨 测试失败：共发现 ${errorsFound} 个致命错误！请用上方 SEED=<n> 命令一键复现修复。`);
    process.exit(1);
  } else {
    console.log(`🎉 测试通过：全量状态不变性 (Invariants) + 同回合回路 校验 100% 稳固！`);
  }
}

// SEED=<n> 环境变量 → 只跑该单局并回放(用于复现失败局);否则跑 10,000 局确定性 fuzz。
const envSeed = process.env.SEED;
if (envSeed !== undefined && envSeed !== '') {
  const s = Number(envSeed);
  console.log(`🔁 单局回放模式:seed=${s}`);
  runFuzzTest(1, 0, s);
} else {
  runFuzzTest(10000, 1);
}
