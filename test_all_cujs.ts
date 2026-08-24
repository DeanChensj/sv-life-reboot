import { events, generateInitialState, hasSeen, markSeen, midYearEventRouter, resolveNextEventId, hopTargetLevel, hopIsPromotion, isOpportunityActiveThisYear, isOpportunityCompleted, isOpportunityInCooldown, calculatePhdAdmitProb } from './src/data/events';
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
  assert(state.win_threshold === 500, 'Citizen trait uses harmonized $500w FIRE baseline');
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

  // 2. Anti-Loop Verification: Choice 2 (Teaching Assistant TA) routes to phd_mid_stage (not looping back to phd_life)
  let taRes = stepChoice(state, 'phd_life', 2);
  assert(taRes.nextEventId === 'phd_mid_stage', 'PhD TA properly advances to phd_mid_stage (no infinite loop back to phd_life)');
  assert(taRes.nextState.age === state.age + 1, 'Age increments by 1 on TA year');
  assert(taRes.nextState.year === state.year + 1, 'Year increments by 1 on TA year');
  assert(taRes.nextState.cash === state.cash + 1.5, 'Stipend income added on TA year');
  assert(taRes.nextState.health === 100, 'Health restored on TA teaching year');

  // 3. PhD Mid Stage Choice 3 (Master Out) routes to job_hunt
  let midStageMasterOutRes = stepChoice(taRes.nextState, 'phd_mid_stage', 3);
  assert(midStageMasterOutRes.nextEventId === 'job_hunt', 'PhD Master Out routes to job_hunt');
  assert(midStageMasterOutRes.nextState.is_phd === false, 'PhD status revoked on master out');
  assert(midStageMasterOutRes.nextState.is_master === true, 'Player receives master degree on master out');

  // 4. PhD Mid Stage Choice 1 (DeepMind / FAIR Research Intern) — drive the REAL success RNG
  //    (was an is_phd + cash override). On success the real effect grants +$6w and the PhD.
  const intern = forceChoice(taRes.nextState, 'phd_mid_stage', 1, (r) => r.is_phd === true, 202);
  assert(!!intern, 'AI research internship can succeed and complete the PhD defense (real effect)');
  assert(intern!.nextEventId === 'phd_job_hunt', 'Successful research internship routes to phd_job_hunt');
  assert(intern!.nextState.is_phd === true, 'PhD degree maintained after research internship');
  assert(intern!.effect.cash === taRes.nextState.cash + 6, 'Real internship pays a +$6w stipend');
  assert(intern!.nextState.cash > taRes.nextState.cash, 'Earned stipend from research internship');
  assert((intern!.nextState.impact || 0) >= 15, 'AI research internship builds research impact (>=15)');

  // 5. PhD Direct Paper Success -> phd_conference -> phd_job_hunt -> OpenAI MTS Offer.
  //    Drive the REAL paper RNG (was a story_flags.hawaii_conf override): on a top-conf
  //    acceptance phd_life idx0 sets hawaii_conf and routes to phd_conference.
  const paper = forceChoice(state, 'phd_life', 0, (r) => r.story_flags?.hawaii_conf === true, 303);
  assert(!!paper, 'PhD paper can be accepted to a top conference (real effect)');
  assert(paper!.nextEventId === 'phd_conference', 'Accepted paper routes to phd_conference');
  assert(paper!.nextState.is_phd === true, 'PhD retained on paper success');
  assert((paper!.nextState.impact || 0) >= 15, 'Top conference paper awards impact (>=15)');
  state = paper!.nextState;

  const confRes = stepChoice(state, 'phd_conference', 0);
  assert(confRes.nextEventId === 'phd_job_hunt', 'Conference networking routes to phd_job_hunt');
  state = confRes.nextState;
  assert(state.is_phd === true, 'PhD degree awarded after conference defense');
  assert((state.impact || 0) >= 23, 'Conference networking elevates cumulative impact to >=23');

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
  assert((state.impact || 0) >= 33, 'Winning OpenAI MTS brings total cumulative impact to >=33');

  const jobInfo2 = getJobDisplayInfo(state);
  assert(jobInfo2.companyLabel === 'OpenAI', 'Company displays OpenAI');
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
  assert(res.nextEventId === 'sv_year_end_settlement', 'Day-1-CPT re-enrollment routes to year-end settlement');
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
  assert(visaInfo.visaLabel === '未赴美', 'Displays 未赴美');

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
  assert(visaInfo2.visaLabel === '国内在职', 'Displays 国内在职');

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

  // Raj L7 Board Rejection Guard:
  // Even if last_promo_age === age was already true from earlier this year,
  // failing the Raj board (level remains L6) MUST NEVER route to l7_senior_staff_celebration!
  const rajBoard = events['raj_director_promotion_board'];
  const rajAllyChoice = rajBoard.choices[0];
  const rajRoute = rajAllyChoice.nextEventId as (s: GameState) => string;
  const rajFailState: GameState = {
    ...generateInitialState(),
    level: 'L6 (Staff)',
    age: 35,
    last_promo_age: 35, // Simulate player promoted earlier in the same year or lateral hop
  };
  const rajFailDest = rajRoute(rajFailState);
  assert(rajFailDest !== 'l7_senior_staff_celebration', 'Raj board rejection MUST NOT route to l7_senior_staff_celebration even if last_promo_age === age');

  const rajWinState: GameState = {
    ...generateInitialState(),
    level: 'L7 (Senior Staff)',
    age: 35,
    last_promo_age: 35,
  };
  const rajWinDest = rajRoute(rajWinState);
  assert(rajWinDest === 'l7_senior_staff_celebration', 'Raj board win routes to l7_senior_staff_celebration');

  // 合并后的唯一晋升引擎【疯狂内卷】在卷厂(meta)享更高晋升赔率(原【大厂战时冲刺】已并入):
  // 满 2 年在职 + 算法达标 → 确定性快车道晋升 L3→L4,验证晋升与文案。
  const dailyLife = events['sv_daily_life'];
  const grindChoice = dailyLife.choices.find((c) => c.text.includes('疯狂内卷'))!;
  const metaStateL3: GameState = {
    ...generateInitialState(),
    company: 'meta', job_type: 'big_tech', level: 'L3',
    leetcode: 35, age: 24, last_promo_age: 22, tc: 22,
  };
  const grindRes = grindChoice.effect(metaStateL3);
  assert(grindRes.level === 'L4', `卷厂内卷满 2 年 + 算法达标应确定性晋升 L4 (got ${grindRes.level})`);
  assert(grindRes.last_promo_age === 24, '晋升必须打上 last_promo_age');
  assert(Boolean(grindRes.message?.includes('晋升') || grindRes.message?.includes('L4')), 'Promo message indicates promotion');
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

