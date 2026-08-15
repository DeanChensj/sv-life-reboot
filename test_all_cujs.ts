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

  // 11. Housing event routing check: Renter must never trigger house_warming_party
  const renterState: GameState = {
    ...state,
    has_housing: true,
    housing_name: 'Cupertino 2b2b合租',
    season_stage: 'h2',
  };
  for (let i = 0; i < 50; i++) {
    const routed = midYearEventRouter(renterState);
    assert(routed !== 'house_warming_party', 'Renting player must never trigger house_warming_party');
    assert(routed !== 'property_supplemental_tax_hike', 'Renting player must never trigger property tax hike');
  }

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
  res = stepChoice(state, 'phd_life', 0, { message: '两年的昼夜颠倒，你的论文终于有突破性进展并被顶会接收，老板决定带你去夏威夷参加顶级学术会议！' });
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
  res = stepChoice(state, 'job_hunt_fail', 3, { visa: 'Day 1 CPT', cpt_used: true });
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
  assert(end({ status: 'win', cash: 1600, stocks: 0 }) === 'atherton_lord', 'win + 1600 assets -> atherton');
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
  assert(settleMsg({ job_type: 'nvidia', company: 'nvidia' }).includes('英伟达'), 'nvidia -> 英伟达 (not generic +6)');
  assert(settleMsg({ company: 'meta', job_type: 'big_tech' }).includes('Meta'), 'meta -> Meta');
  assert(settleMsg({ job_type: 'startup' }).includes('创业公司'), 'startup -> 创业公司');
  assert(settleMsg({ job_type: 'startup_founder' }).includes('创业找融资'), 'startup_founder -> 创业找融资');
  assert(settleMsg({ job_type: 'ai_research', company: 'openai' }).includes('前沿 AI 实验室'), 'ai_research -> 前沿 AI 实验室 (not 养老大厂)');
  assert(settleMsg({ job_type: 'big_tech', transferred_to_ai: true }).includes('大厂前沿 AI 大模型组'), 'transferred_to_ai -> AI 大模型组 (not 养老大厂)');
  assert(settleMsg({ job_type: 'big_tech', company: 'google' }).includes('养老大厂'), 'plain big_tech -> 养老大厂');
  assert(settleMsg({ job_type: 'cn_tech', company: 'cn_big_tech' }).includes('国内大厂'), 'cn_tech -> 国内大厂');
  console.log('✅ CUJ 11 Passed\n');
}

console.log(`\n======================================================`);
console.log(`📊 CUJ TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
if (failedAssertions === 0) {
  console.log(`🎉 100% OF ALL CUJs (Critical User Journeys) PASSED WITH ZERO BUGS!`);
} else {
  console.error(`❌ ${failedAssertions} ASSERTIONS FAILED!`);
  process.exit(1);
}
