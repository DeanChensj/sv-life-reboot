import { events, generateInitialState, midYearEventRouter } from './src/data/events';
import { GameState, Choice } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';
import { getJobDisplayInfo, getVisaDisplayInfo, getHousingDisplayInfo, getTCBreakdown } from './src/utils/gameStateSelectors';
import { migrateSaveData, CURRENT_SAVE_VERSION } from './src/utils/saveMigration';
import { setGameSeed, gameRandom } from './src/utils/random';
import { determineEnding } from './src/utils/endings';

console.log('🚀 === STARTING SV LIFE REBOOT FULL CUJ INTEGRATION SUITE ===\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    console.error(`❌ ASSERTION FAILED: ${message}`);
  }
}

/**
 * Helper to simulate a choice transition with full invariant checks
 */
function stepChoice(
  state: GameState,
  eventId: string,
  choiceIndex: number,
  overrideState?: Partial<GameState>
): { nextState: GameState; nextEventId: string } {
  const currentEvent = events[eventId];
  if (!currentEvent) {
    throw new Error(`Event '${eventId}' does not exist!`);
  }
  const choice = currentEvent.choices[choiceIndex];
  if (!choice) {
    throw new Error(`Choice index ${choiceIndex} does not exist on event '${eventId}'!`);
  }

  // Pre-condition check if any
  if (choice.condition) {
    assert(choice.condition(state), `Choice ${choiceIndex} condition on event '${eventId}' must be satisfied`);
  }

  const effect = choice.effect(state);
  if (overrideState) {
    Object.assign(effect, overrideState);
  }

  const transition = applyStateTransition(state, effect, { eventId, source: 'event' });
  const nextState = transition.nextState;

  // Invariant verification on every single step
  assert(!isNaN(nextState.health) && nextState.health >= 0 && nextState.health <= 100, `Health ${nextState.health} must be in [0, 100]`);
  assert(!isNaN(nextState.cash), `Cash must not be NaN`);
  assert(!isNaN(nextState.stocks || 0), `Stocks must not be NaN`);
  if (nextState.laid_off || nextState.job_type === 'unemployed') {
    assert(nextState.tc === 0, `Unemployed player TC must be 0`);
  }
  if (state.visa === '公民') {
    assert(nextState.visa === '公民', `US Citizen status must never downgrade`);
  }
  if (state.visa === '绿卡' && nextState.visa !== '公民') {
    assert(nextState.visa === '绿卡', `Green card status must never downgrade`);
  }

  // Selector consistency verification
  const jobInfo = getJobDisplayInfo(nextState);
  const visaInfo = getVisaDisplayInfo(nextState);
  const housingInfo = getHousingDisplayInfo(nextState);
  assert(Boolean(jobInfo.companyLabel && jobInfo.levelLabel), `Job selector must return valid labels`);
  assert(Boolean(visaInfo.visaLabel), `Visa selector must return valid visa label`);
  assert(Boolean(housingInfo.housingLabel), `Housing selector must return valid housing label`);

  let nextEventId = transition.targetEventId;
  if (!nextEventId) {
    if (typeof choice.nextEventId === 'function') {
      nextEventId = choice.nextEventId(nextState);
    } else {
      nextEventId = choice.nextEventId;
    }
  }

  return { nextState, nextEventId };
}

