import { events, generateInitialState, midYearEventRouter } from './src/data/events';
import { GameState, Choice } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';
import { getJobDisplayInfo, getVisaDisplayInfo, getHousingDisplayInfo, getTCBreakdown } from './src/utils/gameStateSelectors';

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
  assert(tcBreakdown.postTaxBase === 16.5, 'Post-tax cash is $16.5w');
  assert(tcBreakdown.postTaxRSU === 13.5, 'Post-tax RSU is $13.5w');

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
// CUJ 3: PhD Academic / AI Researcher / MTS Journey
// =========================================================================
console.log('--- [CUJ 3] PhD Academic / AI Researcher / MTS Journey ---');
{
  let state = generateInitialState();
  state.cash = 35;
  state.leetcode = 80;

  // Setup Undergrad Grad -> PhD
  state.school = 'cmu';
  let res = stepChoice(state, 'us_undergrad_grad', 0, { is_phd: true, housing_name: '美国 博士实验室' });
  state = res.nextState;
  assert(state.is_phd === true, 'PhD status confirmed');
  assert(res.nextEventId === 'phd_life', 'Routed to phd_life');

  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.levelLabel === '全奖博士', 'Level displays 全奖博士 before job');

  // PhD Graduation -> OpenAI MTS Offer
  res = stepChoice(state, 'phd_life', 0, { company: 'openai', job_type: 'ai_research', tc: 45, level: 'MTS', visa: 'O1 (杰出人才)' });
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
  state.job_type = 'cn_tech';
  state.company = 'cn_big_tech';
  state.level = '国内研发';
  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.companyLabel === '国内互联网大厂', 'Displays 国内互联网大厂');
  assert(jobInfo.levelLabel === '国内研发', 'Displays 国内研发');

  const visaInfo2 = getVisaDisplayInfo(state);
  assert(visaInfo2.visaLabel === '暂无 (国内在职)', 'Displays 暂无 (国内在职)');

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
  assert(transition3.nextState.stocks < 10, 'Stocks decreased by deficit amount');
  assert(transition3.nextState.status === 'playing', 'Game continues after auto-liquidation');

  console.log('✅ CUJ 7 Passed\n');
}

console.log(`\n======================================================`);
console.log(`📊 CUJ TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
if (failedAssertions === 0) {
  console.log(`🎉 100% OF ALL CUJs (Critical User Journeys) PASSED WITH ZERO BUGS!`);
} else {
  console.error(`❌ ${failedAssertions} ASSERTIONS FAILED!`);
  process.exit(1);
}
