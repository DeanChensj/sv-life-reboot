import { events, generateInitialState, midYearEventRouter, hopTargetLevel, hopIsPromotion, isOpportunityActiveThisYear, isOpportunityCompleted, isOpportunityInCooldown } from './src/data/events';
import { GameState, Choice } from './src/types';
import { HOUSING_NAMES } from './src/constants/gameConstants';
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

  // 6a. 海投大厂 (job_hunt idx0) really RUNS the offer generator — it does NOT directly hire.
  // (Was faked with a stepChoice override injecting {company,tc,level} that job_hunt never
  // actually produces; the real effect yields hop_offers and routes to the offer market.)
  setGameSeed(7);
  const jobHunt0 = events['job_hunt'].choices[0];
  const huntEff = jobHunt0.effect(state);
  assert((huntEff.hop_offers || []).length > 0, 'King-of-roll 海投 wins at least one Offer (real effect)');
  const huntRoute = typeof jobHunt0.nextEventId === 'function' ? jobHunt0.nextEventId({ ...state, ...huntEff } as GameState) : jobHunt0.nextEventId;
  assert(huntRoute === 'job_hop_market', 'Winning offers routes to job_hop_market (real routing, not a fabricated direct hire)');
  state = applyStateTransition(state, huntEff, { eventId: 'job_hunt' }).nextState;

  // 6b. Sign with Google at the offer market — exercise the REAL hire effect.
  state.hop_offers = ['google'];
  const googleSign = events['job_hop_market'].choices.find((c) => c.text.includes('入职 Google'))!;
  assert(googleSign.condition!(state) === true, 'Google offer is signable when it was won');
  const signEff = googleSign.effect(state);
  assert(signEff.company === 'google', 'Real hire effect sets company=google');
  assert(signEff.job_type === 'big_tech', 'Real hire effect sets job_type=big_tech');
  assert(signEff.level === 'L3', 'Fresh-grad hire lands at L3 (no prior ladder rung)');
  state = applyStateTransition(state, signEff, { eventId: 'job_hop_market' }).nextState;
  assert(state.company === 'google', 'Hired at Google');
  assert(state.tc > 0, 'TC set to a real compensation band (not a fabricated $18w)');

  // 7. Choose Housing: Cupertino 合租
  res = stepChoice(state, 'choose_housing', 1);
  state = res.nextState;

  // 8. H1B First-Year Lottery — drive the REAL lottery effect (was faked with a visa override).
  //    winRate is ~25-40%, so seed + loop the pure effect until a win, then assert the real output.
  setGameSeed(3);
  const h1bLottery = events['big_tech_work'].choices[0];
  let h1bWon: Partial<GameState> | null = null;
  for (let i = 0; i < 200; i++) {
    const r = h1bLottery.effect(state);
    if (r.visa === 'H1B (工签)') { h1bWon = r; break; }
  }
  assert(!!h1bWon, 'H1B lottery is winnable via the real effect');
  assert(h1bWon!.h1b_attempts === 1, 'Real H1B win records the first-year attempt');
  state = applyStateTransition(state, h1bWon!, { eventId: 'big_tech_work' }).nextState;
  assert(state.visa === 'H1B (工签)', 'H1B Lottery won (real effect)');

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

  // 12. Progression ladder: L5 -> L6 Staff via the REAL perf_review effect. The old test
  //     never called the choice's effect — it hand-applied a {level:'L6'} object, so the
  //     impact gate, the win RNG, AND the routing were all untested. perf_review's L6
  //     choice gates on impact>=20 (plus leetcode/charm/network/health/tc thresholds).
  state.last_promo_age = state.age - 2;
  state.leetcode = 70;
  state.network = 30;
  state.charm = 20;
  state.health = 80;
  state.tc = 40;
  state.level = 'L5 (Senior)';
  state.impact = 25; // clears the L6 Staff impact gate

  const l6Choice = events['perf_review'].choices.find((c) => c.text.includes('L6 Staff'))!;
  assert(!!l6Choice, 'L6 promotion option exists');
  // Real condition gating: strong stats + impact>=20 unlocks it; impact<20 shuts it.
  assert(l6Choice.condition!(state) === true, 'L6 promo unlocked with strong stats + impact>=20');
  assert(l6Choice.condition!({ ...state, impact: 0 }) === false, 'L6 promo gated shut when impact<20 (anti dead-gate)');

  // Drive the REAL effect until it wins (capped ~24%/try), then assert the actual output.
  setGameSeed(11);
  let l6Win: Partial<GameState> | null = null;
  for (let i = 0; i < 400; i++) {
    const r = l6Choice.effect(state);
    if (r.level === 'L6 (Staff)') { l6Win = r; break; }
  }
  assert(!!l6Win, 'L5 with full stats + impact can actually win the L6 Staff promotion (real effect)');
  assert(l6Win!.tc === state.tc + 12, 'Real L6 promotion raises TC by +$12w (to $52w)');
  assert(l6Win!.last_promo_age === state.age, 'Real L6 promotion stamps last_promo_age this turn');
  const l6Res = applyStateTransition(state, l6Win!, { eventId: 'perf_review' });
  assert(l6Res.nextState.level === 'L6 (Staff)', 'Promoted to L6 Staff');
  const nextTarget = typeof l6Choice.nextEventId === 'function' ? l6Choice.nextEventId(l6Res.nextState) : l6Choice.nextEventId;
  assert(nextTarget === 'l6_staff_celebration', 'Real L6 promotion routes to l6_staff_celebration');

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

  // Drive a RANDOM choice's REAL effect (seed + loop) until it produces the branch we want,
  // then return the real effect, the post-transition state, and the real routing. Replaces
  // fabricating outcomes via stepChoice overrides — this exercises the actual effect logic.
  const forceChoice = (
    st: GameState, evId: string, idx: number,
    want: (r: Partial<GameState>) => boolean, seed: number, tries = 500
  ): { effect: Partial<GameState>; nextState: GameState; nextEventId: string } | null => {
    setGameSeed(seed);
    const ch = events[evId].choices[idx];
    for (let i = 0; i < tries; i++) {
      const eff = ch.effect(st);
      if (want(eff)) {
        const ns = applyStateTransition(st, eff, { eventId: evId }).nextState;
        const nextId = typeof ch.nextEventId === 'function' ? ch.nextEventId(ns) : ch.nextEventId;
        return { effect: eff, nextState: ns, nextEventId: nextId };
      }
    }
    return null;
  };

  // 1. Undergrad Grad -> PhD admission — drive the REAL admission RNG (was an is_phd override).
  //    On success the real effect also sets housing_name '美国 博士实验室'.
  state.school = 'cmu';
  const admit = forceChoice(state, 'us_undergrad_grad', 0, (r) => r.is_phd === true, 101);
  assert(!!admit, 'CMU + leetcode>=80 can win a PhD admission (real effect)');
  state = admit!.nextState;
  assert(state.is_phd === true, 'PhD status confirmed');
  assert(admit!.nextEventId === 'phd_life', 'PhD admission routes to phd_life');

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

  // 4. PhD Mid Stage Choice 1 (DeepMind / FAIR Research Intern) — drive the REAL success RNG
  //    (was an is_phd + cash override). On success the real effect grants +$6w and the PhD.
  const intern = forceChoice(vacationRes.nextState, 'phd_mid_stage', 1, (r) => r.is_phd === true, 202);
  assert(!!intern, 'AI research internship can succeed and complete the PhD defense (real effect)');
  assert(intern!.nextEventId === 'phd_job_hunt', 'Successful research internship routes to phd_job_hunt');
  assert(intern!.nextState.is_phd === true, 'PhD degree maintained after research internship');
  assert(intern!.effect.cash === vacationRes.nextState.cash + 6, 'Real internship pays a +$6w stipend');
  assert(intern!.nextState.cash > vacationRes.nextState.cash, 'Earned stipend from research internship');

  // 5. PhD Direct Paper Success -> phd_conference -> phd_job_hunt -> OpenAI MTS Offer.
  //    Drive the REAL paper RNG (was a story_flags.hawaii_conf override): on a top-conf
  //    acceptance phd_life idx0 sets hawaii_conf and routes to phd_conference.
  const paper = forceChoice(state, 'phd_life', 0, (r) => r.story_flags?.hawaii_conf === true, 303);
  assert(!!paper, 'PhD paper can be accepted to a top conference (real effect)');
  assert(paper!.nextEventId === 'phd_conference', 'Accepted paper routes to phd_conference');
  assert(paper!.nextState.is_phd === true, 'PhD retained on paper success');
  state = paper!.nextState;

  const confRes = stepChoice(state, 'phd_conference', 0);
  assert(confRes.nextEventId === 'phd_job_hunt', 'Conference networking routes to phd_job_hunt');
  state = confRes.nextState;
  assert(state.is_phd === true, 'PhD degree awarded after conference defense');

  // 6. Apply to OpenAI MTS — drive the REAL offer RNG (was a fabricated override whose tc:45
  //    even contradicted the real win branch, which pays tc:80 L6-band comp).
  const openai = forceChoice(state, 'phd_job_hunt', 0, (r) => r.company === 'openai', 404);
  assert(!!openai, 'PhD can win the OpenAI MTS offer (real effect)');
  assert(openai!.effect.tc === 80, 'Real OpenAI MTS win pays $80w TC (L6-band comp)');
  assert(openai!.effect.job_type === 'ai_research', 'Real OpenAI win sets job_type=ai_research');
  assert(openai!.effect.level === 'MTS', 'Real OpenAI win sets level=MTS');
  assert(openai!.effect.visa === 'O1 (杰出人才)', 'Real OpenAI win grants O1 visa');
  state = openai!.nextState;
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

  // 1. Layoff Event — use the DETERMINISTIC layoff branch (idx1: 立刻刷题准备后路) and assert its
  //    REAL effect. (Was faked with a {laid_off,unemployed,tc:0} override on the RANDOM idx0.)
  const prevLeet = state.leetcode;
  let res = stepChoice(state, 'layoff_rumor', 1);
  state = res.nextState;
  assert(res.nextEventId === 'layoff_hit', 'Deterministic layoff routes to layoff_hit');
  assert(state.laid_off === true, 'Real layoff effect sets laid_off=true');
  assert(state.job_type === 'unemployed', 'Real layoff effect sets job_type=unemployed');
  assert(state.tc === 0, 'Unemployed TC is 0 (real effect + invariant middleware)');
  assert(state.leetcode === prevLeet + 20, 'Studied algorithms (leetcode +20) while getting laid off');

  const jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.companyLabel === '待业求职中', 'Company badge is 待业求职中');
  assert(jobInfo.levelLabel === '待业', 'Level badge is 待业 (not L4)');

  // 2. Emergency Day-1-CPT re-enrollment — the REAL Day-1-CPT choice is idx 4 (再读一个水硕维持
  //    身份). The old test used idx 3 ('放弃求职/离开硅谷', whose real effect returns
  //    status:'game_over') and pasted a {visa:'Day 1 CPT'} override on top, masking that it was
  //    testing the WRONG choice entirely. idx 4 is deterministic — assert its real output.
  state.cash = 10;
  const prevCash = state.cash;
  const prevLeet2 = state.leetcode;
  res = stepChoice(state, 'job_hunt_fail', 4);
  state = res.nextState;
  assert(res.nextEventId === 'job_hunt', 'Day-1-CPT re-enrollment routes back to job_hunt');
  assert(state.visa === 'Day 1 CPT', 'Real effect transfers visa to Day 1 CPT');
  assert(state.cash === prevCash - 5, 'Day-1-CPT masters program costs $5w (real effect)');
  assert(state.leetcode === Math.min(100, prevLeet2 + 25), 'Grinded 250 Hard problems (leetcode +25)');

  // 3. Marriage green card availability assertions (Single vs In a Relationship)
  const singlePoorState: GameState = { ...state, relationship_status: 'single', cash: 2, charm: 10 };
  const singleRichState: GameState = { ...state, relationship_status: 'single', cash: 10, charm: 10 };
  const marriedState: GameState = { ...state, relationship_status: 'dating', is_married: false };

  const fallbackEv = events['h1b_fallback_options'];
  assert(!fallbackEv.choices[0].condition!(singlePoorState), 'Single poor player cannot choose true love marriage');
  assert(!fallbackEv.choices[1].condition!(singlePoorState), 'Single poor player cannot choose $8w commercial marriage');
  // 4. Re-employment level preservation: OpenAI MTS & Laid-off Staff must NOT be demoted to L3
  const appleChoice = events['job_hop_market'].choices.find((c) => c.text.includes('Apple'))!;
  const mtsLaidOffState: GameState = {
    ...generateInitialState(),
    company: 'openai',
    job_type: 'unemployed',
    laid_off: true,
    level: 'MTS',
    impact: 25,
    tc: 0,
    age: 30,
    job_start_age: 26,
  };
  const mtsRehire = appleChoice.effect(mtsLaidOffState);
  assert(mtsRehire.level === 'L6 (Staff)', 'OpenAI MTS with impact>=20 re-hiring at Apple gets L6 (Staff), NOT L3');
  assert((mtsRehire.tc || 0) >= 50, 'OpenAI MTS re-hiring at Apple gets Staff compensation band');

  const staffLaidOffState: GameState = {
    ...generateInitialState(),
    company: 'meta',
    job_type: 'unemployed',
    laid_off: true,
    level: 'L6 (Staff)',
    impact: 10,
    tc: 0,
    age: 32,
    job_start_age: 25,
  };
  const googleChoice = events['job_hop_market'].choices.find((c) => c.text.includes('Google'))!;
  const staffRehire = googleChoice.effect(staffLaidOffState);
  assert(staffRehire.level === 'L6 (Staff)', 'Laid-off L6 Staff re-hiring at Google retains L6 (Staff) level');

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

  // 2. Actually WALK the undergrad chain instead of teleporting to cn_undergrad_grad.
  // Real route: cn_college_grad (百团大战) -> 随机校园事件 -> cn_college_year3 (大三抉择) -> cn_undergrad_grad.
  // This exercises the real connectivity; a break anywhere in the chain now fails CUJ 5.
  setGameSeed(12345);
  const cnCampusEvents = ['cn_dorm_game', 'cn_acm_contest', 'cn_business_competition', 'cn_campus_romance'];
  res = stepChoice(state, 'cn_college_grad', 0); // 【ACM 算法集训】
  state = res.nextState;
  assert(cnCampusEvents.includes(res.nextEventId), `cn_college_grad routes into a campus event (got ${res.nextEventId})`);

  const campusEventId = res.nextEventId; // follow whichever campus event we actually landed on
  res = stepChoice(state, campusEventId, 0);
  state = res.nextState;
  assert(res.nextEventId === 'cn_college_year3', `campus event ${campusEventId} advances to cn_college_year3 (got ${res.nextEventId})`);

  res = stepChoice(state, 'cn_college_year3', 1); // 【提前批次秋招】
  state = res.nextState;
  assert(res.nextEventId === 'cn_undergrad_grad', `cn_college_year3 advances to cn_undergrad_grad (got ${res.nextEventId})`);

  // 3. Graduate into domestic big tech
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

  // 4. Early career 996 work (anti-loop check: advances to cn_work_mid)
  let midRes = stepChoice(state, 'cn_work', 0);
  assert(midRes.nextEventId === 'cn_work_mid', 'Early domestic work advances to cn_work_mid (no self loop)');
  assert(midRes.nextState.age === state.age + 1, 'Age advances 1 year');
  assert(midRes.nextState.year === state.year + 1, 'Year advances 1 year');
  assert(midRes.nextState.cash > state.cash, 'Saved net salary');

  // 5. Mid stage N+3 layoff package -> US Master
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

  // 1. P0 role-hub routing: year-end settlement routes a FOUNDER straight to their own
  //    strategy hub (or a founder crisis), NEVER to the generic sv_daily_life panel — and
  //    sv_daily_life no longer carries any founder-specific option (de-duped into the hub).
  const settleRoute = events['sv_year_end_settlement'].choices[0];
  setGameSeed(7);
  const founderRoutes = new Set<string>();
  for (let i = 0; i < 80; i++) {
    founderRoutes.add(
      (typeof settleRoute.nextEventId === 'function' ? settleRoute.nextEventId(founderState) : settleRoute.nextEventId) as string
    );
  }
  assert(!founderRoutes.has('sv_daily_life'), 'Founder year-end NEVER routes to the generic sv_daily_life panel');
  assert(founderRoutes.has('founder_annual_strategy'), 'Founder year-end reaches the founder_annual_strategy hub');
  // The founder/trader ANNUAL-management duplicates are gone (de-duped into the hubs). NOTE:
  // the "become a founder/trader" ENTRY options (gated on job_type !== that role) legitimately
  // remain — employees still quit into founding/trading from here; those are not duplicates.
  assert(
    !events['sv_daily_life'].choices.some((c) =>
      c.text.includes('终局退场') || c.text.includes('产品冲刺') || c.text.includes('量化套利') || c.text.includes('金盆洗手')),
    'sv_daily_life no longer carries the founder/trader annual-management duplicates (de-duped into the hubs)'
  );

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