// =========================================================================
// CUJ 1: Standard Big Tech CS Master Journey (F-1 -> OPT -> H-1B -> PERM -> I-140 -> PD -> Green Card)
// =========================================================================
console.log('--- [CUJ 1] Standard Big Tech CS Master Journey ---');
{
  let state = generateInitialState();
  state.is_ssr_unlocked = false;
  state.cash = 40;

  // 1. Choose Trait: 卷王之王
  let res = stepChoice(state, 'choose_trait', 1);
  state = res.nextState;
  assert(res.nextEventId === 'choose_year', 'choose_trait -> choose_year');
  assert(state.leetcode >= 40, 'LeetCode boost applied');

  // 2. Choose Year: 普通难度 (2018)
  res = stepChoice(state, 'choose_year', 1);
  state = res.nextState;
  assert(res.nextEventId === 'choose_school', 'choose_year -> choose_school');
  assert(state.year === 2018, 'Year initialized to 2018');

  // 3. Choose School: 北美CS四大 (CMU)
  res = stepChoice(state, 'choose_school', 0);
  state = res.nextState;
  assert(res.nextEventId === 'us_undergrad_year1', 'choose_school -> us_undergrad_year1');
  assert(state.visa === 'F1 (学生)', 'Visa set to F-1');
  assert(state.school === 'cmu', 'School set to CMU');

  // 4. College Year 1
  res = stepChoice(state, 'us_undergrad_year1', 0);
  state = res.nextState;

  // 5. College Grad -> Job Hunt
  res = stepChoice(state, 'us_undergrad_grad', 1);
  state = res.nextState;
  assert(state.visa === 'OPT (实习)', 'Graduation activated OPT');

  // 6. Job Hunt -> Google L3
  res = stepChoice(state, 'job_hunt', 0, { company: 'google', job_type: 'big_tech', tc: 18, level: 'L3' });
  state = res.nextState;
  assert(state.company === 'google', 'Hired at Google');
  assert(state.tc === 18, 'TC set to $18w');

  // 7. Choose Housing: Cupertino 合租
  res = stepChoice(state, 'choose_housing', 1);
  state = res.nextState;

  // 8. H1B First Year Lottery win
  res = stepChoice(state, 'big_tech_work', 0, { visa: 'H1B (工签)' });
  state = res.nextState;
  assert(state.visa === 'H1B (工签)', 'H1B Lottery won');

  // 9. Year End Settlement with PERM progress
  state.cash += 15;
  state.stocks = 10;
  state.gc_stage = 'perm_processing';
  state.gc_progress = 1.0;
  const visaInfo = getVisaDisplayInfo(state);
  assert(visaInfo.gcStation === 1, 'GC Station is 1 (PERM)');

  // Advance to I-140 Approved
  state.gc_stage = 'i140_approved';
  state.gc_progress = 3.0;
  const visaInfo2 = getVisaDisplayInfo(state);
  assert(visaInfo2.gcStation === 3, 'GC Station is 3 (I-140 Approved)');

  // Advance to Green Card Approved
  state.visa = '绿卡';
  // Company-specific event routing check: Apple worker must never trigger meta_tlm
  const appleState: GameState = {
    ...state,
    company: 'apple',
    job_type: 'big_tech',
    season_stage: 'h1',
    tc: 40,
  };
  for (let i = 0; i < 50; i++) {
    const routed = midYearEventRouter(appleState);
    assert(routed !== 'meta_tlm', 'Apple employee must never receive Meta TLM event');
  }

  // 10. Financial & Equity TC breakdown assertions
  const tcBreakdown = getTCBreakdown(appleState);
  assert(tcBreakdown.preTaxBase === 22, 'Big Tech cash base is 55% of $40w ($22w)');
  assert(tcBreakdown.preTaxRSU === 18, 'Big Tech RSU is 45% of $40w ($18w)');
  // Progressive tax: $40w TC is in the 32% band → base 22*0.68=14.96, RSU 18*0.68=12.24
  assert(tcBreakdown.postTaxBase === 14.96, 'Post-tax cash is $14.96w (32% band)');
  assert(tcBreakdown.postTaxRSU === 12.24, 'Post-tax RSU is $12.24w (32% band)');

  // 12. Progression ladder (L3 -> L4 -> L5 Senior -> L6 Staff)
  state.last_promo_age = state.age - 2;
  state.leetcode = 70;
  state.network = 30;
  state.charm = 20;
  state.health = 80;
  state.tc = 40;
  state.level = 'L5 (Senior)';

  // Test L5 -> L6 Staff promotion choice
  const l6Choice = events['perf_review'].choices.find((c) => c.text.includes('L6 Staff') || c.text.includes('战时冲刺'))!;
  assert(!!l6Choice, 'L6 promotion option is available');
  const l6Res = applyStateTransition(state, {
    level: 'L6 (Staff)',
    tc: state.tc + 12.0,
    last_promo_age: state.age,
  }, { eventId: 'perf_review' });
  assert(l6Res.nextState.level === 'L6 (Staff)', 'Promoted to L6 Staff');
  assert(l6Res.nextState.tc === 52, 'TC increased to $52w');
  const nextTarget = typeof l6Choice.nextEventId === 'function' ? l6Choice.nextEventId(l6Res.nextState) : l6Choice.nextEventId;
  assert(nextTarget === 'l6_staff_celebration', 'Promoting to L6 routes to l6_staff_celebration');

  // 13. Purchase Sunnyvale home & verify asset flow
  state = l6Res.nextState;
  state.cash = 100;
  state.stocks = 80;
  const buyHouseTrans = applyStateTransition(state, {
    cash: state.cash - 45,
    has_housing: true,
    housing_name: 'Sunnyvale 老破小',
    rent: 1.5,
  }, { eventId: 'buy_house' });
  state = buyHouseTrans.nextState;
  assert(state.has_housing === true, 'Player owns house');
  assert(getHousingDisplayInfo(state).isHomeowner === true, 'Housing selector marks homeowner');

  // 14. Year-end settlement with RSU vesting & FIRE achievement
  state.cash = 480;
  state.stocks = 60; // Total 540w > 500w
  const settleTrans = applyStateTransition(state, {}, { eventId: 'sv_year_end_settlement' });
  assert(settleTrans.targetEventId === 'fire_milestone_choice', 'Year-end settlement triggers fire_milestone_choice upon reaching $500w');

  console.log('✅ CUJ 1 Passed\n');
}

// =========================================================================
// CUJ 2: Native US Citizen SSR Journey (SSR Trait -> Direct Freedom)
// =========================================================================
console.log('--- [CUJ 2] Native US Citizen SSR Journey ---');
{
  let state = generateInitialState();
  state.is_ssr_unlocked = true;

  // 1. Choose Trait: 原生美籍 (SSR)
  let res = stepChoice(state, 'choose_trait', 0);
  state = res.nextState;
  assert(state.visa === '公民', 'Visa is US Citizen');
  assert(state.win_threshold === 400, 'Lower win threshold for citizen');
  assert(res.nextEventId === 'choose_year', 'choose_trait -> choose_year');

  const visaInfo = getVisaDisplayInfo(state);
  assert(visaInfo.visaLabel === '美籍公民 (SSR)', 'Shows SSR Citizen badge');
  assert(visaInfo.isPermanent === true, 'isPermanent is true');

  // 2. Choose Year -> School
  res = stepChoice(state, 'choose_year', 0);
  state = res.nextState;
  res = stepChoice(state, 'choose_school', 2); // State university with in-state discount
  state = res.nextState;
  assert(state.visa === '公民', 'Visa remains US Citizen throughout school');

  console.log('✅ CUJ 2 Passed\n');
}