// CUJ 16: Voluntary early retirement (permanent visa + assets >= $150w/1.5M)
// Late-game agency: step off the treadmill before hitting the $500w FIRE bar.
// Gated on permanent status + wealth floor; below FIRE → content ending, above → triumph.
{
  console.log('--- [CUJ 16] Voluntary early retirement gate & ending ---');
  const findRetire = (s: GameState) =>
    events['sv_daily_life'].choices.find((c) => c.text.includes('提前上岸') && (!c.condition || c.condition(s)));

  // 1. Eligible: permanent visa (绿卡) + assets >= 150 → choice available
  const eligible: GameState = { ...generateInitialState(), visa: '绿卡', cash: 100, stocks: 50, health: 60, age: 42, status: 'playing' };
  const retireChoice = findRetire(eligible);
  assert(!!retireChoice, 'Voluntary retire choice available for permanent visa + assets >= $150w');

  // 2. Ineligible: temporary visa (can't just retire in the US on a work visa)
  assert(!findRetire({ ...eligible, visa: 'H1B (工签)' }), 'Voluntary retire NOT available on temporary H1B visa');
  // 3. Ineligible: below the $150w wealth floor
  assert(!findRetire({ ...eligible, cash: 80, stocks: 50 }), 'Voluntary retire NOT available below $150w assets');

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
  // 2. meta_tlm: cannot skip from L3/L4 to L6, and L5 with impact 0 never wins
  const tlm = findChoice('meta_tlm', '继续卷升职')!;
  for (let i = 0; i < 20; i++) {
    assert(tlm.effect(l5NoImpact({ level: 'L3' })).level !== 'L6 (Staff)', 'meta_tlm: L3 cannot skip to L6');
    assert(tlm.effect(l5NoImpact()).level !== 'L6 (Staff)', 'meta_tlm: L5 impact 0 cannot reach L6');
  }
  assert(hopTargetLevel(l5NoImpact({ impact: 25, laid_off: false, job_type: 'big_tech' })) === 'L6 (Staff)', 'in-job L5 with impact>=20 CAN target L6 on hop');

  // 4. No false promo-celebration on a lateral hire or fresh onboarding hire
  const laidOffL6: GameState = { ...generateInitialState(), level: 'L6 (Staff)', job_type: 'unemployed', laid_off: true, job_start_age: 24, age: 40, last_promo_age: 34, impact: 10, hop_offers: ['google'], status: 'playing' } as GameState;
  assert(hopTargetLevel(laidOffL6) === 'L6 (Staff)', 'laid-off L6 re-hire preserves L6 (lateral, not demoted)');
  assert(hopIsPromotion(laidOffL6) === false, 'laid-off same-level re-hire is NOT a promotion');
  const googleJoin = findChoice('job_hop_market', '入职 Google')!;
  const joinEff = googleJoin.effect(laidOffL6);
  assert(joinEff.level === 'L6 (Staff)', 'lateral re-hire lands at L6');
  assert(joinEff.last_promo_age !== 40, 'lateral re-hire does NOT stamp last_promo_age (no false celebration)');

  // Fresh grad joining at L3 is onboarding, NOT a promotion
  const freshGrad: GameState = { ...generateInitialState(), level: undefined, job_type: undefined, age: 24, hop_offers: ['google'], status: 'playing' } as GameState;
  assert(hopTargetLevel(freshGrad) === 'L3', 'fresh grad hop target is L3');
  assert(hopIsPromotion(freshGrad) === false, 'fresh grad initial onboarding hire is NOT a promotion');
  const freshEff = googleJoin.effect(freshGrad);
  assert(freshEff.level === 'L3', 'fresh grad lands at L3');
  assert(freshEff.last_promo_age !== 24, 'fresh grad does NOT stamp last_promo_age on L3 entry');

  // In-job real level-up IS a promotion
  assert(hopIsPromotion({ ...l5NoImpact({ impact: 30 }) }) === true, 'in-job L5->L6 with impact IS a promotion');

  // 4b. promo_celebration requires at least L4 (never celebrates L3)
  const promoCelebration = events['promo_celebration'];
  assert(!!promoCelebration, 'promo_celebration exists');
  const celebChoice = promoCelebration.choices[0];
  const l3State: GameState = { ...generateInitialState(), level: 'L3', job_type: 'big_tech', status: 'playing' } as GameState;
  const l4State: GameState = { ...generateInitialState(), level: 'L4', job_type: 'big_tech', status: 'playing' } as GameState;
  assert(celebChoice.condition ? !celebChoice.condition(l3State) : false, 'promo_celebration rejects L3');
  assert(celebChoice.condition ? celebChoice.condition(l4State) : true, 'promo_celebration accepts L4');

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
  const grindRes = grind.effect(l5Active);
  assert((grindRes.impact || 0) >= 5, 'Crazy grind produces impact (>=5 on promo/merit)');

  // High-impact L5 CAN promote to L6 Staff via the merged 疯狂内卷 grind engine
  const l5WithHighImpact = l5NoImpact({ impact: 30, last_promo_age: 34, age: 40 });
  setGameSeed(42);
  let grindPromoted = false;
  for (let i = 0; i < 100; i++) {
    const res = grind.effect(l5WithHighImpact);
    if (res.level === 'L6 (Staff)') {
      grindPromoted = true;
      assert((res.impact || 0) >= 40, 'L6 promo further awards +10 impact');
      break;
    }
  }
  assert(grindPromoted, 'High-impact L5 is capable of promoting to L6 Staff via 疯狂内卷');

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
  const sprint = events['sv_daily_life'].choices.find((c) => c.text.includes('疯狂内卷'))!;
  const rest20 = events['sv_daily_life'].choices.find((c) => c.text.includes('按部就班'))!;
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

  // ai_research / MTS path: its efficient yearly impact action (前沿研究 · 主导顶会 Paper) must
  // let a health-balanced researcher accumulate impact past the L6 gate too — research used to
  // have ONLY the health-prohibitive 内卷, so this guards that the dedicated research action exists
  // and is sustainable.
  const research = events['sv_daily_life'].choices.find((c) => c.text.includes('主导顶会 Paper'));
  assert(!!research, 'ai_research has a dedicated efficient impact action (主导顶会 Paper)');
  const rest = events['sv_daily_life'].choices.find((c) => c.text.includes('按部就班'))!;
  let rReached = 0;
  for (let t = 0; t < TRIALS; t++) {
    let s: GameState = {
      ...generateInitialState(6000 + t), is_phd: true, job_type: 'ai_research', company: 'openai', level: 'MTS',
      leetcode: 80, charm: 18, network: 35, health: 100, tc: 55, impact: 0,
      age: 30, last_promo_age: 28, job_start_age: 26, status: 'playing',
    } as GameState;
    for (let yr = 0; yr < 15 && s.status === 'playing'; yr++) {
      const act = (s.health >= 45 && (!research!.condition || research!.condition(s))) ? research! : rest;
      s = applyStateTransition(s, act.effect(s), { eventId: 'sv_daily_life' }).nextState;
      if ((s.impact || 0) >= 20) { rReached++; break; }
      if (s.status !== 'playing') break;
      s = applyStateTransition(s, settle.effect(s), { eventId: 'sv_year_end_settlement' }).nextState;
      if ((s.impact || 0) >= 20) { rReached++; break; }
    }
  }
  const rPct = (rReached / TRIALS) * 100;
  console.log(`   ${rPct.toFixed(0)}% of health-balanced ai_research/MTS players cleared the L6 impact gate (>=20) within 15y`);
  assert(rPct >= 60, `Health-balanced researcher must be able to clear impact>=20 via the dedicated research action in >=60% of careers (got ${rPct.toFixed(0)}%)`);

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

  // 4. Strict Single-Opportunity Invariant: at most 1 opportunity active in any given year
  for (let yr = 2026; yr <= 2045; yr++) {
    const testState = { ...basePilot, year: yr, age: 22 + (yr - 2026) } as GameState;
    const oppChoices = events['sv_daily_life'].choices.filter((c) => {
      if (!c.text.includes('【限时机遇：')) return false;
      return c.condition ? c.condition(testState) : true;
    });
    assert(oppChoices.length <= 1, `At most 1 limited opportunity active in year ${yr} (found ${oppChoices.length})`);
  }

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
  assert(jobInfo.companyLabel === '理工大U (Top 30)', 'HUD displays 理工大U (Top 30)');
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

// -----------------------------------------------------------------------------
// CUJ 31: Marriage Strain, Crisis Resolution & California 50/50 Divorce
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 31] Marriage strain, crisis resolution & California 50/50 divorce ---');
  const ev = events['marriage_divorce_crisis'];
  assert(!!ev, 'marriage_divorce_crisis event is defined');
  assert(ev.choices.length === 3, 'marriage_divorce_crisis has 3 choices');

  const base: GameState = {
    ...generateInitialState(),
    is_married: true,
    relationship_status: 'married',
    cash: 50,
    stocks: 100,
    health: 70,
    story_flags: { partner_strain: 3 },
  } as GameState;

  // Choice 0: Marriage counseling -> cash -0.5, health +5, strain cleared
  const c0 = ev.choices[0].effect(base) as Partial<GameState>;
  assert((c0.cash as number) === 49.5, 'Choice 0 deducts $0.5w counseling fee');
  assert((c0.health as number) === 75, 'Choice 0 moderately restores health (+5)');
  assert(c0.story_flags?.partner_strain === 0, 'Choice 0 clears partner strain');

  // Choice 1: Maui vacation -> cash/stocks -2, health +8, charm +2, strain cleared
  const c1 = ev.choices[1].effect(base) as Partial<GameState>;
  assert((c1.cash as number) === 48, 'Choice 1 deducts $2w vacation cost');
  assert((c1.health as number) === 78, 'Choice 1 restores health (+8)');
  assert(c1.story_flags?.partner_strain === 0, 'Choice 1 clears partner strain');

  // Choice 2: California 50/50 Divorce -> is_married: false, single, assets halved, health -8 (<=15)
  const c2 = ev.choices[2].effect(base) as Partial<GameState>;
  assert(c2.is_married === false, 'Choice 2 sets is_married to false');
  assert(c2.relationship_status === 'single', 'Choice 2 sets relationship_status to single');
  assert((c2.cash as number) === 25, 'Choice 2 halves cash (50 -> 25)');
  assert((c2.stocks as number) === 50, 'Choice 2 halves stocks (100 -> 50)');
  assert((c2.health as number) === 62, 'Choice 2 drains 8 health from emotional toll');
  assert(base.health - (c2.health as number) <= 15, 'Divorce health drain stays <= 15 cap');

  console.log('✅ CUJ 31 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 32: 转码 On-Ramp — 起点/方式/上岸/翻车 结构与平衡(失败率 25-40%)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 32] Career-switcher (转码) on-ramp: structure, landing & washout balance ---');

  // 1. Pipeline events exist + choose_school has the 转码 entry
  for (const id of ['zhuanma_background', 'zhuanma_decision', 'zhuanma_apply', 'zhuanma_setback']) {
    assert(!!events[id], `${id} event is defined`);
  }
  const entry = events['choose_school'].choices.find((c) => c.text.includes('转码'));
  assert(!!entry, 'choose_school has a 转码 entry option');

  // Age sanity: walking the REAL pipeline (含 4 年非科班本科) must reach the first hunt at a
  // realistic age (~24), NOT as an 18-year-old (regression guard for the missing undergrad years).
  {
    let ws = generateInitialState(12345);
    ws = applyStateTransition(ws, entry!.effect(ws), { eventId: 'choose_school' }).nextState;
    const bgUs = events['zhuanma_background'].choices.find((c) => c.text.includes('美本'))!;
    ws = applyStateTransition(ws, bgUs.effect(ws), { eventId: 'zhuanma_background' }).nextState;
    const selfMethod = events['zhuanma_decision'].choices.find((c) => c.text.includes('纯自学'))!;
    ws = applyStateTransition(ws, selfMethod.effect(ws), { eventId: 'zhuanma_decision' }).nextState;
    assert((ws.age ?? 0) >= 22, `转码 reaches first hunt at a realistic age, not a teenager (got age ${ws.age})`);
  }

  // 2. CS 美硕 method reuses the existing us_master pipeline + launders background
  const msChoice = events['zhuanma_decision'].choices.find((c) => c.text.includes('CS 美硕'))!;
  const cnSwitcher: GameState = { ...generateInitialState(), cash: 40, story_flags: { non_cs_background: true, zhuanma_origin: 'cn' } } as GameState;
  assert(msChoice.condition!(cnSwitcher) === true, 'CS master method available to 陆本 switcher with funds');
  const msRes = msChoice.effect(cnSwitcher) as Partial<GameState>;
  assert(msRes.has_us_degree === true, 'CS master method grants US degree (launders non-CS background)');
  assert(msChoice.nextEventId === 'us_master_year1', 'CS master method reuses us_master pipeline');

  // 3. Bootcamp is 美本-only; 陆本 without master funds cannot pick it
  const bootcamp = events['zhuanma_decision'].choices.find((c) => c.text.includes('Bootcamp'))!;
  assert(bootcamp.condition!(cnSwitcher) === false, 'Bootcamp NOT available to 陆本 switcher');
  const usSwitcherRich: GameState = { ...generateInitialState(), cash: 20, story_flags: { non_cs_background: true, zhuanma_origin: 'us' } } as GameState;
  assert(bootcamp.condition!(usSwitcherRich) === true, 'Bootcamp available to 美本 switcher with funds');

  // 4. Washout: quitting sets game_over + flag → determineEnding gives the 转码劝退 card
  const quit = events['zhuanma_setback'].choices.find((c) => c.text.includes('退出转码'))!;
  const quitRes = quit.effect({ ...generateInitialState(), story_flags: { non_cs_background: true, zhuanma_attempts: 3 } } as GameState) as Partial<GameState>;
  assert(quitRes.status === 'game_over', 'Quitting 转码 sets game_over');
  assert(quitRes.story_flags?.zhuanma_washout === true, 'Quitting sets zhuanma_washout flag');
  const washEnding = determineEnding({ ...generateInitialState(), status: 'game_over', story_flags: { zhuanma_washout: true } } as GameState);
  assert(washEnding.id === 'zhuanma_washout', 'Washout flag maps to 转码劝退 ending');

  // 5. Balance: a competent self-taught 美本 switcher washes out in 25-40% of careers.
  //    Models: pick 背水一战 each year; on setback re-grind while allowed, else quit.
  const applyChoice = events['zhuanma_apply'].choices[0];
  const retry = events['zhuanma_setback'].choices.find((c) => c.text.includes('再刷一年'))!;
  let washouts = 0;
  let cashWentNegative = false;
  const N = 400;
  for (let t = 0; t < N; t++) {
    setGameSeed(9000 + t);
    // Competent 美本 self-taught entering first hunt: leetcode ~35, age 24.
    let s: GameState = {
      ...generateInitialState(7000 + t), job_type: undefined, leetcode: 35, luck: 20, health: 85, cash: 6,
      age: 24, status: 'playing', has_us_degree: true, visa: 'F1 (学生)',
      story_flags: { non_cs_background: true, zhuanma_origin: 'us', zhuanma_method: 'self' },
    } as GameState;
    let landed = false;
    for (let guard = 0; guard < 8 && s.status === 'playing'; guard++) {
      s = applyStateTransition(s, applyChoice.effect(s), { eventId: 'zhuanma_apply' }).nextState;
      if ((s.cash ?? 0) < 0) cashWentNegative = true;
      if (s.story_flags?.zhuanma_landed) { landed = true; break; }
      // setback: re-grind if allowed, else quit (washout)
      const canRetry = !!retry.condition && retry.condition(s);
      const pick = canRetry ? retry : quit;
      s = applyStateTransition(s, pick.effect(s), { eventId: 'zhuanma_setback' }).nextState;
      if ((s.cash ?? 0) < 0) cashWentNegative = true;
      if (s.story_flags?.zhuanma_washout || s.status === 'game_over') break;
    }
    if (!landed) washouts++;
  }
  assert(!cashWentNegative, '转码 path never drives cash negative across samples');
  const washPct = (washouts / N) * 100;
  console.log(`   转码(competent 美本自学)washout 率: ${washPct.toFixed(0)}% (目标带 25%~40%)`);
  assert(washPct >= 25 && washPct <= 40, `转码 washout rate must be in the 25-40% hard-but-fair band (got ${washPct.toFixed(0)}%)`);

  console.log('✅ CUJ 32 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 33: charm cap respects max_charm (湾区海王 can exceed 25 up to max_charm)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 33] Charm cap honors max_charm (海王 breaks the old hard-25 ceiling) ---');
  // 海王: max_charm 30. A charm-granting effect must push charm past 25, up to 30.
  const seaKing: GameState = { ...generateInitialState(), max_charm: 30, charm: 24, job_type: 'big_tech', company: 'google', level: 'L5 (Senior)' } as GameState;
  const kingAfter = applyStateTransition(seaKing, { charm: Math.min(seaKing.max_charm ?? 25, seaKing.charm + 8) }, { eventId: 'test' }).nextState;
  assert((kingAfter.charm ?? 0) > 25, `海王 charm can exceed the old 25 ceiling (got ${kingAfter.charm})`);
  assert((kingAfter.charm ?? 0) === 30, `海王 charm caps at max_charm=30 (got ${kingAfter.charm})`);

  // Normal player: max_charm 25 still caps at 25 (central clamp backstop).
  const normal: GameState = { ...generateInitialState(), max_charm: 25, charm: 24 } as GameState;
  const normalAfter = applyStateTransition(normal, { charm: 24 + 8 }, { eventId: 'test' }).nextState;
  assert((normalAfter.charm ?? 0) === 25, `Normal player charm still capped at max_charm=25 (got ${normalAfter.charm})`);

  // Central clamp also floors luck at 0 / impact at 0 (robustness backstop).
  const rogue = applyStateTransition({ ...generateInitialState() } as GameState, { luck: -5, impact: -10 }, { eventId: 'test' }).nextState;
  assert((rogue.luck ?? 0) >= 0, 'luck floored at 0 by central clamp');
  assert((rogue.impact ?? 0) >= 0, 'impact floored at 0 by central clamp');

  console.log('✅ CUJ 33 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 34: Post-Green-Card Role Specialization & Title Formatting Guards
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 34] Post-Green Card Role Specialization & Title Integrity ---');
  const ev = events['post_green_card'];
  assert(Boolean(ev), 'post_green_card event exists');

  const founderState: GameState = {
    ...generateInitialState(),
    visa: '绿卡',
    job_type: 'startup_founder',
    company: 'AI Startup',
    level: 'CEO & Founder',
    company_valuation: 1000
  };

  const traderState: GameState = {
    ...generateInitialState(),
    visa: '绿卡',
    job_type: 'trader',
    company: '全职 Day Trader',
    level: '全职 Trader'
  };

  const employeeState: GameState = {
    ...generateInitialState(),
    visa: '绿卡',
    job_type: 'big_tech',
    company: 'Google',
    level: 'L5 (Senior)'
  };

  // 1. Founder should have the founder expansion choice and NOT employee resignation
  const founderChoices = ev.choices.filter(c => !c.condition || c.condition(founderState));
  const founderHasExpansion = founderChoices.some(c => c.text.includes('全速扩张'));
  const founderHasResign = founderChoices.some(c => c.text.includes('辞职！凭大厂'));
  assert(founderHasExpansion, 'Founder has dedicated 全速扩张 choice in post_green_card');
  assert(!founderHasResign, 'Founder does NOT see employee resignation choice in post_green_card');

  // 2. Trader should have the trader choice and NOT employee office politics
  const traderChoices = ev.choices.filter(c => !c.condition || c.condition(traderState));
  const traderHasTrading = traderChoices.some(c => c.text.includes('深耕交易'));
  const traderHasOfficePolitics = traderChoices.some(c => c.text.includes('不再唯唯诺诺'));
  assert(traderHasTrading, 'Trader has dedicated 深耕交易 choice in post_green_card');
  assert(!traderHasOfficePolitics, 'Trader does NOT see corporate office politics in post_green_card');

  // 3. Employee sees standard corporate paths
  const employeeChoices = ev.choices.filter(c => !c.condition || c.condition(employeeState));
  const employeeHasStartup = employeeChoices.some(c => c.text.includes('全职创业'));
  const employeeHasOfficePolitics = employeeChoices.some(c => c.text.includes('不再唯唯诺诺'));
  assert(employeeHasStartup, 'Employee can choose to resign and found startup in post_green_card');
  assert(employeeHasOfficePolitics, 'Employee can choose office politics in post_green_card');

  console.log('✅ CUJ 34 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 35: Trader regime reading — 做空避险 is regime-directional (熊市赚 / 牛市亏)
// Locks the "read the macro regime → position accordingly" loop so a future edit
// can't silently make the short/bonds play regime-agnostic.
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 35] Trader 做空避险 is regime-directional (熊市赚/牛市亏) ---');
  const ev = events['trader_annual_strategy'];
  const shortChoice = ev.choices.find(c => c.text.includes('做空避险'));
  assert(!!shortChoice, 'trader_annual_strategy has a 做空避险 (short/bonds) choice');
  const growth = ev.choices.find(c => c.text.includes('重仓科技龙头'));
  assert(!!growth, 'trader_annual_strategy still has the bull-favored 重仓科技龙头 choice');

  const baseTrader: GameState = { ...generateInitialState(), job_type: 'trader', company: '全职 Day Trader', level: '全职 Trader', cash: 100, tc: 0 } as GameState;
  const bearState = { ...baseTrader, macro_economy: 'bear' as const };
  const bullState = { ...baseTrader, macro_economy: 'bull' as const };

  const bear = applyStateTransition(bearState, shortChoice!.effect(bearState), { eventId: 'trader_annual_strategy' }).nextState;
  assert(bear.cash > 100, `做空避险 profits in a bear market (cash 100 -> ${bear.cash})`);

  const bull = applyStateTransition(bullState, shortChoice!.effect(bullState), { eventId: 'trader_annual_strategy' }).nextState;
  assert(bull.cash < 100, `做空避险 loses in a bull market (cash 100 -> ${bull.cash})`);

  console.log('✅ CUJ 35 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 36: Founder read-signal→remedy — the on-point remedy for each 痛点 gives a
// stronger valuation boost AND clears the founder_situation signal.
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 36] Founder 痛点→对症 remedy (对症更强且清空信号) ---');
  const ev = events['founder_annual_strategy'];
  const talk = ev.choices.find(c => c.text.includes('TechCrunch'));
  const pmf = ev.choices.find(c => c.text.includes('死磕产品'));
  const hire = ev.choices.find(c => c.text.includes('高举高打招聘'));
  assert(!!talk && !!pmf && !!hire, 'founder_annual_strategy has 演讲 / 死磕PMF / 招架构师 remedies');

  const baseFounder = { ...generateInitialState(), job_type: 'startup_founder', level: 'CEO & Founder', founder_stage: 'seed', company_valuation: 1000, cash: 50, tc: 10 } as GameState;
  const valOf = (choice: any, situation: any) => {
    const st = { ...baseFounder, founder_situation: situation } as GameState;
    return applyStateTransition(st, choice.effect(st), { eventId: 'founder_annual_strategy' }).nextState;
  };

  // 演讲 对症 (估值停滞) vs 无痛点:对症估值增量更大,且信号被清空
  const talkOn = valOf(talk, 'valuation_stall');
  const talkOff = valOf(talk, undefined);
  assert((talkOn.company_valuation || 0) > (talkOff.company_valuation || 0), `演讲对症(估值停滞)估值增益更大 (${talkOff.company_valuation} -> ${talkOn.company_valuation})`);
  assert(talkOn.founder_situation === undefined, '演讲对症后清空 founder_situation');

  // 死磕PMF 对症 (客户流失)
  const pmfOn = valOf(pmf, 'churn');
  const pmfOff = valOf(pmf, undefined);
  assert((pmfOn.company_valuation || 0) > (pmfOff.company_valuation || 0), `死磕PMF对症(客户流失)估值增益更大 (${pmfOff.company_valuation} -> ${pmfOn.company_valuation})`);
  assert(pmfOn.founder_situation === undefined, '死磕PMF对症后清空 founder_situation');

  // 招架构师 对症 (线上事故)
  const hireOn = valOf(hire, 'outage');
  assert(hireOn.founder_situation === undefined, '招架构师对症(线上事故)后清空 founder_situation');
  // 对症时 valuation 至少达到成功档 (550 增益),不受 65% 概率影响
  assert((hireOn.company_valuation || 0) >= 1000 + 550, `招架构师对症必成功且增益达标 (got ${hireOn.company_valuation})`);

  console.log('✅ CUJ 36 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 37: Coasting WLB (按部就班) 封顶 L4 + 年度考评 (Perf Review EE/ME/NI)。
// 锁两件事:①"按部就班养生"自然晋升封顶 L4(L5+ 必须【疯狂内卷】耗血挣,防养生变无脑优选);
// ②年度考评评级正确 —— 晋升/高impact冲刺=EE,健康养生=ME(有调薪,非惩罚),摆烂=可NI+PIP,
// 且 annual_action 每年结算后重置(防上一年动作误判后续考评)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 37] Coasting WLB 封顶 L4 + 年度考评 EE/ME/NI ---');
  const coast = events['sv_daily_life'].choices.find((c) => c.text.includes('按部就班'))!;
  assert(!!coast, 'sv_daily_life 有【按部就班 · 稳健 WLB】选项');

  // 满资历高算法 L4 走按部就班,不能自然升到 L5(必须内卷);且设 annual_action=wlb。
  const l4Ripe = (over: Partial<GameState>): GameState => ({
    ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L4',
    leetcode: 100, age: 40, last_promo_age: 30, health: 90, tc: 40, status: 'playing', ...over,
  } as GameState);
  for (let i = 0; i < 30; i++) {
    assert(coast.effect(l4Ripe({})).level !== 'L5 (Senior)', '按部就班不能自然把 L4 升到 L5');
  }
  assert((coast.effect(l4Ripe({})).story_flags as Record<string, unknown> | undefined)?.annual_action === 'wlb', '按部就班设 annual_action=wlb');

  // 年度考评 (settlement.sv_year_end_settlement)
  const settle = events['sv_year_end_settlement'].choices[0];
  const emp = (over: Partial<GameState>): GameState => ({
    ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L5 (Senior)',
    visa: '公民', age: 35, last_promo_age: 25, health: 80, tc: 40, status: 'playing',
    story_flags: {}, ...over,
  } as GameState);
  const rating = (r: Partial<GameState>) => (r.story_flags as Record<string, unknown> | undefined)?.last_perf_rating;

  // 健康养生玩家 (annual_action=wlb) → ME (符合预期,拿到调薪,非 NI)
  const meRes = settle.effect(emp({ story_flags: { annual_action: 'wlb' } }));
  assert(rating(meRes) === 'ME', '健康养生玩家考评为 ME');
  assert((meRes.tc || 0) >= 40, 'ME 拿到常规调薪 (TC 不降)');

  // 当年晋升 → EE
  assert(rating(settle.effect(emp({ last_promo_age: 35 }))) === 'EE', '当年晋升考评为 EE');
  // 高 impact 冲刺 (非养生,未升) → EE
  assert(rating(settle.effect(emp({ impact: 20 }))) === 'EE', '高 impact 冲刺考评为 EE');

  // annual_action 每年结算后重置为 undefined
  const resetRes = settle.effect(emp({ story_flags: { annual_action: 'wlb' } }));
  assert((resetRes.story_flags as Record<string, unknown> | undefined)?.annual_action === undefined, 'annual_action 结算后重置');

  // 摆烂 (低血低 impact) 可触发 NI,并亮起 PIP 预警
  let sawNI = false;
  for (let i = 0; i < 80; i++) {
    const r = settle.effect(emp({ health: 15, impact: 2 }));
    if (rating(r) === 'NI') {
      sawNI = true;
      assert((r.story_flags as Record<string, unknown> | undefined)?.pip_warning === true, 'NI 考评亮起 PIP 预警');
      break;
    }
  }
  assert(sawNI, '摆烂(低血低impact)可触发 NI 考评');

  console.log('✅ CUJ 37 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 38: 升职受阻·定性复盘 (Promo is a blackbox)。L5+ 内卷未升成时给一句定性方向反馈,
// 但【绝不暴露任何真实数值/门槛】(保持晋升黑箱)。锁两件事:①有定性复盘;②不泄露数字/阈值。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 38] 升职受阻·定性复盘 (黑箱,不泄露数值) ---');
  const grind = events['sv_daily_life'].choices.find((c) => c.text.includes('疯狂内卷'))!;
  // L5、impact=0、network 低 → 冲 L6 必然受阻(impact<20 短路 meetsOrganicPromo)→ 落入底部定性复盘。
  const stuck = { ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L5 (Senior)',
    leetcode: 70, impact: 0, network: 10, charm: 12, tc: 60, health: 80, age: 40, last_promo_age: 35, status: 'playing' } as GameState;
  let sawDiag = false, leakedNumber = false;
  for (let i = 0; i < 20; i++) {
    const r = grind.effect(stuck);
    if (r.level === 'L6 (Staff)') { assert(false, 'impact=0 的 L5 不应升到 L6'); break; }
    const m = r.message || '';
    if (m.includes('晋升复盘')) sawDiag = true;
    // 黑箱:复盘句里不得出现门槛数字(如 8/20、>=20、或裸阈值数字)。先剔除职级 token(L6/L5…)
    // 再查——职级名里的数字不算泄露指标。
    const diagPart = (m.split('【晋升复盘】')[1] || '').replace(/L\d/g, '');
    if (/\d/.test(diagPart)) leakedNumber = true;
  }
  assert(sawDiag, 'L5 冲 L6 受阻时给出【晋升复盘】定性方向反馈');
  assert(!leakedNumber, '晋升复盘为黑箱:不得泄露任何真实数值/门槛数字');

  // L3 玩家不触发 Staff+ 复盘(其失败文案走既有的算法提示),promoBlockerHint 返回空。
  const l3 = { ...stuck, level: 'L3', leetcode: 20, impact: 0 } as GameState;
  assert(!(grind.effect(l3).message || '').includes('晋升复盘'), 'L3 不触发 Staff+ 晋升复盘');

  console.log('✅ CUJ 38 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 39: Day 1 CPT 不是「白嫖永动机」。锁三件事:①年终每年多缴 $1.2w 学费 + 健康 -4;
// ②约 10% 概率触发 day1_cpt_compliance 合规抽检(settlement 路由可达);③抽检面板三条出路
// 均化解、无 game_over、不回环(全部回 sv_daily_life),且破产玩家仍有可选项(不死胡同)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 39] Day 1 CPT 年度学业成本 + 合规抽检 (非白嫖永动机) ---');
  const settle = events['sv_year_end_settlement'].choices[0];

  // ① 年度学费 + 健康代价:CPT 与绿卡失业玩家其余条件全同,唯一差异应是 +$1.2w 学费与 -4 健康。
  // 二者失业(无 H1B 抽签)、stocks=0、经济中性 → effect 全程零随机,可精确断言。
  const cptUnemp = { ...generateInitialState(), visa: 'Day 1 CPT', job_type: 'unemployed',
    laid_off: false, tc: 0, cash: 30, stocks: 0, health: 50, is_married: false, has_pet: false,
    macro_economy: 'neutral', rental_income: 0, status: 'playing' } as GameState;
  const gcUnemp = { ...cptUnemp, visa: '绿卡' } as GameState;
  setGameSeed(1);
  const rC = settle.effect(cptUnemp);
  setGameSeed(1);
  const rG = settle.effect(gcUnemp);
  assert(Math.abs(((rG.cash ?? 0) - (rC.cash ?? 0)) - 1.2) < 0.05, 'Day 1 CPT 每年多缴 $1.2w 学费');
  assert(rC.health === 61 && rG.health === 65, 'CPT 失业年 health=50+15-4=61,绿卡=65 (CPT 多扣 4 健康)');
  assert((rC.message ?? '').includes('Day 1 CPT 学业维持'), 'CPT 年终结算附带学业维持提示文案');
  assert(!(rG.message ?? '').includes('Day 1 CPT 学业维持'), '非 CPT 玩家不出现 CPT 学费文案');

  // ② settlement 路由:在职 CPT 玩家约 10% 进 day1_cpt_compliance,其余进 sv_daily_life,别无它路。
  const cptEmp = { ...generateInitialState(), visa: 'Day 1 CPT', job_type: 'big_tech', company: 'google',
    laid_off: false, gc_progress: 2, cash: 50, stocks: 50, win_threshold: 500, h1b_attempts: 0,
    age: 40, status: 'playing' } as GameState;
  const routeTargets = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    setGameSeed(seed);
    routeTargets.add((settle.nextEventId as (s: GameState) => string)(cptEmp));
  }
  assert(routeTargets.has('day1_cpt_compliance'), '在职 CPT 玩家会触发 day1_cpt_compliance 合规抽检 (可达)');
  assert([...routeTargets].every((t) => t === 'day1_cpt_compliance' || t === 'sv_daily_life'),
    'CPT settlement 只路由到 合规抽检 或 sv_daily_life,无其它出口');

  // ③ 合规抽检面板:存在、三条出路全部回 sv_daily_life、任何随机下都不 game_over、破产也有活路。
  const compliance = events['day1_cpt_compliance'];
  assert(!!compliance, 'day1_cpt_compliance 事件已定义');
  assert(compliance.choices.length >= 3, '合规抽检提供至少 3 条应对出路');
  assert(compliance.choices.every((c) => c.nextEventId === 'sv_daily_life'),
    '合规抽检所有出路回 sv_daily_life (不回环、不卡死)');
  const broke = { ...generateInitialState(), visa: 'Day 1 CPT', cash: 0, stocks: 0, health: 40, status: 'playing' } as GameState;
  const avail = compliance.choices.filter((c) => !c.condition || c.condition(broke));
  assert(avail.length >= 1, '破产 (cash=0) CPT 玩家在合规抽检仍有可选出路 (非死胡同)');
  let sawGameOver = false;
  for (const c of compliance.choices) {
    for (let seed = 0; seed < 40; seed++) {
      setGameSeed(seed);
      const solvent = { ...generateInitialState(), visa: 'Day 1 CPT', cash: 20, stocks: 0, health: 50, status: 'playing' } as GameState;
      if (c.condition && !c.condition(solvent)) continue;
      const r = c.effect(solvent);
      if (r.status === 'game_over') sawGameOver = true;
    }
  }
  assert(!sawGameOver, '合规抽检任何出路在任何随机下都不会 game_over (仅现金/健康代价)');

  console.log('✅ CUJ 39 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 40: L-1 跨国外派跳槽限制与转换机制 (L-1 Job Hopping Constraint)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 40] L-1 跨国外派跳槽限制与转换机制 ---');
  const hopMarket = events['job_hop_market'];
  assert(!!hopMarket, 'job_hop_market event exists');
  const googleChoice = hopMarket.choices.find(c => c.text.includes('Google'))!;
  assert(!!googleChoice, 'Google choice exists in job_hop_market');

  // Case 1: L-1 持有者具备 O-1 资质 (如 PhD) -> 自动 Transfer 至 O-1 签证
  const l1Phd: GameState = {
    ...generateInitialState(),
    visa: 'L1 (外派)',
    is_phd: true,
    company: 'amazon',
    job_type: 'big_tech',
    level: 'L5 (Senior)',
    cash: 20,
    hop_offers: ['google']
  } as GameState;
  const resPhd = googleChoice.effect(l1Phd) as Partial<GameState>;
  assert(resPhd.visa === 'O1 (杰出人才)', 'L-1 具备 O-1 资质跳槽转为 O-1 签证');
  assert((resPhd.message || '').includes('O-1'), '跳槽文案包含 O-1 解绑提示');

  // Case 2: L-1 普通员工无 O-1/绿卡资质 -> 紧急挂靠 Day 1 CPT 过渡入职
  const l1Normal: GameState = {
    ...generateInitialState(),
    visa: 'L1 (外派)',
    is_phd: false,
    impact: 5,
    leetcode: 40,
    company: 'amazon',
    job_type: 'big_tech',
    level: 'L4',
    cash: 20,
    hop_offers: ['google']
  } as GameState;
  const resNormal = googleChoice.effect(l1Normal) as Partial<GameState>;
  assert(resNormal.visa === 'Day 1 CPT', 'L-1 无 O-1 资质跳槽转为 Day 1 CPT');
  assert((resNormal.message || '').includes('Day 1 CPT'), '跳槽文案包含 Day 1 CPT 过渡提示');

  // Case 3: 绿卡/公民跳槽 -> 保留绿卡/公民身份不变
  const gcPlayer: GameState = {
    ...generateInitialState(),
    visa: '绿卡',
    company: 'amazon',
    job_type: 'big_tech',
    level: 'L5 (Senior)',
    cash: 20,
    hop_offers: ['google']
  } as GameState;
  const resGc = googleChoice.effect(gcPlayer) as Partial<GameState>;
  assert(resGc.visa === '绿卡', '绿卡持有者跳槽保留绿卡身份');
  console.log('✅ CUJ 40 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 41: H-1B 6-Year Cap & I-140 Protection (H-1B 6年大限与 I-140 保护机制)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 41] H-1B 6年大限与 I-140 保护机制 ---');
  const settlementEv = events['sv_year_end_settlement'];
  assert(!!settlementEv, 'sv_year_end_settlement event exists');
  const yearEndChoice = settlementEv.choices[0];

  // Case 1: H-1B 满 6 年但 I-140 仍未获批 (PERM 进行中) -> 触发 6 年大限危机
  const h1bNearCap: GameState = {
    ...generateInitialState(),
    age: 32,
    year: 2026,
    visa: 'H1B (工签)',
    h1b_tenure: 5,
    h1b_attempts: 1,
    gc_progress: 1,
    gc_stage: 'perm_processing',
    job_type: 'big_tech',
    company: 'google',
    cash: 20,
    stocks: 10,
    tc: 35,
    win_threshold: 500,
    story_flags: { last_h1b_lottery_year: 2026 }
  } as GameState;

  const nextStateUnprotected = applyStateTransition(h1bNearCap, yearEndChoice.effect(h1bNearCap), { eventId: 'sv_year_end_settlement' }).nextState;
  assert(nextStateUnprotected.h1b_tenure === 6, 'H-1B 累计使用年数增长至 6 年');
  const nextEvId = typeof yearEndChoice.nextEventId === 'function' ? yearEndChoice.nextEventId(nextStateUnprotected) : yearEndChoice.nextEventId;
  assert(nextEvId === 'h1b_six_year_crisis', 'H-1B 满 6 年且无 I-140 时路由至 h1b_six_year_crisis');

  // Case 2: H-1B 满 6 年且 I-140 已获批 -> 触发 AC21 延期保护，不触发危机
  const h1bProtected: GameState = {
    ...h1bNearCap,
    gc_progress: 3,
    gc_stage: 'i140_approved'
  } as GameState;
  const nextStateProtected = applyStateTransition(h1bProtected, yearEndChoice.effect(h1bProtected), { eventId: 'sv_year_end_settlement' }).nextState;
  const protectedEvId = typeof yearEndChoice.nextEventId === 'function' ? yearEndChoice.nextEventId(nextStateProtected) : yearEndChoice.nextEventId;
  assert(protectedEvId !== 'h1b_six_year_crisis', 'I-140 获批受 AC21 保护，不触发 h1b_six_year_crisis');
  assert(nextStateProtected.message.includes('AC21') || nextStateProtected.message.includes('豁免'), '年终结算播报包含 AC21 豁免延期提示');

  // Case 3: h1b_six_year_crisis 自救选择验证
  const crisisEv = events['h1b_six_year_crisis'];
  assert(!!crisisEv, 'h1b_six_year_crisis event is defined');
  const ppChoice = crisisEv.choices.find(c => c.text.includes('PP 加急'))!;
  assert(!!ppChoice, 'PP 加急自救选项存在');
  const ppRes = ppChoice.effect(nextStateUnprotected) as Partial<GameState>;
  assert(ppRes.gc_stage === 'i140_approved' && ppRes.gc_progress === 3, 'PP 加急自救成功获批 I-140');

  const l1Choice = crisisEv.choices.find(c => c.text.includes('外派海外'))!;
  assert(!!l1Choice, '外派海外重置选项存在');
  const l1Res = l1Choice.effect(nextStateUnprotected) as Partial<GameState>;
  assert(l1Res.visa === 'L1 (外派)' && l1Res.h1b_tenure === 0, '外派海外成功重置 H-1B 6年钟表');

  console.log('✅ CUJ 41 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 42: 路由「单一真相源」+ 年度季度事件机 (resolveNextEventId)。App.tsx 与蒙卡/fuzz harness 必须
// 都经此解析,否则模拟路径 != 线上路径。年度节律 = 年度动作 → H1 职场事件 → H2 生活事件 → 结算,由
// year_seg(0→1→2)驱动、单调递增保证必定终结。锁六件事:① targetEventId 覆盖;② 只在「推进信号」
// (settlement / mid_year 的 sv_daily_life)动作,【绝不覆盖子枢纽如 job_hop_market】(用户实测 bug:
// 跳槽拿到 offer 却被 H1 事件顶掉);③ seg0+在职 → 注入 H1、seg=1;④ seg1 → 注入 H2、seg=2(H2 不
// 再被吞);⑤ seg2 → 结算;⑥ 非 mid_year 直通。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 42] 路由单一真相源 + 年度季度事件机 (year_seg) ---');
  const base = { ...generateInitialState(), status: 'playing', job_type: 'big_tech', company: 'google', level: 'L5 (Senior)', age: 30 } as GameState;

  // ① 中央终局/FIRE 路由 (targetEventId) 永远压过事件自身的 nextEventId。
  const over = resolveNextEventId({ nextEventId: 'sv_daily_life' }, base, 'fire_milestone_choice');
  assert(over.nextEventId === 'fire_milestone_choice', 'targetEventId 覆盖 choice.nextEventId');
  assert(resolveNextEventId({ nextEventId: 'sv_daily_life' }, base, 'end').nextEventId === 'end', 'targetEventId=end 覆盖路由');

  // ② 【关键回归】子枢纽事件(非推进信号)绝不被季度事件机覆盖 —— 跳槽必须能进 job_hop_market 选 offer。
  const midYear = { ...base, mid_year: true, year_seg: 0 } as GameState;
  const hop = resolveNextEventId({ nextEventId: 'job_hop_market' }, midYear, undefined, 'sv_daily_life');
  assert(hop.nextEventId === 'job_hop_market', '年度动作后的子枢纽 job_hop_market 原样透传(不被 H1 顶掉)');
  const invest = resolveNextEventId({ nextEventId: 'stock_market_annual_gamble' }, midYear, undefined, 'sv_daily_life');
  assert(invest.nextEventId === 'stock_market_annual_gamble', '投资子枢纽 stock_market_annual_gamble 原样透传');

  // ③ seg0 + 在职 + 推进信号 → 注入 H1 职场事件,year_seg=1。
  const advH1 = resolveNextEventId({ nextEventId: 'sv_year_end_settlement' }, midYear, undefined);
  assert(advH1.finalState.year_seg === 1, 'seg0 推进后 year_seg=1');
  assert(advH1.nextEventId !== 'sv_year_end_settlement' && !!events[advH1.nextEventId as string], 'seg0 在职 → 注入合法 H1 事件(不直接进结算)');

  // ④ seg1 + 推进信号 → 注入 H2 生活事件,year_seg=2 (H2 不再被吞)。
  const seg1 = { ...base, mid_year: true, year_seg: 1 } as GameState;
  const advH2 = resolveNextEventId({ nextEventId: 'sv_year_end_settlement' }, seg1, undefined);
  assert(advH2.finalState.year_seg === 2, 'seg1 推进后 year_seg=2');
  assert(advH2.nextEventId !== 'sv_year_end_settlement' && !!events[advH2.nextEventId as string], 'seg1 → 注入合法 H2 生活事件(H2 不被吞)');

  // ⑤ seg2 + 推进信号 → 年终结算 (清空 year_seg)。
  const seg2 = { ...base, mid_year: true, year_seg: 2 } as GameState;
  const toSettle = resolveNextEventId({ nextEventId: 'sv_year_end_settlement' }, seg2, undefined);
  assert(toSettle.nextEventId === 'sv_year_end_settlement' && toSettle.finalState.year_seg === undefined, 'seg2 → 结算且清空 year_seg');
  // 再入 sv_daily_life(mid_year)在 seg2 也强制进结算 → 杜绝同一结算周期内二次年度动作。
  assert(resolveNextEventId({ nextEventId: 'sv_daily_life' }, seg2, undefined).nextEventId === 'sv_year_end_settlement', 'seg2 再入 sv_daily_life 被拦截进结算(防同年二次动作)');

  // ⑥ 非 mid_year:原样直通。
  const plain = { ...base, mid_year: false } as GameState;
  assert(resolveNextEventId({ nextEventId: 'sv_daily_life' }, plain, undefined).nextEventId === 'sv_daily_life', '非 mid_year 原样直通');
  assert(resolveNextEventId({ nextEventId: () => 'job_hunt' }, plain, undefined).nextEventId === 'job_hunt', '函数式 nextEventId 被正确求值');

  console.log('✅ CUJ 42 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 43: H1「职场大事件」板块已接回主循环。一个在职年度的年度重心(sv_daily_life)决策完成后,
// 必须先经历一个 H1 职场事件(裁员/PIP/绩效/公司标志/两难/中年危机…),而不是直接跳到 H2 生活
// 事件。历史回归:h1ToH2Router 曾强制 season_stage='h2',使整个 H1 板块(尤其裁员池)运行时永不
// 触发。锁两件事:① 在职年度决策会路由到 H1-only 事件(裁员池可达);② 未在职则不注入 H1。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 43] H1 职场事件板块接回主循环 (裁员池运行时可达) ---');
  const grind = events['sv_daily_life'].choices.find((c) => c.text.includes('疯狂内卷'))!;
  // H1-only 事件:只存在于 midYearEventRouter 的 H1「职场」块,H2 生活块绝不会产出它们。
  const H1_ONLY = new Set(['layoff_rumor', 'friday_pip', 'perf_review', 'meta_reorg_manager_left',
    'all_hands_corporate_bs', 'snack_perks_downgrade', 'empty_promotion_promise', 'multi_timezone_calendar_hell']);
  // 低 leetcode / 年限浅 → 疯狂内卷多为"未晋升"(不弹庆祝),稳定走 H1 注入路径。
  const worker = { ...generateInitialState(), job_type: 'big_tech', company: 'google', level: 'L4',
    leetcode: 30, impact: 2, tc: 30, health: 80, age: 30, last_promo_age: 29, status: 'playing' } as GameState;
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    setGameSeed(seed);
    const eff = grind.effect(worker);
    const st = applyStateTransition(worker, eff, { eventId: 'sv_daily_life' });
    const routed = resolveNextEventId(grind, st.nextState, st.targetEventId, 'sv_daily_life');
    if (routed.nextEventId) seen.add(routed.nextEventId);
  }
  const hitH1Only = [...seen].some((id) => H1_ONLY.has(id));
  assert(hitH1Only, '在职年度决策后会路由到 H1-only 职场事件(裁员/PIP/绩效池运行时可达)');

  // ② 失业玩家不注入 H1(resolver 的在职门槛):即便 source=sv_daily_life + mid_year + h1。
  const jobless = { ...worker, job_type: 'unemployed', tc: 0, mid_year: true, season_stage: 'h1' as const } as GameState;
  const joblessRouted = resolveNextEventId({ nextEventId: 'sv_daily_life' }, jobless, undefined, 'sv_daily_life');
  assert(!H1_ONLY.has(joblessRouted.nextEventId as string), '失业玩家不被注入 H1 职场事件');

  console.log('✅ CUJ 43 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 44: 宏观经济周期 (Markov 轮动) 已接回 —— 由年终结算驱动,不再恒锁 neutral。历史回归:经济
// 只能靠 news_* 事件切换,而它们被 `!season_stage` 永久锁死 → 非 trader 玩家经济恒 neutral,牛熊
// 机制(股票乘数/加薪/招聘/stock_crash/trader 读周期)全成摆设。锁三件事:① 结算会把经济轮动到
// 牛/熊/横盘三态(有惯性也会回归);② news_* 为纯播报、不再驱动经济(驱动唯一在结算);③ 熊市
// 可达(trader 做空、stock_crash 有触发土壤)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 44] 宏观经济周期 Markov 轮动 (结算驱动,非恒 neutral) ---');
  const settle = events['sv_year_end_settlement'].choices[0];
  const distFrom = (from: 'neutral' | 'bull' | 'bear') => {
    const d: Record<string, number> = { neutral: 0, bull: 0, bear: 0 };
    for (let seed = 0; seed < 800; seed++) {
      setGameSeed(seed);
      const s = { ...generateInitialState(), macro_economy: from, job_type: 'big_tech', company: 'google',
        level: 'L4', tc: 30, stocks: 20, health: 80, age: 30, status: 'playing' } as GameState;
      const r = settle.effect(s);
      d[(r.macro_economy as string) || 'neutral']++;
    }
    return d;
  };
  const fromNeutral = distFrom('neutral');
  assert(fromNeutral.bull > 0 && fromNeutral.bear > 0 && fromNeutral.neutral > 0, '横盘年会轮动到 牛/熊/横盘 三态');
  assert(fromNeutral.neutral < 800, '经济不再恒锁 neutral(死子系统已复活)');
  const fromBull = distFrom('bull');
  assert(fromBull.bull > 0, '牛市有惯性(可持续 >1 年)');
  assert(fromBull.neutral > 0 || fromBull.bear > 0, '牛市会回归/反转(非永牛)');
  const fromBear = distFrom('bear');
  assert(fromBear.bear > 0 && (fromBear.neutral > 0 || fromBear.bull > 0), '熊市有惯性也会回归/反转');
  assert(fromNeutral.bear > 0, '熊市可达 —— trader 做空/stock_crash 有触发土壤');

  // news_* 现为可达的「行情播报」,且不再驱动经济(驱动唯一在结算,避免双驱动)。
  for (const id of ['news_bull_market_start', 'news_bear_market_crash', 'news_neutral_market']) {
    assert(!!events[id], `${id} 事件存在`);
    const r = events[id].choices[0].effect({ ...generateInitialState(), macro_economy: 'bear' } as GameState);
    assert(r.macro_economy === undefined, `${id} 为纯播报,不改写 macro_economy(经济驱动唯一在结算)`);
  }

  console.log('✅ CUJ 44 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 45: 美国天价急诊与 ICU 惊魂 (us_healthcare_icu_crisis)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 45] 美国急救车与 ICU 天价账单事件 ---');
  const icuEvent = events['us_healthcare_icu_crisis'];
  assert(!!icuEvent, 'us_healthcare_icu_crisis 事件已注册');
  assert(icuEvent.choices.length === 4, 'icuEvent 拥有 4 个分支');

  // Choice 1: 大厂 PPO 医保兜底 (自付 $0.3w)
  const ppoChoice = icuEvent.choices[0];
  const bigTechEmp = { ...generateInitialState(), job_type: 'big_tech', company: 'google', cash: 5, health: 30, status: 'playing' } as GameState;
  const unemployed = { ...generateInitialState(), job_type: 'unemployed', laid_off: true, cash: 5, health: 30, status: 'playing' } as GameState;
  assert(ppoChoice.condition ? ppoChoice.condition(bigTechEmp) : false, '大厂员工可使用 PPO 医保兜底');
  assert(ppoChoice.condition ? !ppoChoice.condition(unemployed) : true, '失业玩家不可使用大厂 PPO 医保兜底');
  const ppoRes = ppoChoice.effect(bigTechEmp);
  assert(ppoRes.cash === 4.7, '大厂医保自付 $0.3w');
  assert((ppoRes.health ?? 0) > 30, '医治后健康提升');
  assert(ppoRes.story_flags?.icu_crisis_survived === true, '标记已度过 ICU 危机');

  // Choice 2: Itemized Bill 硬核砍价 (自付 $0.6w)
  const itemChoice = icuEvent.choices[1];
  assert(itemChoice.condition ? itemChoice.condition(unemployed) : true, '失业玩家可使用 Itemized 砍价');
  const itemRes = itemChoice.effect(unemployed);
  assert(itemRes.cash === 4.4, 'Itemized 砍价自付 $0.6w');

  // Choice 3: No Surprises Act 法律维权
  const legalChoice = icuEvent.choices[2];
  const lowCharm = { ...generateInitialState(), charm: 8, network: 5, cash: 5, status: 'playing' } as GameState;
  const highCharm = { ...generateInitialState(), charm: 18, network: 5, cash: 5, status: 'playing' } as GameState;
  assert(legalChoice.condition ? !legalChoice.condition(lowCharm) : true, '低魅力/人脉不可维权');
  assert(legalChoice.condition ? legalChoice.condition(highCharm) : false, '高魅力/人脉可维权');
  const legalRes = legalChoice.effect(highCharm);
  assert(legalRes.cash === 4.8, '维权后仅自付 $0.2w');

  // Choice 4: 裸奔大出血 (安全扣减股票，不产生负现金)
  const uninsuredChoice = icuEvent.choices[3];
  const brokePlayer = { ...generateInitialState(), cash: 0.5, stocks: 10, health: 25, status: 'playing' } as GameState;
  const brokeRes = uninsuredChoice.effect(brokePlayer);
  assert(brokeRes.cash === 0, '现金清零且不为负');
  assert(brokeRes.stocks === 8, '股票平仓扣除剩余 $2.0w');

  console.log('✅ CUJ 45 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 46: 卷王之王 PhD 录取加成与直博被拒转读 MS 曲线救国
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 46] 卷王之王 PhD 录取加成与直博被拒转读 MS 曲线救国 ---');
  
  // 1. calculatePhdAdmitProb 权重校验
  const plainStudent = { ...generateInitialState(), school: 'state', leetcode: 30, impact: 0, status: 'playing' } as GameState;
  const plainProb = calculatePhdAdmitProb(plainStudent, false);
  // 无投入地板收紧:普通美本(无科研/低算法)基础录取率 12%,PhD 奖励投入而非白嫖抽奖。
  assert(plainProb === 0.12, '普通美本(零投入)基础录取率收紧至 12%');

  const juanwangStudent = { ...generateInitialState(), trait_title: '卷王之王', school: 'ucb', leetcode: 65, impact: 0, status: 'playing' } as GameState;
  const juanwangProb = calculatePhdAdmitProb(juanwangStudent, false);
  // 0.12 + 0.15 (ucb) + 0.15 (卷王) + 0.12 (leetcode 65) = 0.54
  assert(Math.abs(juanwangProb - 0.54) < 0.001, `卷王之王获得专属加成，录取率达 ${(juanwangProb * 100).toFixed(0)}%`);

  const researchJuanwang = { ...generateInitialState(), trait_title: '卷王之王', school: 'cmu', leetcode: 85, impact: 15, story_flags: { phd_ready: true }, status: 'playing' } as GameState;
  const researchProb = calculatePhdAdmitProb(researchJuanwang, false);
  assert(researchProb >= 0.90, '顶配科研卷王录取率达 90%+');

  // 2. 本科申 PhD 被拒后路由至 us_undergrad_phd_rejection (非强制 job_hunt)
  const undergradGrad = events['us_undergrad_grad'];
  const phdChoice = undergradGrad.choices[0];
  const rejectNextId = typeof phdChoice.nextEventId === 'function' ? phdChoice.nextEventId({ ...plainStudent, is_phd: false } as GameState) : phdChoice.nextEventId;
  assert(rejectNextId === 'us_undergrad_phd_rejection', '美本申博被拒路由至 us_undergrad_phd_rejection');

  const rejectEvent = events['us_undergrad_phd_rejection'];
  assert(!!rejectEvent, 'us_undergrad_phd_rejection 事件存在');
  assert(rejectEvent.choices.length === 3, '申博失利提供 3 大出路');

  // Choice 1: 转读 MS
  const msPivotChoice = rejectEvent.choices[0];
  const richStudent = { ...plainStudent, cash: 12 };
  assert(msPivotChoice.condition ? msPivotChoice.condition(richStudent) : false, '有学费可转读 MS');
  const msRes = msPivotChoice.effect(richStudent);
  assert(msRes.cash === 2, '自费 $10w 读硕');
  assert(msRes.is_master === true, '转为硕士身份');
  assert(msRes.story_flags?.phd_reapply_ready === true, '打上硕士毕业二战 PhD 标记');
  assert(msPivotChoice.nextEventId === 'us_master_year1', '进入硕士第一年');

  // 3. 硕士毕业二战 PhD 享受 phd_reapply_ready 加成
  const msGrad = { ...generateInitialState(), is_master: true, school: 'ucb', leetcode: 70, story_flags: { phd_reapply_ready: true }, status: 'playing' } as GameState;
  const reapplyProb = calculatePhdAdmitProb(msGrad, true);
  // 0.25 (master base) + 0.15 (ucb) + 0.12 (leetcode 70) + 0.12 (reapply bonus) = 0.64
  assert(reapplyProb >= 0.60, '二战申博享受硕士再战加成');

  console.log('✅ CUJ 46 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 47: ICC 外包挂靠不是长期归宿。历史 bug:挂靠被当成普通 startup 正职——能拿绿卡、正常涨薪、
// 无限期零风险。现实里 ICC = 低薪 bench + USCIS 重点稽查,只能短期维持身份、必须尽快刷题上岸。
// 锁四件事:① 挂靠期间绿卡冻结(不推进);② 不涨薪(merit 排除);③ USCIS 稽查逐年升级、命中即
// 转失业+身份危机(→ layoff_hit);④ 稽查不会无限拖延(数年内必被清退,杜绝无限挂靠)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 47] ICC 外包挂靠:低薪/冻结绿卡/USCIS 稽查逼上岸 ---');
  const settle = events['sv_year_end_settlement'].choices[0];
  const iccBase = { ...generateInitialState(), company: 'icc', job_type: 'startup', visa: 'H1B (工签)',
    tc: 14, gc_stage: 'i140_processing', gc_progress: 2, stocks: 0, cash: 20, health: 70, age: 30, status: 'playing' } as GameState;

  // 多年数取样:统计稽查命中率(升级)、绿卡推进率、涨薪率。
  const sample = (tenure: number) => {
    let crack = 0, gcAdv = 0, merit = 0; const N = 1500;
    for (let i = 0; i < N; i++) {
      setGameSeed(i);
      const r = settle.effect({ ...iccBase, startup_tenure: tenure } as GameState);
      if (r.job_type === 'unemployed' && r.laid_off) crack++;
      if ((r.gc_progress || 0) > 2 || (r.gc_stage && r.gc_stage !== 'i140_processing')) gcAdv++;
      if ((r.tc || 0) > 14) merit++;
    }
    return { crack: crack / N, gcAdv: gcAdv / N, merit: merit / N };
  };
  const y1 = sample(0);   // 结算后成为第 1 年
  const y3 = sample(2);   // 结算后成为第 3 年

  // ① 绿卡冻结:任何挂靠年数都不推进绿卡。
  assert(y1.gcAdv === 0 && y3.gcAdv === 0, 'ICC 挂靠期间绿卡完全冻结(不推进 PERM/排期)');
  // ② 不涨薪。
  assert(y1.merit === 0 && y3.merit === 0, 'ICC 挂靠不涨薪(merit 排除)');
  // ③ 稽查逐年升级:第 1 年就有真实风险,第 3 年显著更高。
  assert(y1.crack > 0.10 && y1.crack < 0.45, 'ICC 第 1 年即有 USCIS 稽查风险(约 25%)');
  assert(y3.crack > y1.crack + 0.20, 'ICC 稽查概率随挂靠年数显著升级(越久越危险)');
  // ④ 命中即转失业+身份危机 → layoff_hit,并非死胡同/无限挂靠。
  setGameSeed(2); // 高年数下大概率命中
  const caught = settle.effect({ ...iccBase, startup_tenure: 5 } as GameState);
  if (caught.laid_off) {
    assert(caught.job_type === 'unemployed' && caught.tc === 0, '稽查命中后挂靠合同终止(转失业、TC 清零)');
    const routed = (settle.nextEventId as (s: GameState) => string)({ ...iccBase, ...caught } as GameState);
    assert(routed === 'layoff_hit', '稽查命中(临时工签)→ 打入 layoff_hit 限期自救(有上岸/转CPT/回国等出路)');
  }
  // 永久身份(绿卡)在 ICC 不被稽查清退(只有临时签证才有遣返风险)。
  setGameSeed(1);
  const gcHolder = settle.effect({ ...iccBase, visa: '绿卡', startup_tenure: 5 } as GameState);
  assert(!(gcHolder.job_type === 'unemployed' && gcHolder.laid_off), '绿卡持有者在 ICC 不因稽查被清退');

  console.log('✅ CUJ 47 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 48: ICU 911 事件复审加固 —— 不再是"越虚弱越易触发的可复发付费回血永动机"。锁两件事:
// ① 一生一次门禁:midYearEventRouter 的 H2 生活池仅在 !icu_crisis_survived 时纳入该事件(度过后
// 不再复发);② 裸奔(无保险)分支有真实下行:约 45% 概率后遗症、恢复不全(健康仅 +4,而非稳 +18)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 48] ICU 事件:一生一次门禁 + 裸奔下行分支 ---');
  // ① 一生一次:已度过 ICU 的玩家,H2 生活池 N 次采样都不会再出现该事件。
  const survivedIcu = { ...generateInitialState(), job_type: 'big_tech', company: 'google', laid_off: false,
    health: 20, car: 'none', is_married: false, status: 'playing',
    story_flags: { icu_crisis_survived: true } } as GameState;
  let recurred = false;
  for (let i = 0; i < 5000; i++) {
    setGameSeed(i * 3 + 1);
    if (midYearEventRouter({ ...survivedIcu, season_stage: 'h2' }) === 'us_healthcare_icu_crisis') { recurred = true; break; }
  }
  assert(!recurred, '度过 ICU 后不再复发(一生一次门禁,消除可复发回血永动机)');
  // 未度过者仍可触发(尤其低血)——确认门禁不是把事件彻底关掉。
  const freshLow = { ...survivedIcu, story_flags: {} } as GameState;
  let fired = false;
  for (let i = 0; i < 5000; i++) { setGameSeed(i * 3 + 1); if (midYearEventRouter({ ...freshLow, season_stage: 'h2' }) === 'us_healthcare_icu_crisis') { fired = true; break; } }
  assert(fired, '未度过 ICU 的玩家仍会触发该健康危机');

  // ② 裸奔分支有真实下行:多次采样中既有勉强恢复(+18)也有后遗症(+4),证明存在下行支。
  const uninsured = events['us_healthcare_icu_crisis'].choices[3];
  const patient = { ...generateInitialState(), cash: 30, stocks: 0, health: 25, status: 'playing' } as GameState;
  const heals = new Set<number>();
  for (let i = 0; i < 200; i++) { setGameSeed(i); const r = uninsured.effect(patient); heals.add((r.health ?? 25) - 25); }
  assert(heals.has(4) && heals.has(18), '裸奔分支存在下行(后遗症 +4)与常规恢复(+18)两种结局');
  assert(Math.max(...heals) <= 18, '裸奔分支不再是稳定大回血(封顶 +18,且有 +4 后遗症风险)');

  console.log('✅ CUJ 48 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 49: 一生一次统一基座 (GameEvent.oncePerLife + hasSeen/markSeen 自动置位)。取代此前散落 6 份
// 复制的 seen() 助手 + "触发检查/效果置位"两处手写(漏一处即 ICU 类复发 bug)。锁三件事:
// ① hasSeen/markSeen 语义正确;② oncePerLife 事件的 effect 无需手写置位——applyStateTransition
// 自动标记 `${id}_seen`;③ 标记后 hasSeen 为真(路由据此门禁,不再复发)。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 49] 一生一次统一基座 oncePerLife + hasSeen/markSeen ---');
  const s0 = { ...generateInitialState(), status: 'playing' } as GameState;
  assert(hasSeen(s0, 'foo_evt') === false, 'hasSeen 初始为 false');
  const flags = markSeen(s0, 'foo_evt');
  assert(flags['foo_evt_seen'] === true, 'markSeen 置位 ${id}_seen');
  assert(hasSeen({ ...s0, story_flags: flags } as GameState, 'foo_evt') === true, 'markSeen 后 hasSeen 为真');

  const ev = events['level_entry_grunt_work'];
  assert(ev.oncePerLife === true, 'level_entry_grunt_work 已声明 oncePerLife');
  const eff = ev.choices[0].effect(s0);
  assert(!('story_flags' in eff), 'oncePerLife 事件 effect 无需手写 story_flags 置位');
  const after = applyStateTransition(s0, eff, { eventId: 'level_entry_grunt_work' }).nextState;
  assert(hasSeen(after, 'level_entry_grunt_work') === true, '解析后由中间件自动标记 _seen(消除漏置)');

  const plainAfter = applyStateTransition(s0, { health: s0.health - 1 }, { eventId: 'sv_daily_life' }).nextState;
  assert(!hasSeen(plainAfter, 'sv_daily_life'), '非 oncePerLife 事件不被自动标记');

  console.log('✅ CUJ 49 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 50: 非科班转码全链路深度体验 — 专业起点/备战打磨/多元求职/职场成长
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 50] Non-CS Major Switcher Journey & Post-Transition Career Progression ---');

  // 1. 验证多元背景专业选项与属性加成
  const bgChoices = events['zhuanma_background'].choices;
  assert(bgChoices.length >= 4, 'zhuanma_background has at least 4 background choices');
  const bio = bgChoices.find(c => c.text.includes('生化环材'))!;
  const biz = bgChoices.find(c => c.text.includes('商科/社科'))!;
  const eng = bgChoices.find(c => c.text.includes('机械/电子/数理'))!;
  assert(!!bio && !!biz && !!eng, 'All three major archetype backgrounds exist');

  const sInit = { ...generateInitialState(), health: 80 } as GameState;
  const bioState = applyStateTransition(sInit, bio.effect(sInit), { eventId: 'zhuanma_background' }).nextState;
  assert(bioState.story_flags?.zhuanma_major === 'bio_chem', 'Bio/chem major sets zhuanma_major flag');
  assert(bioState.health > sInit.health, 'Bio/chem major grants resilience health bonus');

  // 2. 验证备战打磨事件 zhuanma_prep
  const prep = events['zhuanma_prep'];
  assert(!!prep, 'zhuanma_prep event exists');
  assert(prep.choices.length === 4, 'zhuanma_prep offers 4 distinct preparation strategies');
  for (const c of prep.choices) {
    assert(c.nextEventId === 'zhuanma_apply', 'All zhuanma_prep choices lead to zhuanma_apply');
  }

  // 3. 验证 zhuanma_apply 多元上岸通道 (背水一战 / 传统IT / ICC外包)
  const applyChoices = events['zhuanma_apply'].choices;
  assert(applyChoices.length >= 3, 'zhuanma_apply has direct, enterprise IT, and ICC options');
  const entOption = applyChoices.find(c => c.text.includes('传统企业 IT'))!;
  const iccOption = applyChoices.find(c => c.text.includes('ICC'))!;
  assert(!!entOption && !!iccOption, 'Enterprise IT and ICC fallback options exist in zhuanma_apply');

  const richState = { ...generateInitialState(), cash: 5, status: 'playing' } as GameState;
  const iccResult = applyStateTransition(richState, iccOption.effect(richState), { eventId: 'zhuanma_apply' }).nextState;
  assert(iccResult.company === 'icc' && iccResult.story_flags?.zhuanma_landed === true, 'ICC choice lands switcher safely at ICC');

  // 4. 验证转码职场成长线事件 (oncePerLife + midYearEventRouter 可达)
  for (const id of ['zhuanma_imposter_syndrome', 'zhuanma_domain_crossover', 'zhuanma_mentor_community']) {
    const ev = events[id];
    assert(!!ev, `${id} career event is defined`);
    assert(ev.oncePerLife === true, `${id} has oncePerLife flag set`);
  }

  // 5. 验证中后期转码事件在 midYearEventRouter 中被非科班玩家顺利命中
  const workingSwitcher: GameState = {
    ...generateInitialState(),
    job_type: 'big_tech',
    company: 'google',
    level: 'L5 (Senior)',
    age: 28,
    year: 2022,
    status: 'playing',
    story_flags: { non_cs_background: true },
  } as GameState;

  const hitEvents = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    setGameSeed(20000 + i);
    const routed = midYearEventRouter(workingSwitcher);
    if (routed.startsWith('zhuanma_')) {
      hitEvents.add(routed);
    }
  }
  assert(hitEvents.has('zhuanma_imposter_syndrome'), 'zhuanma_imposter_syndrome reachable by working switcher');
  assert(hitEvents.has('zhuanma_domain_crossover'), 'zhuanma_domain_crossover reachable by working switcher');
  assert(hitEvents.has('zhuanma_mentor_community'), 'zhuanma_mentor_community reachable by working switcher');

  console.log('✅ CUJ 50 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 51: 内部转组 (internal_team_transfer) 改变后续赛道。锁三件事:
// ①sv_daily_life 有转组入口且路由到 internal_team_transfer + 设 annual_action=transfer;
// ②AI 核心组置 team_focus=ai_core + transferred_to_ai + 清 PIP;养老组置 wlb_tools + 清 PIP;
// ③team_focus 真正影响 H1 事件池:wlb_tools 绝不出 PIP/裁员/危机,ai_core 能卷入 AI 攻坚。
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 51] 内部转组改变后续 H1 赛道 (team_focus → midYearEventRouter) ---');
  const entry = events['sv_daily_life'].choices.find((c) => c.text.includes('申请内部转组'))!;
  assert(!!entry, 'sv_daily_life 有【申请内部转组】入口');
  const emp: GameState = { ...generateInitialState(), job_type: 'big_tech', company: 'meta', level: 'L5 (Senior)', leetcode: 60, health: 70, status: 'playing' } as GameState;
  const entryRes = entry.effect(emp);
  assert((typeof entry.nextEventId === 'function' ? entry.nextEventId(emp) : entry.nextEventId) === 'internal_team_transfer', '转组入口路由到 internal_team_transfer');
  assert((entryRes.story_flags as Record<string, unknown>)?.annual_action === 'transfer', '转组入口设 annual_action=transfer');

  const transfer = events['internal_team_transfer'];
  const aiChoice = transfer.choices.find((c) => c.text.includes('前沿 AI'))!;
  const wlbChoice = transfer.choices.find((c) => c.text.includes('养老'))!;
  assert(transfer.choices.length === 2, 'TPM 已移除,转组只剩 AI核心 / 养老支持 两个去向');

  const aiRes = aiChoice.effect({ ...emp, story_flags: { pip_warning: true } } as GameState);
  assert((aiRes.story_flags as Record<string, unknown>)?.team_focus === 'ai_core', 'AI 组置 team_focus=ai_core');
  assert(aiRes.transferred_to_ai === true, 'AI 组接上 transferred_to_ai (启用既有 AI 机制)');
  assert((aiRes.story_flags as Record<string, unknown>)?.pip_warning === false, 'AI 组清空 PIP 预警');

  const wlbRes = wlbChoice.effect({ ...emp, story_flags: { pip_warning: true }, health: 40 } as GameState);
  assert((wlbRes.story_flags as Record<string, unknown>)?.team_focus === 'wlb_tools', '养老组置 team_focus=wlb_tools');
  assert((wlbRes.health || 0) > 40, '养老组回血');
  assert((wlbRes.story_flags as Record<string, unknown>)?.pip_warning === false, '养老组清空 PIP 预警');

  // team_focus 真正影响 H1 池:养老组多次抽样绝不返回 PIP/裁员/危机
  const banned = ['friday_pip', 'layoff_rumor', 'stock_crash', 'ai_disruption_existential', 'friday_p0_outage_crisis', 'agent_hallucination_prod_disaster'];
  const wlbState: GameState = { ...emp, year: 2025, story_flags: { team_focus: 'wlb_tools' }, season_stage: 'h1' } as GameState;
  for (let i = 0; i < 120; i++) {
    const ev = midYearEventRouter(wlbState);
    assert(!banned.includes(ev), `养老组 H1 不应出现高压事件 (got ${ev})`);
  }
  // AI 核心组能卷入前沿 AI 攻坚 (多次抽样至少命中一次 AI/影响力事件)
  const aiState: GameState = { ...emp, year: 2025, company: 'google', story_flags: { team_focus: 'ai_core' }, season_stage: 'h1' } as GameState;
  const aiPool = new Set<string>();
  for (let i = 0; i < 200; i++) aiPool.add(midYearEventRouter(aiState));
  const aiFrontier = ['llm_datacenter_power_outage', 'ai_disruption_existential', 'open_source_breakout', 'internal_tech_talk_viral'];
  assert(aiFrontier.some((e) => aiPool.has(e)), 'AI 核心组 H1 能卷入前沿 AI / 影响力事件');

  console.log('✅ CUJ 51 Passed\n');
}

// -----------------------------------------------------------------------------
// CUJ 52: 硅谷防破产与财务梗事件 (我是学生砍价 / 前任独角兽暴富 / 房贷断供危机)
// -----------------------------------------------------------------------------
{
  console.log('--- [CUJ 52] 硅谷防破产与财务梗事件 (我是学生 / 前任暴富 / 房贷断供) ---');

  // 1. 【我是学生，可以少算点吗？】
  const changeRental = events['change_rental'];
  const studentChoice = changeRental.choices.find((c) => c.text.includes('我是学生'))!;
  assert(!!studentChoice, 'change_rental 包含【我是学生，可以少算点吗？】砍价选项');

  const f1Student: GameState = {
    ...generateInitialState(),
    visa: 'F1 (学生)',
    job_type: undefined,
    rent: 2.0,
    cash: 2.0,
  } as GameState;
  const studentRes = studentChoice.effect(f1Student);
  assert(studentRes.rent! < 2.0 && studentRes.cash! > 2.0, '真实学生砍价成功减免房租');

  const employedSwe: GameState = {
    ...generateInitialState(),
    visa: 'H1B (工签)',
    job_type: 'big_tech',
    rent: 2.0,
    charm: 15,
  } as GameState;
  const sweRes = studentChoice.effect(employedSwe);
  assert(sweRes.charm! < 15, '大厂高薪码农冒充学生砍价遭遇社死扣情商');

  // 2. 【前任独角兽暴富】
  const unicornEvent = events['ex_spouse_unicorn_exit'];
  assert(!!unicornEvent && unicornEvent.choices.length === 3, 'ex_spouse_unicorn_exit 存在且有 3 个选项');
  const divorcedState: GameState = {
    ...generateInitialState(),
    age: 30,
    story_flags: { had_divorce: true },
    cash: 20,
  } as GameState;
  const likeChoice = unicornEvent.choices.find((c) => c.text.includes('默默点赞'))!;
  const likeRes = likeChoice.effect(divorcedState);
  assert(likeRes.health! < divorcedState.health, '默默点赞心绞痛扣健康');

  // 3. 【房贷断供危机】
  const mortgageCrisis = events['mortgage_default_crisis'];
  assert(!!mortgageCrisis && mortgageCrisis.choices.length === 3, 'mortgage_default_crisis 存在且有 3 个选项');
  const shortSale = mortgageCrisis.choices.find((c) => c.text.includes('Short Sale'))!;
  const saleRes = shortSale.effect({ ...divorcedState, has_housing: true, housing_name: 'Sunnyvale 老破小' } as GameState);
  assert(saleRes.has_housing === false && saleRes.cash! > 20, 'Short Sale 卖房止损拿回流动资金退回租房 (自购房)');
  // 父母出资的房 Short Sale 不返还权益 (与 house_slave 断供一致,防白拿)
  const parentSale = shortSale.effect({ ...divorcedState, has_housing: true, parents_helped_house: true, housing_name: 'Sunnyvale 老破小' } as GameState);
  assert(parentSale.cash === 20, '父母出资房 Short Sale 不返还权益 (cash 不变)');

  console.log('✅ CUJ 52 Passed\n');
}

console.log(`\n======================================================`);
console.log(`📊 CUJ TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
if (failedAssertions === 0) {
  console.log(`🎉 100% OF ALL CUJs (Critical User Journeys) PASSED WITH ZERO BUGS!`);
} else {
  console.error(`❌ ${failedAssertions} ASSERTIONS FAILED!`);
  process.exit(1);
}