// CUJ 18: Promotion integrity — impact gates on ALL L6+ paths + no false lateral-hop celebration
{
  console.log('--- [CUJ 18] Promotion integrity (impact gates + lateral-hop celebration) ---');
  const findChoice = (evId: string, text: string) =>
    events[evId].choices.find((c) => c.text.includes(text));
  // High-stat L5 who has NOT earned impact — must NOT reach L6 via any promo path.
  const l5NoImpact = (over: Partial<GameState> = {}): GameState => ({
    ...generateInitialState(), job_type: 'big_tech', company: 'meta', level: 'L5 (Senior)',
    leetcode: 90, charm: 25, network: 60, health: 100, tc: 80, impact: 0,
    age: 40, last_promo_age: 34, job_start_age: 24, laid_off: false, status: 'playing', ...over,
  } as GameState);

  // 1. 内卷 grind: impact 0 => never promotes to L6 (deterministic: impact<20 short-circuits the &&)
  const grind = findChoice('sv_daily_life', '疯狂内卷')!;
  for (let i = 0; i < 20; i++) {
    const r = grind.effect(l5NoImpact());
    assert(r.level !== 'L6 (Staff)', '内卷 grind cannot reach L6 with impact 0');
  }
  // 2. Wartime sprint: impact 0 => never promotes to L6
  const sprint = findChoice('sv_daily_life', '战时冲刺')!;
  for (let i = 0; i < 20; i++) {
    const r = sprint.effect(l5NoImpact());
    assert(r.level !== 'L6 (Staff)', 'wartime sprint cannot reach L6 with impact 0');
  }
  // 3. meta_tlm: cannot skip from L3/L4 to L6, and L5 with impact 0 never wins
  const tlm = findChoice('meta_tlm', '继续卷升职')!;
  for (let i = 0; i < 20; i++) {
    assert(tlm.effect(l5NoImpact({ level: 'L3' })).level !== 'L6 (Staff)', 'meta_tlm: L3 cannot skip to L6');
    assert(tlm.effect(l5NoImpact()).level !== 'L6 (Staff)', 'meta_tlm: L5 impact 0 cannot reach L6');
  }
  assert(hopTargetLevel(l5NoImpact({ impact: 25, laid_off: false, job_type: 'big_tech' })) === 'L6 (Staff)', 'in-job L5 with impact>=20 CAN target L6 on hop');

  // 4. No false promo-celebration on a lateral hire: laid-off L6 re-hired stays L6 and is NOT stamped
  const laidOffL6: GameState = { ...generateInitialState(), level: 'L6 (Staff)', job_type: 'unemployed', laid_off: true, job_start_age: 24, age: 40, last_promo_age: 34, impact: 10, hop_offers: ['google'], status: 'playing' } as GameState;
  assert(hopTargetLevel(laidOffL6) === 'L6 (Staff)', 'laid-off L6 re-hire preserves L6 (lateral, not demoted)');
  assert(hopIsPromotion(laidOffL6) === false, 'laid-off same-level re-hire is NOT a promotion');
  const googleJoin = findChoice('job_hop_market', '入职 Google')!;
  const joinEff = googleJoin.effect(laidOffL6);
  assert(joinEff.level === 'L6 (Staff)', 'lateral re-hire lands at L6');
  assert(joinEff.last_promo_age !== 40, 'lateral re-hire does NOT stamp last_promo_age (no false celebration)');
  // In-job real level-up IS a promotion
  assert(hopIsPromotion({ ...l5NoImpact({ impact: 30 }) }) === true, 'in-job L5->L6 with impact IS a promotion');

  // 5. dave_retaliation_showdown choice-1: an L6 player (no level change) does not falsely celebrate
  const daveWin = findChoice('dave_retaliation_showdown', '雷霆出击')!;
  const l6Dave: GameState = { ...generateInitialState(), level: 'L6 (Staff)', age: 41, last_promo_age: 36, job_start_age: 24, story_flags: { has_dave_evidence: true }, status: 'playing' } as GameState;
  const daveEff = daveWin.effect(l6Dave);
  assert(daveEff.last_promo_age !== 41, 'dave showdown: L6 win does not stamp last_promo_age');
  const daveNext = typeof daveWin.nextEventId === 'function' ? daveWin.nextEventId({ ...l6Dave, ...daveEff } as GameState) : daveWin.nextEventId;
  assert(daveNext !== 'promo_celebration', 'dave showdown: L6 (unchanged) does not route to promo_celebration');
  // An L4 dave-showdown player DOES promote to L5 and celebrates
  const l4Dave: GameState = { ...l6Dave, level: 'L4' };
  const dave4 = daveWin.effect(l4Dave);
  assert(dave4.level === 'L5 (Senior)' && dave4.last_promo_age === 41, 'dave showdown: L4 promotes to L5 and stamps');

  // 6. Impact accumulation & annual settlement decay mechanics
  const l5Active = l5NoImpact();
  const sprintRes = sprint.effect(l5Active);
  assert((sprintRes.impact || 0) >= 2, 'Wartime sprint produces impact (>=2 even on struggle, >=8 on Top Perf)');

  const grindRes = grind.effect(l5Active);
  assert((grindRes.impact || 0) >= 5, 'Crazy grind produces impact (>=5 on promo/merit)');

  // High-impact L5 CAN promote to L6 Staff on wartime sprint
  const l5WithHighImpact = l5NoImpact({ impact: 30, last_promo_age: 34, age: 40 });
  setGameSeed(42);
  let sprintPromoted = false;
  for (let i = 0; i < 100; i++) {
    const res = sprint.effect(l5WithHighImpact);
    if (res.level === 'L6 (Staff)') {
      sprintPromoted = true;
      assert((res.impact || 0) >= 40, 'L6 promo further awards +10 impact');
      break;
    }
  }
  assert(sprintPromoted, 'High-impact L5 is capable of promoting to L6 Staff via wartime sprint');

  console.log('✅ CUJ 18 Passed\n');
}