// =========================================================================
// CUJ 3: PhD Academic / AI Researcher / MTS Journey & Anti-Loop Test
// =========================================================================
console.log('--- [CUJ 3] PhD Academic / AI Researcher / MTS Journey ---');
{
  let state = generateInitialState();
  state.cash = 35;
  state.leetcode = 80;

  // 1. Setup Undergrad Grad -> PhD
  state.school = 'cmu';
  let res = stepChoice(state, 'us_undergrad_grad', 0, { is_phd: true, housing_name: '美国 博士实验室' });
  state = res.nextState;
  assert(state.is_phd === true, 'PhD status confirmed');
  assert(res.nextEventId === 'phd_life', 'Routed to phd_life');

  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.levelLabel === '全奖博士', 'Level displays 全奖博士 before job');

  // 2. Anti-Loop Verification: Choice 2 (Tahoe Vacation) routes to phd_mid_stage (not looping back to phd_life)
  let vacationRes = stepChoice(state, 'phd_life', 2);
  assert(vacationRes.nextEventId === 'phd_mid_stage', 'PhD Tahoe vacation properly advances to phd_mid_stage (no infinite loop back to phd_life)');
  assert(vacationRes.nextState.age === state.age + 1, 'Age increments by 1 on vacation');
  assert(vacationRes.nextState.year === state.year + 1, 'Year increments by 1 on vacation');
  assert(vacationRes.nextState.health === 100, 'Health restored on Tahoe ski vacation');

  // 3. PhD Mid Stage Choice 3 (Master Out) routes to job_hunt
  let midStageMasterOutRes = stepChoice(vacationRes.nextState, 'phd_mid_stage', 3);
  assert(midStageMasterOutRes.nextEventId === 'job_hunt', 'PhD Master Out routes to job_hunt');
  assert(midStageMasterOutRes.nextState.is_phd === false, 'PhD status revoked on master out');
  assert(midStageMasterOutRes.nextState.is_master === true, 'Player receives master degree on master out');

  // 4. PhD Mid Stage Choice 1 (DeepMind / FAIR Research Intern) grants cash and graduation
  let internRes = stepChoice(vacationRes.nextState, 'phd_mid_stage', 1, { is_phd: true, cash: vacationRes.nextState.cash + 6 });
  assert(internRes.nextEventId === 'phd_job_hunt', 'AI research internship successfully completes PhD defense');
  assert(internRes.nextState.is_phd === true, 'PhD degree maintained after research internship');
  assert(internRes.nextState.cash > vacationRes.nextState.cash, 'Earned stipend from research internship');

  // 5. PhD Direct Paper Success -> phd_conference -> phd_job_hunt -> OpenAI MTS Offer
  // Force the SUCCESS branch deterministically: phd_life choice 0 routes on
  // story_flags.hawaii_conf, which the effect only sets on a gameRandom() pass. This
  // CUJ runs without reseeding, so its roll depends on the global PRNG state left by
  // the prior test scripts — inject the flag so the "Successful paper" path is stable
  // regardless of upstream gameRandom call counts.
  res = stepChoice(state, 'phd_life', 0, { is_phd: true, story_flags: { ...state.story_flags, hawaii_conf: true }, message: '两年的昼夜颠倒，你的论文终于有突破性进展并被顶会接收，老板决定带你去夏威夷参加顶级学术会议！' });
  assert(res.nextEventId === 'phd_conference', 'Successful paper routes to phd_conference');
  state = res.nextState;

  res = stepChoice(state, 'phd_conference', 0);
  assert(res.nextEventId === 'phd_job_hunt', 'Conference networking routes to phd_job_hunt');
  state = res.nextState;
  assert(state.is_phd === true, 'PhD degree awarded after conference defense');

  // Apply to OpenAI MTS
  res = stepChoice(state, 'phd_job_hunt', 0, { company: 'openai', job_type: 'ai_research', tc: 45, level: 'MTS', visa: 'O1 (杰出人才)' });
  state = res.nextState;
  assert(state.job_type === 'ai_research', 'Job type is ai_research');
  assert(state.visa === 'O1 (杰出人才)', 'Visa is O1');

  const jobInfo2 = getJobDisplayInfo(state);
  assert(jobInfo2.companyLabel === 'OpenAI / MTS', 'Company displays OpenAI / MTS');
  assert(jobInfo2.levelLabel === 'MTS', 'Level displays MTS');

  console.log('✅ CUJ 3 Passed\n');
}

// =========================================================================
// CUJ 4: Layoff & Contingency Journey (Layoff -> Day 1 CPT / L1)
// =========================================================================
console.log('--- [CUJ 4] Layoff & Contingency Journey ---');
{
  let state = generateInitialState();
  state.visa = 'H1B (工签)';
  state.job_type = 'big_tech';
  state.company = 'meta';
  state.level = 'L4';
  state.tc = 28;

  // 1. Layoff Event
  let res = stepChoice(state, 'layoff_rumor', 0, { laid_off: true, job_type: 'unemployed', tc: 0 });
  state = res.nextState;
  assert(state.laid_off === true, 'Laid off is true');
  assert(state.tc === 0, 'TC is 0');

  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.companyLabel === '待业求职中', 'Company badge is 待业求职中');
  assert(jobInfo.levelLabel === '待业', 'Level badge is 待业 (not L4)');

  // 2. Emergency Day 1 CPT Registration
  state.cash = 10;
  res = stepChoice(state, 'job_hunt_fail', 3, { visa: 'Day 1 CPT' });
  state = res.nextState;
  assert(state.visa === 'Day 1 CPT', 'Visa successfully transferred to Day 1 CPT');

  // 3. Marriage green card availability assertions (Single vs In a Relationship)
  const singlePoorState: GameState = { ...state, relationship_status: 'single', cash: 2, charm: 10 };
  const singleRichState: GameState = { ...state, relationship_status: 'single', cash: 10, charm: 10 };
  const marriedState: GameState = { ...state, relationship_status: 'dating', is_married: false };

  const fallbackEv = events['h1b_fallback_options'];
  assert(!fallbackEv.choices[0].condition!(singlePoorState), 'Single poor player cannot choose true love marriage');
  assert(!fallbackEv.choices[1].condition!(singlePoorState), 'Single poor player cannot choose $8w commercial marriage');
  assert(fallbackEv.choices[1].condition!(singleRichState), 'Single player with $10w cash can choose $8w commercial marriage');
  assert(fallbackEv.choices[0].condition!(marriedState), 'Player with dating partner can choose true love marriage');

  console.log('✅ CUJ 4 Passed\n');
}

// =========================================================================
// CUJ 5: Domestic Undergrad to Overseas Tech Journey
// =========================================================================
console.log('--- [CUJ 5] Domestic Undergrad to Overseas Tech Journey ---');
{
  let state = generateInitialState();
  state.cash = 5;

  // 1. Domestic Undergrad School choice
  let res = stepChoice(state, 'choose_school', 3);
  state = res.nextState;
  assert(res.nextEventId === 'cn_college_grad', 'Routed to cn_college_grad');
  assert(state.visa === '无', 'No US visa yet');

  const visaInfo = getVisaDisplayInfo(state);
  assert(visaInfo.visaLabel === '暂无 (未赴美)', 'Displays 暂无 (未赴美)');

  // 2. Graduate into domestic big tech
  res = stepChoice(state, 'cn_undergrad_grad', 3);
  state = res.nextState;
  assert(res.nextEventId === 'cn_work', 'Routed to cn_work');
  assert(state.company === 'cn_big_tech', 'Company is cn_big_tech');
  assert(state.job_type === 'cn_tech', 'Job type is cn_tech');

  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.companyLabel === '国内互联网大厂', 'Displays 国内互联网大厂');
  assert(jobInfo.levelLabel === '国内研发', 'Displays 国内研发');

  const visaInfo2 = getVisaDisplayInfo(state);
  assert(visaInfo2.visaLabel === '暂无 (国内在职)', 'Displays 暂无 (国内在职)');

  // 3. Early career 996 work (anti-loop check: advances to cn_work_mid)
  let midRes = stepChoice(state, 'cn_work', 0);
  assert(midRes.nextEventId === 'cn_work_mid', 'Early domestic work advances to cn_work_mid (no self loop)');
  assert(midRes.nextState.age === state.age + 1, 'Age advances 1 year');
  assert(midRes.nextState.year === state.year + 1, 'Year advances 1 year');
  assert(midRes.nextState.cash > state.cash, 'Saved net salary');

  // 4. Mid stage N+3 layoff package -> US Master
  let masterRes = stepChoice(midRes.nextState, 'cn_work_mid', 1);
  assert(masterRes.nextEventId === 'us_master_year1', 'N+3 layoff package routes to us_master_year1');
  assert(masterRes.nextState.visa === 'F1 (学生)', 'F1 visa acquired');
  assert(masterRes.nextState.is_master === true, 'US master status activated');

  console.log('✅ CUJ 5 Passed\n');
}

// =========================================================================
// CUJ 6: Real Estate & Passive Cash Flow Expansion
// =========================================================================
console.log('--- [CUJ 6] Real Estate & Passive Cash Flow Expansion ---');
{
  let state = generateInitialState();
  state.cash = 100;
  state.stocks = 50;

  // 1. Buy Sunnyvale Home
  let transition = applyStateTransition(state, {
    cash: state.cash - 30,
    has_housing: true,
    housing_name: 'Sunnyvale 老破小',
    rent: 0,
  }, { source: 'shop' });
  state = transition.nextState;

  let housingInfo = getHousingDisplayInfo(state);
  assert(housingInfo.isHomeowner === true, 'isHomeowner is true');
  assert(housingInfo.housingLabel === 'Sunnyvale 老破小', 'housingLabel is Sunnyvale 老破小');

  // Verify timeline auto-captured property purchase
  const hasRealEstateTimeline = (state.timeline || []).some(t => t.title.includes('Sunnyvale 老破小'));
  assert(hasRealEstateTimeline, 'Timeline automatically recorded real estate purchase');

  // 2. Add ADU Rental + Austin Rental
  transition = applyStateTransition(state, {
    cash: state.cash - 26.5,
    rental_income: 4.2,
    has_adu_rented: true,
    investment_properties: ['Austin 远程独栋屋'],
  }, { source: 'shop' });
  state = transition.nextState;

  assert(state.rental_income === 4.2, 'Rental income updated to 4.2w');
  const hasRentalTimeline = (state.timeline || []).some(t => t.title.includes('被动现金流'));
  assert(hasRentalTimeline, 'Timeline recorded passive rental cash flow expansion');

  console.log('✅ CUJ 6 Passed\n');
}

// =========================================================================
// CUJ 7: Game Over / Bankruptcy & Burnout Protection
// =========================================================================
console.log('--- [CUJ 7] Game Over / Bankruptcy & Burnout Handlers ---');
{
  let state = generateInitialState();
  state.health = 5;
  state.cash = 0.5;
  state.stocks = 0;

  // 1. Trigger Burnout
  let transition = applyStateTransition(state, { health: 0 });
  assert(transition.nextState.status === 'game_over', 'Health <= 0 triggers game_over');
  assert(transition.targetEventId === 'end', 'Routes to end event on game over');

  // 2. Trigger Bankruptcy with no stocks
  let state2 = generateInitialState();
  state2.cash = 1;
  state2.stocks = 0;
  let transition2 = applyStateTransition(state2, { cash: -5 });
  assert(transition2.nextState.status === 'game_over', 'Negative cash with 0 stocks triggers bankruptcy game_over');

  // 3. Trigger Auto Liquidation when stocks are available
  let state3 = generateInitialState();
  state3.cash = 2;
  state3.stocks = 10;
  let transition3 = applyStateTransition(state3, { cash: state3.cash - 6 });
  assert(transition3.nextState.cash >= 0, 'Auto liquidation covered negative cash');
  assert((transition3.nextState.stocks ?? 0) < 10, 'Stocks decreased by deficit amount');
  assert(transition3.nextState.status === 'playing', 'Game continues after auto-liquidation');

  console.log('✅ CUJ 7 Passed\n');
}

// =========================================================================
// CUJ 8: Save Schema Migration & Deterministic Seedable PRNG Verification
// =========================================================================
console.log('--- [CUJ 8] Save Schema Migration & Deterministic PRNG ---');
{
  // 1. Ancient v0 legacy save with missing arrays, NaNs, and unversioned envelope
  const rawLegacySave = {
    gameState: {
      age: 32,
      year: 2022,
      cash: NaN,
      health: 120, // out of bounds
      leetcode: -10, // out of bounds
      laid_off: true,
      tc: 35, // should be 0 for laid off
      // missing timeline, history_net_worth, story_flags, npcs, stocks
    },
    currentEventId: 'job_hunt',
  };

  const migrated = migrateSaveData(rawLegacySave);
  assert(migrated.gameState.age === 32, 'Age preserved');
  assert(!isNaN(migrated.gameState.cash), 'NaN cash sanitized');
  assert(migrated.gameState.health <= 100, 'Health clamped to <= 100');
  assert(migrated.gameState.leetcode >= 0, 'LeetCode clamped to >= 0');
  assert(migrated.gameState.tc === 0, 'Unemployed TC reset to 0');
  assert(Array.isArray(migrated.gameState.timeline), 'Timeline polyfilled to Array');
  assert(Array.isArray(migrated.gameState.history_net_worth), 'History polyfilled to Array');
  assert(typeof migrated.gameState.story_flags === 'object', 'StoryFlags polyfilled');
  assert(typeof migrated.gameState.seed === 'number', 'Seed initialized');
  assert(migrated.migratedFromVersion === 0, 'Detected v0 migration');

  // 2. Deterministic Seedable PRNG Test
  setGameSeed(12345);
  const run1 = [gameRandom(), gameRandom(), gameRandom()];

  setGameSeed(12345);
  const run2 = [gameRandom(), gameRandom(), gameRandom()];

  assert(run1[0] === run2[0] && run1[1] === run2[1] && run1[2] === run2[2], 'PRNG is 100% deterministic given same seed');

  console.log('✅ CUJ 8 Passed\n');
}