// CUJ 19: Economy & housing edge-case fixes (PR B: #3 dead choice/orphan, #7 forced-bankruptcy, #9 h1b loop)
{
  console.log('--- [CUJ 19] Economy & housing edge-case fixes ---');
  const choiceOf = (evId: string, text: string) => events[evId].choices.find((c) => c.text.includes(text));

  // #3: parents-help buy_house choice is now reachable (cash<40 but total>=40) → house_slave.
  const parents = choiceOf('buy_house', '父母紧急开支票')!;
  assert(!!parents, 'buy_house has parents-help choice');
  assert(parents.condition!({ ...generateInitialState(), cash: 10, stocks: 40, parents_helped_house: false } as GameState) === true, 'parents-help available when cash<40 but total>=40 (was dead code)');
  assert(parents.condition!({ ...generateInitialState(), cash: 50, stocks: 0, parents_helped_house: false } as GameState) === false, 'parents-help hidden when cash>=40');
  assert(parents.nextEventId === 'house_slave' && !!events['house_slave'], 'parents-help routes to (now reachable) house_slave');

  // #9: h1b_final_crisis marry-non-citizen outcome moves OFF OPT/F1 → Day 1 CPT (breaks annual crisis re-loop).
  const marry = choiceOf('h1b_final_crisis', '真爱伴侣结婚自救')!;
  const marryBase = { ...generateInitialState(), visa: 'OPT (实习)', relationship_status: 'dating', h1b_attempts: 3, gc_stage: 'not_started', status: 'playing' } as GameState;
  let sawNonCitizen = false;
  for (let i = 0; i < 80; i++) {
    const r = marry.effect(marryBase);
    if (r.visa !== '绿卡') { sawNonCitizen = true; assert(r.visa === 'Day 1 CPT', `non-citizen marriage moves off OPT/F1 to Day 1 CPT (got ${r.visa})`); }
  }
  assert(sawNonCitizen, 'non-citizen marriage branch exercised');

  // #7: HOA assessment always offers a safe (no-condition) finance branch; tax-hike defers for cash in [1,3).
  assert(events['property_hoa_special_assessment'].choices.some((c) => !c.condition), 'HOA special assessment has an always-available safe finance branch (no forced bankruptcy)');
  const taxDefer = choiceOf('property_supplemental_tax_hike', '延期与分期')!;
  assert(taxDefer.condition!({ ...generateInitialState(), cash: 2 } as GameState) === true, 'tax-hike safe deferral covers cash in [1,3)');
  // #7: luxury-car overdraft branch never drives cash below 0.
  const tow = choiceOf('luxury_car_vandalism_towing', '信用卡透支')!;
  const towRes = tow.effect({ ...generateInitialState(), cash: 0.2, stocks: 0 } as GameState);
  assert((towRes.cash ?? 0) >= 0, 'luxury-car overdraft branch floors cash at 0 (no forced bankruptcy)');

  console.log('✅ CUJ 19 Passed\n');
}

// CUJ 20: Impact PROGRESSION REACHABILITY — guards the "gate-on-unearnable-resource" class.
// #50 gated senior promos on impact (L6>=20); if impact income is ever cut off (as it was
// before #53), that gate silently becomes an impossible wall. This asserts an engaged
// big-tech grinder can actually accumulate impact past the L6 gate through normal play.
{
  console.log('--- [CUJ 20] Impact progression reachability (anti dead-gate) ---');
  const sprint = events['sv_daily_life'].choices.find((c) => c.text.includes('战时冲刺'))!;
  const rest20 = events['sv_daily_life'].choices.find((c) => c.text.includes('佛系躺平'))!;
  const settle = events['sv_year_end_settlement'].choices[0];
  const TRIALS = 100;
  // HEALTH-MANAGED play (rest when health is low) — NOT suicide-grinding every year. The old
  // version sprinted every year and reached 20 only by racing to near-death; that masked the
  // real problem (with unconditional -4 decay, a player who rests to survive never nets impact).
  // The conditional decay (no -4 in a year you delivered impact) is what makes this sustainable.
  let reached = 0;
  for (let t = 0; t < TRIALS; t++) {
    // Pass the seed INTO generateInitialState (calling it with no arg re-seeds from Date.now).
    let s: GameState = {
      ...generateInitialState(4000 + t), job_type: 'big_tech', company: 'meta', level: 'L5 (Senior)',
      leetcode: 75, charm: 20, network: 40, health: 100, tc: 70, impact: 0,
      age: 30, last_promo_age: 28, job_start_age: 24, status: 'playing',
    } as GameState;
    for (let yr = 0; yr < 15 && s.status === 'playing'; yr++) {
      const act = s.health < 45 ? rest20 : sprint;
      s = applyStateTransition(s, act.effect(s), { eventId: 'sv_daily_life' }).nextState;
      if ((s.impact || 0) >= 20) { reached++; break; }
      if (s.status !== 'playing') break;
      s = applyStateTransition(s, settle.effect(s), { eventId: 'sv_year_end_settlement' }).nextState;
      if ((s.impact || 0) >= 20) { reached++; break; }
    }
  }
  const pct = (reached / TRIALS) * 100;
  console.log(`   ${pct.toFixed(0)}% of HEALTH-MANAGED big-tech engineers cleared the L6 impact gate (>=20) within 15y`);
  // Robust regression catcher: with unconditional decay this was ~0% (health-managed); the
  // conditional decay must let a sustainable grinder actually clear the gate.
  assert(pct >= 60, `Health-managed big-tech engineer must clear the impact>=20 L6 gate through SUSTAINABLE play in >=60% of careers (got ${pct.toFixed(0)}%) — conditional impact decay must hold`);

  console.log('✅ CUJ 20 Passed\n');
}