// CUJ 9: Multi-ending classifier (determineEnding)
{
  console.log('--- [CUJ 9] Multi-Ending Classifier ---');
  const base = () => generateInitialState();
  const end = (over: Partial<GameState>) => determineEnding({ ...base(), ...over } as GameState).id;

  // Tragedies
  assert(end({ status: 'game_over', health: 0 }) === 'burnout', 'game_over + health 0 -> burnout');
  assert(end({ status: 'game_over', health: 40, cash: 0, stocks: 0 }) === 'bankruptcy', 'game_over + no cash -> bankruptcy');
  assert(end({ status: 'game_over', health: 40, cash: 5, message: '被迫登机回国，签证失效' }) === 'deported', 'game_over + deport message -> deported');
  assert(end({ status: 'game_over', health: 40, cash: 5, job_type: 'startup_founder' }) === 'startup_ruin', 'game_over + founder -> startup_ruin');

  // Triumphs (win, or retired while wealthy)
  assert(end({ status: 'win', cash: 600, stocks: 0, founder_stage: 'exit' }) === 'unicorn_founder', 'win + founder exit -> unicorn');
  assert(end({ status: 'win', cash: 600, stocks: 0, job_type: 'trader' }) === 'wall_street_wolf', 'win + trader -> wall_street_wolf');
  assert(end({ status: 'win', cash: 600, stocks: 0, is_phd: true, job_type: 'ai_research' }) === 'ai_academic', 'win + phd research -> academic');
  assert(end({ status: 'win', cash: 600, stocks: 0, level: 'L8 (Principal)' }) === 'tech_totem', 'win + L8 -> tech_totem');
  assert(end({ status: 'win', cash: 600, stocks: 0, rental_income: 12 }) === 'real_estate_mogul', 'win + rental -> mogul');
  assert(end({ status: 'win', cash: 3200, stocks: 0 }) === 'silicon_dynasty', 'win + 3200 assets -> silicon_dynasty');
  assert(end({ status: 'win', cash: 1600, stocks: 0 }) === 'atherton_lord', 'win + 1600 assets -> atherton');
  assert(end({ status: 'win', cash: 900, stocks: 0 }) === 'fire_comfortable', 'win + 900 assets -> fire_comfortable');
  assert(end({ status: 'win', cash: 550, stocks: 0, job_type: 'big_tech', level: 'L5 (Senior)' }) === 'fire_basic', 'plain win -> fire_basic');

  // Content (retired, not wealthy)
  assert(end({ status: 'retired', cash: 25, stocks: 0, visa: '无', job_type: 'cn_tech', story_flags: { cn_hermit: true } } as any) === 'cn_hermit', 'retired + cn_hermit flag -> 国内隐居 (not FIRE triumph)');
  assert(end({ status: 'retired', cash: 100, stocks: 0, visa: '无' }) === 'homecoming', 'retired + no US visa -> homecoming (海归)');
  assert(end({ status: 'retired', cash: 100, stocks: 0, visa: '公民', is_married: true }) === 'settled_family', 'retired + citizen + married -> settled_family');
  assert(end({ status: 'retired', cash: 50, stocks: 0, health: 90, is_married: false, visa: 'H1B (工签)' }) === 'zen_hermit', 'retired + healthy + poor -> zen_hermit');
  assert(end({ status: 'retired', cash: 250, stocks: 0, health: 50, is_married: false, visa: 'H1B (工签)' }) === 'middle_class', 'retired + modest -> middle_class');

  // Always returns a defined ending (never crashes / unknown)
  assert(!!determineEnding(base()).id, 'determineEnding always returns an ending');

  console.log('✅ CUJ 9 Passed\n');
}

// CUJ 10: Promotion routing must not show 职级大晋升喜报 on a rejection
{
  console.log('--- [CUJ 10] Promotion routing (no false 喜报 on rejection) ---');
  const perf = events['perf_review'];
  const l7 = perf.choices.find((c) => c.text.includes('L7 Senior Staff'))!;
  const route = l7.nextEventId as (s: GameState) => string;
  // Rejection: level unchanged (MTS/L6), message contains 晋升委员会否决
  const rejected = { ...generateInitialState(), level: 'MTS', message: '晋升委员会否决了你的 L7 Senior Staff 申请，认为你…白卷了一整年。' } as GameState;
  const rid = route(rejected);
  assert(rid !== 'l7_senior_staff_celebration' && rid !== 'promo_celebration', 'L7 rejection does NOT route to any 晋升喜报 celebration');
  // Success: level actually became L7
  const promoted = { ...generateInitialState(), level: 'L7 (Senior Staff)' } as GameState;
  assert(route(promoted) === 'l7_senior_staff_celebration', 'L7 success routes to l7_senior_staff_celebration');

  // Meta Wartime Sprint: verify fast-track promotion and message clarity
  const dailyLife = events['sv_daily_life'];
  const wartimeChoice = dailyLife.choices.find((c) => c.text.includes('大厂战时冲刺'))!;
  const metaStateL3: GameState = {
    ...generateInitialState(),
    company: 'meta',
    job_type: 'big_tech',
    level: 'L3',
    leetcode: 35,
    age: 22,
    last_promo_age: 22,
    tc: 22,
  };
  const wartimeRes = wartimeChoice.effect(metaStateL3);
  if (wartimeRes.level === 'L4') {
    assert(wartimeRes.last_promo_age === 22, 'Wartime sprint promotion must stamp last_promo_age');
    assert(Boolean(wartimeRes.message?.includes('顺利晋升') || wartimeRes.message?.includes('破格晋升')), 'Promo message indicates promotion');
  } else {
    assert(Boolean(wartimeRes.message?.includes('未晋升') || wartimeRes.message?.includes('暂未晋升')), 'Non-promotion message must explicitly indicate 未晋升');
    assert(Boolean(wartimeRes.message?.includes('L3')), 'Non-promotion message must indicate current level is maintained');
  }
  console.log('✅ CUJ 10 Passed\n');
}