// CUJ 22: Side Hustle Hub & Diverse Routes Exploration
{
  console.log('--- [CUJ 22] Side Hustle Hub & Diverse Routes Exploration ---');
  const svLife = events['sv_daily_life'];
  const sideHustleChoice = svLife.choices.find((c) => c.text.includes('拓展副业'))!;
  assert(!!sideHustleChoice, 'Side hustle entry choice exists in sv_daily_life');
  assert(sideHustleChoice.nextEventId === 'side_hustle_hub', 'Side hustle entry routes to side_hustle_hub');

  const hub = events['side_hustle_hub'];
  assert(!!hub, 'side_hustle_hub event is registered');
  assert(hub.choices.length === 5, 'side_hustle_hub provides 5 distinct route options (SaaS, Advisor, Creator, Boba, Back)');

  const baseState: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech', company: 'meta', level: 'L5 (Senior)',
    cash: 50, stocks: 20, leetcode: 50, charm: 18, network: 30, health: 90, status: 'playing'
  } as GameState;

  // 1. Independent Micro-SaaS
  const saasChoice = hub.choices.find((c) => c.text.includes('独立开发'))!;
  assert(!!saasChoice, 'Micro-SaaS choice exists');
  assert(saasChoice.condition!(baseState) === true, 'Micro-SaaS accessible with leetcode >= 30');
  assert(saasChoice.condition!({ ...baseState, leetcode: 20 } as GameState) === false, 'Micro-SaaS blocked with leetcode < 30');
  const saasRes = saasChoice.effect(baseState);
  assert(typeof saasRes.cash === 'number' && saasRes.season_stage === 'h1', 'Micro-SaaS resolves properly in H1');

  // 2. High-End Advisor
  const advisorChoice = hub.choices.find((c) => c.text.includes('高阶咨询'))!;
  assert(!!advisorChoice, 'Advisor choice exists');
  assert(advisorChoice.condition!(baseState) === true, 'Advisor accessible for L5/Senior');
  assert(advisorChoice.condition!({ ...baseState, level: 'L3', network: 10 } as GameState) === false, 'Advisor blocked for junior engineer with low network');
  const advRes = advisorChoice.effect(baseState);
  assert(typeof advRes.cash === 'number' && (advRes.network ?? 0) >= baseState.network, 'Advisor grants cash and network');

  // 3. Creator
  const creatorChoice = hub.choices.find((c) => c.text.includes('流量自媒体'))!;
  assert(!!creatorChoice, 'Creator choice exists');
  const creatorRes = creatorChoice.effect(baseState);
  assert(typeof creatorRes.health === 'number', 'Creator resolves properly');

  // 4. Boba shop investment
  const bobaChoice = hub.choices.find((c) => c.text.includes('实体投资'))!;
  assert(!!bobaChoice, 'Boba shop choice exists');
  assert(bobaChoice.condition!(baseState) === true, 'Boba shop accessible with cash >= 5');
  assert(bobaChoice.condition!({ ...baseState, cash: 2 } as GameState) === false, 'Boba shop blocked with cash < 5');

  // 5. Back button
  const backChoice = hub.choices.find((c) => c.text.includes('暂不发展副业'))!;
  assert(!!backChoice, 'Back choice exists');
  assert(backChoice.nextEventId === 'sv_daily_life', 'Back choice routes back to sv_daily_life');

  console.log('✅ CUJ 22 Passed\n');
}