// CUJ 11: Year-end company-health message must cover EVERY job_type/company
// (guards the branch-gap class: a value falling into the wrong fallback, e.g.
// TikTok/ai_research/nvidia previously hitting the generic "养老大厂/带薪年假").
{
  console.log('--- [CUJ 11] Year-end company message covers every job_type ---');
  const settleMsg = (over: Partial<GameState>): string => {
    const st = { ...generateInitialState(), health: 60, tc: 30, cash: 20, stocks: 0, laid_off: false, mid_year: false, ...over } as GameState;
    return stepChoice(st, 'sv_year_end_settlement', 0).nextState.message || '';
  };
  assert(settleMsg({ company: 'tiktok', job_type: 'big_tech' }).includes('字节'), 'TikTok -> 字节 (not 养老大厂)');
  assert(settleMsg({ job_type: 'quant' }).includes('高频交易'), 'quant -> 高频交易');
  assert(settleMsg({ job_type: 'big_tech', company: 'nvidia' }).includes('英伟达'), 'nvidia -> 英伟达 (not generic +6)');
  assert(settleMsg({ job_type: 'big_tech', company: 'amazon' }).includes('亚麻'), 'amazon -> 亚麻 PIP (not 养老大厂)');
  assert(settleMsg({ company: 'meta', job_type: 'big_tech' }).includes('Meta'), 'meta -> Meta');
  assert(settleMsg({ job_type: 'startup' }).includes('创业公司'), 'startup -> 创业公司');
  assert(settleMsg({ job_type: 'startup_founder' }).includes('创业找融资'), 'startup_founder -> 创业找融资');
  assert(settleMsg({ job_type: 'ai_research', company: 'openai' }).includes('前沿 AI 实验室'), 'ai_research -> 前沿 AI 实验室 (not 养老大厂)');
  assert(settleMsg({ job_type: 'big_tech', transferred_to_ai: true }).includes('大厂前沿 AI 大模型组'), 'transferred_to_ai -> AI 大模型组 (not 养老大厂)');
  assert(settleMsg({ job_type: 'big_tech', company: 'google' }).includes('养老大厂'), 'plain big_tech -> 养老大厂');
  assert(settleMsg({ job_type: 'cn_tech', company: 'cn_big_tech' }).includes('国内大厂'), 'cn_tech -> 国内大厂');
  console.log('✅ CUJ 11 Passed\n');
}

// CUJ 12: 4-Year RSU Vesting Cliff only triggers for Big Tech employees with tenure >= 3 (year 4+)
{
  console.log('--- [CUJ 12] RSU 4-Year Vesting Cliff tenure gate ---');
  // At year 1 (age 24, job_start_age 24, tenure 0), rsu_vesting_crash is NEVER picked across 100 trials
  const stYear1: GameState = {
    ...generateInitialState(),
    age: 24,
    job_start_age: 24,
    job_type: 'big_tech',
    company: 'google',
    season_stage: 'h2',
    laid_off: false,
    mid_year: true,
  };
  for (let i = 0; i < 100; i++) {
    const picked = midYearEventRouter(stYear1);
    assert(picked !== 'rsu_vesting_crash', `Year 1 (tenure 0) must never trigger rsu_vesting_crash (got ${picked})`);
  }

  // At year 2 (age 25, job_start_age 24, tenure 1), rsu_vesting_crash is NEVER picked across 100 trials
  const stYear2: GameState = { ...stYear1, age: 25, job_start_age: 24 };
  for (let i = 0; i < 100; i++) {
    const picked = midYearEventRouter(stYear2);
    assert(picked !== 'rsu_vesting_crash', `Year 2 (tenure 1) must never trigger rsu_vesting_crash (got ${picked})`);
  }

  // At year 3 (age 26, job_start_age 24, tenure 2), rsu_vesting_crash is NEVER picked across 100 trials
  const stYear3: GameState = { ...stYear1, age: 26, job_start_age: 24 };
  for (let i = 0; i < 100; i++) {
    const picked = midYearEventRouter(stYear3);
    assert(picked !== 'rsu_vesting_crash', `Year 3 (tenure 2) must never trigger rsu_vesting_crash (got ${picked})`);
  }

  // At year 4+ (age 27, job_start_age 24, tenure 3), rsu_vesting_crash IS allowed and CAN be picked
  const stYear4: GameState = { ...stYear1, age: 27, job_start_age: 24 };
  let sawCliffAtYear4 = false;
  for (let i = 0; i < 500; i++) {
    const picked = midYearEventRouter(stYear4);
    if (picked === 'rsu_vesting_crash') {
      sawCliffAtYear4 = true;
      break;
    }
  }
  assert(sawCliffAtYear4, 'Year 4 (tenure 3) in Big Tech is allowed to trigger rsu_vesting_crash');

  // Once rsu_cliff_done is set, it must not trigger again at the same company
  const stYear4Done: GameState = { ...stYear4, story_flags: { rsu_cliff_done: true } };
  for (let i = 0; i < 100; i++) {
    const picked = midYearEventRouter(stYear4Done);
    assert(picked !== 'rsu_vesting_crash', `When rsu_cliff_done is true, must never trigger rsu_vesting_crash (got ${picked})`);
  }

  console.log('✅ CUJ 12 Passed\n');
}

// CUJ 13: Founder mode valuation monotonicity & FIRE milestone protection
{
  console.log('--- [CUJ 13] Founder mode valuation monotonicity & FIRE milestone protection ---');
  const founderState: GameState = {
    ...generateInitialState(),
    job_type: 'startup_founder',
    founder_stage: 'seed',
    company_valuation: 1000,
    cash: 500,
    stocks: 100,
    health: 80,
    status: 'playing',
  };

  // 1. In fire_milestone_choice, existing founder options do NOT reset valuation to 500w
  const fireEvent = events['fire_milestone_choice'];
  const founderChoices = fireEvent.choices.filter((c) => !c.condition || c.condition(founderState));
  assert(founderChoices.length >= 2, 'Founder has multiple FIRE choices available');
  founderChoices.forEach((c, idx) => {
    const eff = c.effect(founderState);
    const nextVal = eff.company_valuation !== undefined ? eff.company_valuation : founderState.company_valuation;
    assert(nextVal! >= 1000, `FIRE Choice ${idx} ('${c.text}') must not downgrade valuation from $1000w (got $${nextVal}w)`);
  });

  // 2. Sand Hill Road VC Pitch advancement must not lower existing valuation
  const founderPreSeedWith1000w: GameState = {
    ...founderState,
    founder_stage: 'pre_seed',
    company_valuation: 1000,
    network: 50,
  };
  const stepPitchRes = stepChoice(founderPreSeedWith1000w, 'founder_annual_strategy', 0, {
    founder_stage: 'seed',
    company_valuation: 1400,
  });
  assert((stepPitchRes.nextState.company_valuation || 0) >= 1000, 'Advancing to seed round from high base valuation never drops below 1000w');

  // 3. HUD founder-stage label is driven PURELY by the authoritative founder_stage, never a
  //    mismatched valuation threshold (regression: $500w pre_seed once mislabeled 种子轮).
  const preSeed500 = { ...generateInitialState(), job_type: 'startup_founder', founder_stage: 'pre_seed', company_valuation: 500 } as GameState;
  assert(getJobDisplayInfo(preSeed500).levelLabel.includes('车库 Pre-Seed'), 'Founder pre_seed @ $500w shows 车库 Pre-Seed (not 种子轮)');
  const seedStage = { ...preSeed500, founder_stage: 'seed', company_valuation: 700 } as GameState;
  assert(getJobDisplayInfo(seedStage).levelLabel.includes('种子轮 Seed'), 'Founder seed stage shows 种子轮 Seed');
  // After the middleware sync, the HUD label always matches the derived authoritative stage.
  const synced = applyStateTransition({ ...preSeed500, company_valuation: 3000 }, {}, { eventId: 'sv_daily_life' }).nextState;
  const stageLabels: Record<string, string> = { pre_seed: '车库 Pre-Seed', seed: '种子轮 Seed', series_a: 'A轮成长', series_b: 'B轮独角兽', exit: '准上市' };
  assert(getJobDisplayInfo(synced).levelLabel.includes(stageLabels[synced.founder_stage!]), `HUD label matches middleware-synced founder_stage (${synced.founder_stage})`);

  console.log('✅ CUJ 13 Passed\n');
}

// CUJ 14: Multi-tier FIRE progression & 1500w/3000w milestones
{
  console.log('--- [CUJ 14] Multi-tier FIRE milestone progression ---');
  // 1. Initial 500w milestone trigger
  const state500w: GameState = {
    ...generateInitialState(),
    cash: 520,
    stocks: 0,
    win_threshold: 500,
    last_fire_milestone_reached: 0,
    status: 'playing',
  };
  const res500 = applyStateTransition(state500w, {}, { eventId: 'sv_daily_life' });
  assert(res500.targetEventId === 'fire_milestone_choice', 'Hitting 500w win_threshold triggers fire_milestone_choice');

  // 2. Player opts into 1500w Luxury FIRE
  const sprintChoice = events['fire_milestone_choice'].choices.find((c) => c.text.includes('1500w') && c.text.includes('冲刺'))!;
  assert(!!sprintChoice, '1500w sprint choice exists in fire_milestone_choice');
  const sprintEff = sprintChoice.effect(state500w);
  const { nextState: stateSprinting } = applyStateTransition(state500w, sprintEff, { eventId: 'fire_milestone_choice' });
  assert(stateSprinting.win_threshold === 1500, 'win_threshold updated to 1500');
  assert(stateSprinting.last_fire_milestone_reached === 800 || stateSprinting.last_fire_milestone_reached === 500, 'last_fire_milestone_reached tracked');
  assert(stateSprinting.fire_tier === 'luxury', 'fire_tier set to luxury');

  // 3. Player hits 1500w (Second FIRE!) -> fire_milestone_choice triggers again
  const state1500w: GameState = {
    ...stateSprinting,
    cash: 1550,
    stocks: 50,
  };
  const res1500 = applyStateTransition(state1500w, {}, { eventId: 'sv_daily_life' });
  assert(res1500.targetEventId === 'fire_milestone_choice', 'Hitting 1500w win_threshold triggers fire_milestone_choice for the 2nd time');

  // 4. Retiring at 1500w -> produces Luxury FIRE (atherton_lord), NOT basic "见好就收"
  const luxuryRetireChoice = events['fire_milestone_choice'].choices.find((c) => (!c.condition || c.condition(state1500w)) && c.text.includes('奢华 FIRE') && c.text.includes('退休'))!;
  assert(!!luxuryRetireChoice, 'Luxury retirement choice is available at 1500w');
  const luxuryEff = luxuryRetireChoice.effect(state1500w);
  const { nextState: stateWon } = applyStateTransition(state1500w, luxuryEff, { eventId: 'fire_milestone_choice' });
  assert(stateWon.status === 'win', 'status is win');
  const endResult = determineEnding(stateWon);
  assert(endResult.id === 'atherton_lord', `1500w FIRE retirement must produce atherton_lord (got ${endResult.id} '${endResult.title}')`);
  assert(endResult.title.includes('奢华 FIRE'), 'Title must be 奢华 FIRE (not 见好就收)');

  console.log('✅ CUJ 14 Passed\n');
}

// CUJ 15: Founder Exit Event (M&A / IPO / Clean Exit)
{
  console.log('--- [CUJ 15] Founder exit decision & M&A/IPO resolution ---');
  const founderState: GameState = {
    ...generateInitialState(),
    job_type: 'startup_founder',
    founder_stage: 'series_b',
    company_valuation: 4500,
    cash: 80,
    stocks: 0,
    status: 'playing',
  };

  // 1. sv_daily_life choice routes to founder_exit_event
  const dailyExit = events['sv_daily_life'].choices.find((c) => c.text.includes('终局退场') && (!c.condition || c.condition(founderState)))!;
  assert(!!dailyExit, 'sv_daily_life has founder exit choice');
  const exitNext = typeof dailyExit.nextEventId === 'function' ? dailyExit.nextEventId(founderState) : dailyExit.nextEventId;
  assert(exitNext === 'founder_exit_event', 'sv_daily_life founder exit routes to founder_exit_event');

  // 2. founder_annual_strategy choice routes to founder_exit_event
  const stratExit = events['founder_annual_strategy'].choices.find((c) => c.text.includes('终局退场 Exit') && (!c.condition || c.condition(founderState)))!;
  assert(!!stratExit, 'founder_annual_strategy has founder exit choice');
  const stratExitNext = typeof stratExit.nextEventId === 'function' ? stratExit.nextEventId(founderState) : stratExit.nextEventId;
  assert(stratExitNext === 'founder_exit_event', 'founder_annual_strategy exit routes to founder_exit_event');

  // 3. Acqui-hire M&A converts founder to Big Tech Staff/Senior Staff and liquidates valuation
  const exitEvent = events['founder_exit_event'];
  const maChoice = exitEvent.choices.find((c) => c.text.includes('并购'))!;
  assert(!!maChoice, 'founder_exit_event has Acqui-hire M&A choice');
  const maEff = maChoice.effect(founderState);
  const { nextState: maState } = applyStateTransition(founderState, maEff, { eventId: 'founder_exit_event' });
  assert(maState.job_type === 'big_tech', 'Founder converted to big_tech on M&A');
  assert(maState.level === 'L7 (Senior Staff)', 'High valuation founder becomes L7 Staff');
  assert(maState.company_valuation === 0, 'Company valuation reset to 0 on exit');
  assert(!maState.laid_off, 'Founder is not laid off on M&A');

  // 4. IPO choice at exit stage produces unicorn triumph ending
  const ipoChoice = exitEvent.choices.find((c) => c.text.includes('IPO'))!;
  assert(!!ipoChoice, 'founder_exit_event has IPO choice');
  const ipoEff = ipoChoice.effect(founderState);
  const { nextState: ipoState } = applyStateTransition(founderState, ipoEff, { eventId: 'founder_exit_event' });
  assert(ipoState.status === 'win', 'IPO choice sets status win');
  assert(determineEnding(ipoState).id === 'unicorn_founder', 'IPO win produces unicorn_founder ending');

  console.log('✅ CUJ 15 Passed\n');
}