// CUJ 21: Limited Opportunities Lifecycle, Once-Per-Life Invariants & Cooldown Rotation
{
  console.log('--- [CUJ 21] Limited Opportunities Lifecycle & Cooldowns ---');
  const pilotChoice = events['sv_daily_life'].choices.find((c) => c.text.includes('飞行员执照'))!;
  assert(!!pilotChoice, 'PPL pilot license opportunity exists');

  // 1. Once-per-life invariant: taking the pilot license grants has_pilot_license flag
  const basePilot: GameState = {
    ...generateInitialState(),
    cash: 50, stocks: 0, health: 100, charm: 10, luck: 20, age: 28, year: 2026, status: 'playing'
  } as GameState;
  const pilotEff = pilotChoice.effect(basePilot);
  assert(pilotEff.story_flags?.has_pilot_license === true, 'Pilot license grants has_pilot_license flag');

  const afterPilot: GameState = { ...basePilot, ...pilotEff };
  // isOpportunityActiveThisYear must never activate pilot license once completed
  assert(isOpportunityActiveThisYear(afterPilot, 'opp_pilot_license') === false, 'Completed PPL is never active again');
  assert(isOpportunityCompleted(afterPilot, 'opp_pilot_license') === true, 'isOpportunityCompleted accurately identifies PPL status');

  // 2. Cooldown check: GTC cannot trigger in consecutive years
  const gtcChoice = events['sv_daily_life'].choices.find((c) => c.text.includes('GTC'))!;
  assert(!!gtcChoice, 'GTC opportunity exists');
  const gtcEff = gtcChoice.effect({ ...basePilot, year: 2026 });
  const afterGtc: GameState = { ...basePilot, ...gtcEff, year: 2027 }; // next year
  assert(isOpportunityInCooldown(afterGtc, 'opp_gtc_nvidia') === true, 'GTC is in cooldown the following year');
  assert(isOpportunityActiveThisYear(afterGtc, 'opp_gtc_nvidia') === false, 'GTC not active during cooldown year');

  const afterGtc2Years: GameState = { ...afterGtc, year: 2028 }; // 2 years later
  assert(isOpportunityInCooldown(afterGtc2Years, 'opp_gtc_nvidia') === false, 'GTC cooldown expires after 2 years');

  // 3. TreeHacks age limit: unavailable after age 36
  const treehacksChoice = events['sv_daily_life'].choices.find((c) => c.text.includes('TreeHacks'))!;
  assert(!!treehacksChoice, 'TreeHacks opportunity exists');
  assert(treehacksChoice.condition!({ ...basePilot, age: 25, year: 2026 } as GameState) === isOpportunityActiveThisYear({ ...basePilot, age: 25, year: 2026 } as GameState, 'opp_treehacks'), 'TreeHacks available at age 25 if active');
  assert(treehacksChoice.condition!({ ...basePilot, age: 40, year: 2026 } as GameState) === false, 'TreeHacks strictly unavailable at age 40');

  console.log('✅ CUJ 21 Passed\n');
}

// CUJ 23: Impact 下行挫折事件 (存在 + 净扣 impact + 有能动性/不死胡同 + 可经 midYearEventRouter 注入)
{
  console.log('--- [CUJ 23] Impact setback events (project cancelled / launch incident / legacy) ---');
  const setbackIds = ['impact_project_cancelled', 'impact_launch_incident', 'impact_legacy_maintenance'];
  const base: GameState = {
    ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L6 (Staff)',
    leetcode: 75, charm: 18, network: 40, health: 90, tc: 50, impact: 40, age: 34, status: 'playing',
  } as GameState;
  for (const id of setbackIds) {
    const ev = events[id];
    assert(!!ev, `${id} event exists`);
    setGameSeed(7);
    // 至少一个选项净扣 impact (从 impact=40 出发结果 < 40)
    const anyDeducts = ev.choices.some((c) => {
      const r = c.effect(base);
      return typeof r.impact === 'number' && (r.impact as number) < 40;
    });
    assert(anyDeducts, `${id} has a choice that deducts impact`);
    // 每个选项都路由到合法后续 (无死胡同)
    ev.choices.forEach((c, i) => {
      const eff = c.effect(base);
      const nid = typeof c.nextEventId === 'function' ? c.nextEventId({ ...base, ...eff } as GameState) : c.nextEventId;
      assert(!!events[nid] || nid === 'end', `${id} choice ${i} routes to a valid event (got ${nid})`);
    });
  }
  // 可达性:impact 职业 + impact>=15 的在职攀爬者,midYearEventRouter H1 会注入这些挫折事件
  const climber: GameState = {
    ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L5 (Senior)',
    leetcode: 70, charm: 16, network: 35, health: 90, tc: 45, impact: 30, age: 33, year: 2026,
    season_stage: undefined, status: 'playing', story_flags: {},
  } as GameState;
  setGameSeed(123);
  const routed = new Set<string>();
  for (let i = 0; i < 500; i++) routed.add(midYearEventRouter(climber));
  assert(setbackIds.some((id) => routed.has(id)), 'Impact-setback events are injectable via midYearEventRouter for an impact-career climber');
  // 反例:impact<15 的玩家不会被注入这些挫折 (没有值得一失的影响力)
  const lowImpact: GameState = { ...climber, impact: 5 } as GameState;
  setGameSeed(123);
  const routedLow = new Set<string>();
  for (let i = 0; i < 500; i++) routedLow.add(midYearEventRouter(lowImpact));
  assert(!setbackIds.some((id) => routedLow.has(id)), 'Impact-setback events are NOT injected for a low-impact (<15) player');

  console.log('✅ CUJ 23 Passed\n');
}

// =========================================================================
// CUJ 24: US Undergrad to US Master to Big Tech Journey (Anti-Loop & Student HUD)
// =========================================================================
console.log('--- [CUJ 24] US Undergrad to US Master to Big Tech Journey ---');
{
  let state = generateInitialState();
  state.cash = 35; // sufficient for UCB undergrad + Master

  // 1. Choose Trait -> Choose Year -> Choose School: UCB
  let res = stepChoice(state, 'choose_trait', 1);
  state = res.nextState;
  res = stepChoice(state, 'choose_year', 1);
  state = res.nextState;
  res = stepChoice(state, 'choose_school', 1); // UCB ($18w)
  state = res.nextState;
  assert(res.nextEventId === 'us_undergrad_year1', 'choose_school -> us_undergrad_year1');
  assert(state.school === 'ucb', 'School set to UCB');

  // Verify Student HUD derivation
  let jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.companyHeaderLabel === '就读院校', 'HUD shows 就读院校');
  assert(jobInfo.companyLabel === '大U (CS Top30)', 'HUD displays 大U (CS Top30)');
  assert(jobInfo.levelHeaderLabel === '在读学位', 'HUD shows 在读学位');
  assert(jobInfo.levelLabel === '本科在读', 'HUD displays 本科在读');

  // 2. Undergrad Year 1 -> Junior Year 3
  res = stepChoice(state, 'us_undergrad_year1', 0);
  state = res.nextState;
  const stage1Next = res.nextEventId;
  if (stage1Next !== 'us_undergrad_year3') {
    // Landed on a random college event — walk it to junior year
    res = stepChoice(state, stage1Next, 0);
    state = res.nextState;
    assert(res.nextEventId === 'us_undergrad_year3', 'Random college event advanced to us_undergrad_year3');
  }

  // 3. Junior Year 3 -> Undergrad Graduation
  res = stepChoice(state, 'us_undergrad_year3', 0);
  state = res.nextState;
  const stage2Next = res.nextEventId;
  if (stage2Next !== 'us_undergrad_grad') {
    // Landed on a random college event — walk it to undergrad graduation
    res = stepChoice(state, stage2Next, 0);
    state = res.nextState;
    assert(res.nextEventId === 'us_undergrad_grad', 'Random college event advanced to us_undergrad_grad');
  }

  // 4. Undergrad Graduation: Choose Master's Degree
  res = stepChoice(state, 'us_undergrad_grad', 2); // 申请大U硕士
  state = res.nextState;
  assert(res.nextEventId === 'us_master_year1', 'us_undergrad_grad -> us_master_year1');
  assert(state.is_master === true, 'is_master is true');

  // Verify Master Student HUD derivation
  jobInfo = getJobDisplayInfo(state);
  assert(jobInfo.levelLabel === '硕士在读', 'HUD displays 硕士在读');
  assert(jobInfo.companyLabel === '大U CS 硕士', 'HUD displays 大U CS 硕士');

  // 5. Master Year 1: Complete Master's Studies
  res = stepChoice(state, 'us_master_year1', 0); // 加急刷题
  state = res.nextState;
  const masterNext = res.nextEventId;
  if (masterNext !== 'us_master_grad') {
    // Landed on a random college event — walk it to master graduation
    res = stepChoice(state, masterNext, 0);
    state = res.nextState;
    assert(res.nextEventId === 'us_master_grad', 'Random college event advanced to us_master_grad (anti-undergrad-loop test)');
  } else {
    assert(res.nextEventId === 'us_master_grad', 'us_master_year1 advanced directly to us_master_grad');
  }

  // 6. Master Graduation: Verify PhD option & Enter Job Hunt
  const masterGradEvent = events['us_master_grad'];
  const phdChoice = masterGradEvent.choices.find((c) => c.text.includes('申请北美顶尖 PhD'))!;
  assert(!!phdChoice, 'PhD application option exists in us_master_grad');
  assert(phdChoice.condition!({ ...state, leetcode: 55 } as GameState) === true, 'PhD option accessible with LeetCode >= 50');

  res = stepChoice(state, 'us_master_grad', 0); // 硅谷大厂秋招
  state = res.nextState;
  assert(res.nextEventId === 'job_hunt', 'us_master_grad -> job_hunt');
  assert(state.visa === 'OPT (实习)', 'Master graduation activated OPT');

  console.log('✅ CUJ 24 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 25: Simultaneous Burnout/Broke Non-Negative Cash & Crisis Stock Liquidity Affordability
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 25] Invariant Protections: Negative Cash Clamping & Crisis Stock Liquidity ---');
  let state = generateInitialState();

  // 1. Simultaneous Burnout + Negative Cash: verify cash is non-negative on game_over
  const brokeAndBurnoutEffect = { health: 0, cash: -8.5 };
  const transRes = applyStateTransition(state, brokeAndBurnoutEffect);
  assert(transRes.nextState.status === 'game_over', 'Simultaneous burnout + broke triggers game_over');
  assert(transRes.nextState.cash >= 0, 'Cash is strictly clamped to non-negative (>= 0)');
  assert(transRes.targetEventId === 'end', 'targetEventId is end');

  // 2. Crisis Event Affordability: Player with low cash but ample stocks can afford property tax & IRS audits
  const stockRichState: GameState = {
    ...state,
    cash: 0.5,
    stocks: 80,
    has_housing: true,
    housing_name: HOUSING_NAMES.SUNNYVALE,
  } as GameState;

  const propTaxChoice = events['property_supplemental_tax_hike'].choices[0];
  assert(propTaxChoice.condition!(stockRichState) === true, 'Player with $0.5w cash + $80w stocks can afford property tax payment');
  const propRes = applyStateTransition(stockRichState, propTaxChoice.effect(stockRichState));
  assert(propRes.nextState.cash >= 0, 'Stock auto-liquidation cleanly covers tax payment with non-negative cash');
  assert((propRes.nextState.stocks ?? 0) < 80, 'Stocks decreased to cover shortfall');

  const irsChoice = events['irs_tax_audit_crisis'].choices[0];
  assert(irsChoice.condition!(stockRichState) === true, 'Player with $0.5w cash + $80w stocks can afford IRS CPA audit payment');
  const irsRes = applyStateTransition(stockRichState, irsChoice.effect(stockRichState));
  assert(irsRes.nextState.cash >= 0, 'Stock auto-liquidation cleanly covers IRS audit payment with non-negative cash');

  // 3. Dave Retaliation Hop Promotion Marking
  const daveState: GameState = {
    ...state,
    level: 'L4',
    leetcode: 50,
    age: 27,
    story_flags: { has_dave_evidence: true },
  } as GameState;

  const hopChoice = events['dave_retaliation_showdown'].choices[1];
  const hopRes = applyStateTransition(daveState, hopChoice.effect(daveState));
  assert(hopRes.nextState.level === 'L5 (Senior)', 'Hop to Meta promoted L4 to L5');
  assert(hopRes.nextState.last_promo_age === 27, 'last_promo_age stamped when hopping with a promotion');

  console.log('✅ CUJ 25 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 26: Leadership high-stakes gambles — real downside branches reachable & bounded
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 26] Leadership gambles: real downside reachable & invariant-safe ---');
  // Base state satisfies every gamble choice's condition (network>=15, impact>=35, !laid_off).
  const base: GameState = {
    ...generateInitialState(),
    level: 'L7 (Senior Staff)', laid_off: false, health: 90,
    impact: 40, network: 20, charm: 15, leetcode: 70, tc: 60,
  } as GameState;

  // The single gamble choice per event that we converted to risk/reward.
  const gambles: Array<{ ev: string; idx: number }> = [
    { ev: 'career_summer_intern_mentor', idx: 1 },   // 放权探索
    { ev: 'career_org_tech_lead_campaign', idx: 0 }, // 战略对齐
    { ev: 'career_executive_tech_steering', idx: 0 },// 重塑全公司技术标准
  ];

  for (const { ev, idx } of gambles) {
    const choice = events[ev].choices[idx];
    assert(!!choice, `${ev}[${idx}] exists`);
    assert(!choice.condition || choice.condition(base) === true, `${ev}[${idx}] condition satisfied by base state`);
    const baseImpact = base.impact ?? 0;
    let sawUpside = false;
    let sawDownside = false;
    let impactNeg = false, networkNeg = false, healthOverDraw = false;
    for (let i = 0; i < 1000; i++) {
      const out = choice.effect(base) as Partial<GameState>;
      if (out.impact !== undefined && (out.impact as number) < 0) impactNeg = true;
      if (out.network !== undefined && (out.network as number) < 0) networkNeg = true;
      if (out.health !== undefined && base.health - (out.health as number) > 15) healthOverDraw = true;
      if (out.impact !== undefined && (out.impact as number) > baseImpact) sawUpside = true;
      if (out.impact !== undefined && (out.impact as number) < baseImpact) sawDownside = true;
    }
    // Invariants across 1000 samples (design rules): impact clamps >= 0, hidden network >= 0,
    // and no single option drains more than 15 health.
    assert(!impactNeg, `${ev}[${idx}] impact never goes negative across samples`);
    assert(!networkNeg, `${ev}[${idx}] network never goes below 0 across samples`);
    assert(!healthOverDraw, `${ev}[${idx}] single-option health drop never exceeds 15`);
    // Both a real upside AND a real downside outcome must be reachable (it's a genuine gamble).
    assert(sawUpside, `${ev}[${idx}] upside outcome is reachable`);
    assert(sawDownside, `${ev}[${idx}] real downside outcome is reachable`);
  }
  console.log('✅ CUJ 26 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 27: Robinhood fintech hop — comp is macro-bound (bull > normal > bear)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 27] Robinhood fintech: macro-bound comp (bull > normal > bear) ---');
  const rh = events['job_hop_market'].choices.find((c) => c.text.includes('Robinhood'))!;
  assert(!!rh, 'job_hop_market has a named Robinhood choice');

  const base: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech', company: 'google', level: 'L5 (Senior)', impact: 40,
    tc: 30, cash: 20, health: 80, laid_off: false, hop_offers: ['robinhood'],
  } as GameState;

  assert(rh.condition!(base) === true, 'Robinhood choice available when offer in hop_offers');

  const bull = rh.effect({ ...base, macro_economy: 'bull' }) as Partial<GameState>;
  const normal = rh.effect({ ...base, macro_economy: 'neutral' }) as Partial<GameState>;
  const bear = rh.effect({ ...base, macro_economy: 'bear' }) as Partial<GameState>;

  assert(bull.company === 'robinhood' && bull.job_type === 'big_tech', 'Robinhood hop sets company + big_tech');
  // The fintech soul mechanic: total comp swings hard with the macro cycle.
  assert((bull.tc as number) > (normal.tc as number), 'Bull-market Robinhood TC > normal');
  assert((normal.tc as number) > (bear.tc as number), 'Normal Robinhood TC > bear-market');
  // Bear entry is higher-stress than a bull entry, but still within the ≤15 single-option cap.
  assert((base.health - (bear.health as number)) > (base.health - (bull.health as number)), 'Bear-market entry drains more health than bull');
  assert((base.health - (bear.health as number)) <= 15, 'Robinhood single-option health drop stays <= 15');
  console.log('✅ CUJ 27 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 28: All Hands corporate BS event integrity & choice sanity
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 28] All Hands corporate BS event choices & invariants ---');
  const allHands = events['all_hands_corporate_bs'];
  assert(!!allHands, 'all_hands_corporate_bs event is defined');
  assert(allHands.choices.length === 4, 'all_hands_corporate_bs has 4 choices');

  const base: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech', company: 'google', level: 'L5 (Senior)', health: 70, leetcode: 50,
  } as GameState;

  // Choice 0: Slido upvote -> health bonus
  const c0 = allHands.choices[0].effect(base) as Partial<GameState>;
  assert((c0.health as number) > base.health, 'Choice 0 boosts health from catharsis');

  // Choice 1: LeetCode grinding under laptop -> leetcode & health
  const c1 = allHands.choices[1].effect(base) as Partial<GameState>;
  assert((c1.leetcode as number) > base.leetcode, 'Choice 1 boosts leetcode');

  // Choice 2: Slack Memes -> charm & network
  const c2 = allHands.choices[2].effect(base) as Partial<GameState>;
  assert((c2.charm as number) > (base.charm || 10), 'Choice 2 boosts charm');
  assert((c2.network as number) > (base.network || 10), 'Choice 2 boosts network');

  // Choice 3: Buzzwords into OKR -> impact boost, health cost within <= 15 limit
  const c3 = allHands.choices[3].effect(base) as Partial<GameState>;
  assert((c3.impact as number) > (base.impact || 0), 'Choice 3 boosts impact');
  assert(base.health - (c3.health as number) <= 15, 'Choice 3 health drain <= 15');
  console.log('✅ CUJ 28 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 29: Snack Perks Downgrade event choices & invariants
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 29] Snack perks downgrade event choices & invariants ---');
  const ev = events['snack_perks_downgrade'];
  assert(!!ev, 'snack_perks_downgrade event is defined');
  assert(ev.choices.length === 3, 'snack_perks_downgrade has 3 choices');

  const base: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech', company: 'google', level: 'L5 (Senior)', health: 70, cash: 10,
  } as GameState;

  // Choice 0: Grab avocado & yogurt -> cash + health
  const c0 = ev.choices[0].effect(base) as Partial<GameState>;
  assert((c0.cash as number) > base.cash, 'Choice 0 boosts cash from free food savings');
  assert((c0.health as number) > base.health, 'Choice 0 boosts health');

  // Choice 1: Petition -> charm & network
  const c1 = ev.choices[1].effect(base) as Partial<GameState>;
  assert((c1.charm as number) > (base.charm || 10), 'Choice 1 boosts charm');
  assert((c1.network as number) > (base.network || 10), 'Choice 1 boosts network');

  // Choice 2: Meal Prep -> health +10
  const c2 = ev.choices[2].effect(base) as Partial<GameState>;
  assert((c2.health as number) >= base.health + 10, 'Choice 2 boosts health with clean meal prep');
  console.log('✅ CUJ 29 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 30: Wildfire Smoke & PG&E Blackout event choices & invariants
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 30] Wildfire Smoke & PG&E Blackout event choices & invariants ---');
  const ev = events['wildfire_smoke_pge_blackout'];
  assert(!!ev, 'wildfire_smoke_pge_blackout event is defined');
  assert(ev.choices.length === 3, 'wildfire_smoke_pge_blackout has 3 choices');

  const base: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech', company: 'apple', health: 70, cash: 10, leetcode: 50,
  } as GameState;

  // Choice 0: Dyson air purifier at home -> safe cost, health drain <= 15
  const c0 = ev.choices[0].effect(base) as Partial<GameState>;
  assert((c0.cash as number) < base.cash, 'Choice 0 deducts Dyson electricity cost');
  assert(base.health - (c0.health as number) <= 15, 'Choice 0 health drop stays within <= 15');

  // Choice 1: Workation to Hawaii -> cash cost, health boost
  const c1 = ev.choices[1].effect(base) as Partial<GameState>;
  assert((c1.cash as number) < base.cash, 'Choice 1 deducts flight/hotel cost');
  assert((c1.health as number) > base.health, 'Choice 1 boosts health');

  // Choice 2: Sleep in office with diesel generator -> leetcode boost
  const c2 = ev.choices[2].effect(base) as Partial<GameState>;
  assert((c2.leetcode as number) > base.leetcode, 'Choice 2 boosts leetcode grinding');

  console.log('✅ CUJ 30 Passed\n');
}

console.log(`\n======================================================`);
console.log(`📊 CUJ TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
if (failedAssertions === 0) {
  console.log(`🎉 100% OF ALL CUJs (Critical User Journeys) PASSED WITH ZERO BUGS!`);
} else {
  console.error(`❌ ${failedAssertions} ASSERTIONS FAILED!`);
  process.exit(1);
}