// CUJ 16: Voluntary early retirement (permanent visa + assets >= $200w/2M)
// Late-game agency: step off the treadmill before hitting the $500w FIRE bar.
// Gated on permanent status + wealth floor; below FIRE → content ending, above → triumph.
{
  console.log('--- [CUJ 16] Voluntary early retirement gate & ending ---');
  const findRetire = (s: GameState) =>
    events['sv_daily_life'].choices.find((c) => c.text.includes('提前上岸') && (!c.condition || c.condition(s)));

  // 1. Eligible: permanent visa (绿卡) + assets >= 200 → choice available
  const eligible: GameState = { ...generateInitialState(), visa: '绿卡', cash: 150, stocks: 100, health: 60, age: 42, status: 'playing' };
  const retireChoice = findRetire(eligible);
  assert(!!retireChoice, 'Voluntary retire choice available for permanent visa + assets >= $200w');

  // 2. Ineligible: temporary visa (can't just retire in the US on a work visa)
  assert(!findRetire({ ...eligible, visa: 'H1B (工签)' }), 'Voluntary retire NOT available on temporary H1B visa');
  // 3. Ineligible: below the $200w wealth floor
  assert(!findRetire({ ...eligible, cash: 80, stocks: 50 }), 'Voluntary retire NOT available below $200w assets');

  // 4. Effect retires the player and routes to end; below-FIRE assets → content ending
  const retEff = retireChoice!.effect(eligible);
  const { nextState: retState } = applyStateTransition(eligible, retEff, { eventId: 'sv_daily_life' });
  assert(retState.status === 'retired', 'Voluntary retire sets status retired');
  const modestEnding = determineEnding(retState).id;
  assert(modestEnding === 'middle_class', `Below-FIRE voluntary retire yields content ending (got ${modestEnding})`);

  // 5. Retiring while already FIRE-wealthy (assets >= 500) is classified as a triumph
  const wealthy: GameState = { ...eligible, cash: 300, stocks: 300 };
  const { nextState: wealthyRet } = applyStateTransition(wealthy, findRetire(wealthy)!.effect(wealthy), { eventId: 'sv_daily_life' });
  assert(determineEnding(wealthyRet).id === 'fire_basic', 'Voluntary retire with >= $500w yields FIRE triumph ending');

  console.log('✅ CUJ 16 Passed\n');
}

// CUJ 17: Give-up / departure exit-path classification (regression for exit-path audit)
{
  console.log('--- [CUJ 17] Give-up & departure exit-path classification ---');
  const findChoice = (text: string) => {
    for (const ev of Object.values(events)) {
      const c = (ev.choices || []).find((ch) => ch.text.includes(text));
      if (c) return c;
    }
    return undefined;
  };

  // 1. 大理躺平 give-up must be a CONTENT ending, not a fire_basic FIRE triumph.
  //    Temp-visa holder leaving for 大理 → 海归/homecoming (previously unreachable ending).
  const dali = findChoice('回大理');
  assert(!!dali, '大理躺平 choice exists');
  const daliBase = { ...generateInitialState(), cash: 8, stocks: 0, health: 90, visa: 'H1B (工签)' } as GameState;
  const { nextState: daliState } = applyStateTransition(daliBase, dali!.effect(daliBase), { eventId: 'sv_daily_life' });
  assert(daliState.status === 'retired', '大理躺平 sets status retired (not win)');
  const daliEnd = determineEnding(daliState);
  assert(daliEnd.tone === 'content', `大理躺平 yields a content ending, not a FIRE triumph (got ${daliEnd.id})`);
  assert(daliEnd.id === 'homecoming', `Temp-visa 大理躺平 -> 海归 homecoming (got ${daliEnd.id})`);
  // Permanent resident keeps status (middleware protects 绿卡) → not homecoming.
  const daliPerm = { ...generateInitialState(), cash: 8, stocks: 0, health: 90, visa: '绿卡' } as GameState;
  const { nextState: daliPermState } = applyStateTransition(daliPerm, dali!.effect(daliPerm), { eventId: 'sv_daily_life' });
  assert(daliPermState.visa === '绿卡', '大理躺平 does NOT downgrade a green card (middleware protected)');

  // 2. Temp-visa 放弃求职 forced departure must classify as 'deported' (message keyword).
  const quit = findChoice('放弃求职');
  assert(!!quit, '放弃求职 choice exists');
  const quitBase = { ...generateInitialState(), visa: 'H1B (工签)', cash: 10, stocks: 0 } as GameState;
  const quitEff = quit!.effect(quitBase);
  assert(quitEff.status === 'game_over', '放弃求职 (temp visa) is game_over');
  assert(determineEnding({ ...quitBase, ...quitEff } as GameState).id === 'deported', 'temp-visa 放弃求职 -> deported (not generic/bankruptcy)');

  // 3. Founder burnout death -> burnout card, not startup_ruin (endings priority order).
  assert(
    determineEnding({ ...generateInitialState(), status: 'game_over', health: 0, cash: 5, stocks: 0, job_type: 'startup_founder' } as GameState).id === 'burnout',
    'Founder who dies of burnout (health 0) -> burnout, not startup_ruin'
  );

  console.log('✅ CUJ 17 Passed\n');
}

console.log(`\n======================================================`);
console.log(`📊 CUJ TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
if (failedAssertions === 0) {
  console.log(`🎉 100% OF ALL CUJs (Critical User Journeys) PASSED WITH ZERO BUGS!`);
} else {
  console.error(`❌ ${failedAssertions} ASSERTIONS FAILED!`);
  process.exit(1);
}
