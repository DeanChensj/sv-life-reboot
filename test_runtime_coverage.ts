// RUNTIME COVERAGE AUDIT — the execution oracle the test suite was missing.
//
// WHY THIS EXISTS: audit_all_flows proves "reachability" by REGEX-SCANNING source for event-id
// literals, so an event that merely *appears* in a pool array counts as reachable even when the
// branch that reads that array never executes. That is exactly how the entire H1 work-event block
// (layoff_rumor / friday_pip / perf_review / org_ai_wipeout / midlife_ageism_squeeze / raj /
// dilemmas / company-signature …) stayed DEAD for months while every suite was green:
// "mentioned in source" != "reached at runtime". A grep oracle can only find events mentioned
// NOWHERE — never events mentioned but never reached.
//
// This audit instead SIMULATES many diverse lives through the REAL unified router
// (resolveNextEventId — the same path App.tsx ships) and records which event ids are ACTUALLY
// visited. Any registered event never visited across the whole (deterministic) simulation is a
// runtime orphan and FAILS the build, unless it is explicitly classified below with a reason.
// This is the anti-regression that would have caught the H1 deadness on day one.
import { events, generateInitialState, resolveNextEventId } from './src/data/events';
import { applyStateTransition } from './src/utils/stateTransitions';
import { setGameSeed, gameRandom } from './src/utils/random';
import type { Choice } from './src/types';

// ---------------------------------------------------------------------------------------------
// (1) Events legitimately NOT reachable by a pure event-graph simulation, but reachable in the
//     real app through the Shop UI (ShopModal → onBuy / onTriggerEvent). Not bugs; the sim just
//     doesn't click the shop. audit_all_flows already treats the rental ones as explicit roots.
// ---------------------------------------------------------------------------------------------
const ALLOW_UI_OR_ASSET: Record<string, string> = {
  change_rental: 'ShopModal onTriggerEvent (换租按钮) — UI 触发,不在事件图内',
  manage_rental_properties: 'ShopModal onTriggerEvent (管理出租房) — UI 触发,不在事件图内',
  san_francisco_car_window_smash: '需拥有车辆;车只能在 ShopModal 购买 (UI),纯事件图模拟不会买车',
  tesla_fsd_unsupervised_scare: '需 model_y/cybertruck;车为 ShopModal 购买 (UI)',
  luxury_car_meet: '需 porsche/cybertruck;豪车为 ShopModal 购买 (UI)',
  luxury_car_vandalism_towing: '需 porsche/cybertruck;豪车为 ShopModal 购买 (UI)',
};

// ---------------------------------------------------------------------------------------------
// (2) KNOWN DEAD — genuine runtime-unreachable BUGS this audit uncovered, tracked for a fix.
//     (do NOT silently treat as fine.) Empty now: the economy-neutral-lock class it originally
//     held (news_* / stock_crash / macro_liquidity_rate_cycle) was fixed in Step 3 — the macro
//     economy is now a Markov cycle driven at year-end settlement (bull/bear actually happen),
//     news_* fire as reachable regime telegraphs, and the bear-gated events fire once bear
//     regimes occur. This audit's "stale listed entry now reachable" assertion is what forces
//     this list to be emptied when the fix lands, instead of quietly masking it.
// ---------------------------------------------------------------------------------------------
const KNOWN_DEAD: Record<string, string> = {};

// H1 work-event pool that MUST be reached now that Step 2 reconnected the H1 block — a positive
// lock so the reconnection can't silently regress back to "layoffs never fire".
const H1_MUST_REACH = ['layoff_rumor', 'friday_pip', 'perf_review', 'org_ai_wipeout', 'midlife_ageism_squeeze'];

const visited = new Set<string>();

// Two policies, unioned: "random" maximizes BRANCH breadth (failure/side branches); "grind"
// maximizes DEPTH/survival (reaches L6+/late-game/company-signature/midlife events a player who
// dies young never sees). Neither filters give-up options — content endings count too.
function play(seed: number, policy: 'random' | 'grind') {
  let state = generateInitialState(seed);
  if (seed % 4 === 0) { state.trait_title = '卷王之王'; state.leetcode = 40; }
  let currentEventId = 'choose_trait';
  let turns = 0;
  while (turns < 400 && state.status === 'playing') {
    turns++;
    visited.add(currentEventId);
    const ev = events[currentEventId];
    if (!ev?.choices?.length) break;
    const valid = ev.choices.filter((c: Choice) => !c.condition || c.condition(state));
    if (!valid.length) break;
    let chosen: Choice;
    if (policy === 'grind' && currentEventId === 'sv_daily_life') {
      // seed%5 is a divorce-seeking cohort: it marries, then accrues partner_strain at the
      // dual-income crises and divorces — keeping marriage_divorce_crisis / had_divorce /
      // ex_spouse_unicorn_exit sim-reachable now that 活跃社交 routes married players to a hub.
      chosen = (seed % 3 === 0 ? valid.find(c => /置业安家/.test(c.text)) : undefined)
        || (seed % 5 === 0 ? valid.find(c => /经营人际/.test(c.text)) : undefined)
        || (state.health < 55 ? valid.find(c => /躺平|WLB|火人节|养生/.test(c.text)) : undefined)
        || valid.find(c => /疯狂内卷|刷题跳槽|顶会 Paper/.test(c.text)) || valid[0];
    } else if (policy === 'grind' && currentEventId === 'dating_market') {
      chosen = valid.find(c => /闪婚|走进婚姻/.test(c.text)) || valid[0];
    } else if (policy === 'grind' && currentEventId === 'active_social_life') {
      // everyone routes through this hub now. Unmarried → 相亲 (drive toward dating_market →
      // marriage); married → friends/community (strain-neutral; NOT 陪伴, which清零 partner_strain
      // and would starve the divorce chain the seed%5 cohort is pursuing).
      chosen = (!state.is_married && state.relationship_status !== 'married')
        ? (valid.find(c => /相亲|推进感情/.test(c.text)) || valid[0])
        : (valid.find(c => /老友组局|深耕社区/.test(c.text)) || valid[0]);
    } else if (policy === 'grind' && currentEventId === 'dual_income_wlb_burnout') {
      chosen = valid.find(c => /谁也不退让|死磕/.test(c.text)) || valid[0];
    } else if (policy === 'grind' && currentEventId === 'marriage_divorce_crisis') {
      chosen = valid.find(c => /协议离婚/.test(c.text)) || valid[0];
    } else if (policy === 'grind' && state.health < 40) {
      chosen = valid.find(c => /休息|养生|求医|恢复|稳健|苟|婉拒|妥协/.test(c.text)) || valid[Math.floor(gameRandom() * valid.length)];
    } else {
      chosen = valid[Math.floor(gameRandom() * valid.length)];
    }
    const transition = applyStateTransition(state, chosen.effect(state), { eventId: currentEventId });
    const routed = resolveNextEventId(chosen, transition.nextState, transition.targetEventId, currentEventId);
    state = routed.finalState;
    if (state.status !== 'playing') { if (routed.nextEventId) visited.add(routed.nextEventId); break; }
    if (!routed.nextEventId) break;
    currentEventId = routed.nextEventId;
    if (currentEventId === 'end') { visited.add('end'); break; }
  }
}

const N = Number(process.env.COV_N || 8000); // deterministic seeds → reproducible; 8000 already covers all reachable
for (let i = 0; i < N; i++) { setGameSeed(i); play(i, i % 2 === 0 ? 'random' : 'grind'); }

const all = Object.keys(events);
const unreached = all.filter(id => !visited.has(id)).sort();
const classified = new Set([...Object.keys(ALLOW_UI_OR_ASSET), ...Object.keys(KNOWN_DEAD)]);

console.log(`\n🧭 === 运行时覆盖审计 (${N} 局 × 真实统一路由) ===`);
console.log(`注册事件 ${all.length} | 运行时访问 ${visited.size} | 未访问 ${unreached.length} | 覆盖率 ${(visited.size / all.length * 100).toFixed(1)}%`);

let failed = false;

// ASSERT 1 (anti-regression, the one that would have caught H1): every unreached event must be
// classified. A NEW unreached event = new dead code = build breaks.
const newlyDead = unreached.filter(id => !classified.has(id));
if (newlyDead.length) {
  failed = true;
  console.error(`\n❌ 发现新的运行时死事件 (未分类,疑似路由回归):`);
  newlyDead.forEach(id => console.error(`   ${id}`));
  console.error(`   → 若确为可达,请修路由;若 UI 触发,加入 ALLOW_UI_OR_ASSET;若确为 bug,加入 KNOWN_DEAD 并开跟踪。`);
}

// ASSERT 2 (list hygiene / ratchet-tighten): a classified event that is NOW reached must be
// removed from its list — prevents stale allow-lists from masking future regressions.
const staleListed = [...classified].filter(id => visited.has(id));
if (staleListed.length) {
  failed = true;
  console.error(`\n❌ 下列事件已被分类为"不可达"但现在可达了,请从 ALLOW_UI_OR_ASSET / KNOWN_DEAD 移除:`);
  staleListed.forEach(id => console.error(`   ${id}`));
}

// ASSERT 3 (positive lock for Step 2): the reconnected H1 work-event pool must actually fire.
const h1Missing = H1_MUST_REACH.filter(id => !visited.has(id));
if (h1Missing.length) {
  failed = true;
  console.error(`\n❌ H1 职场事件板块回归 —— 下列本应在常规玩法触发的事件运行时未出现:`);
  h1Missing.forEach(id => console.error(`   ${id}`));
}

if (Object.keys(KNOWN_DEAD).length) {
  console.warn(`\n⚠️  已知死事件 (${Object.keys(KNOWN_DEAD).length}, 待修复,非回归):`);
  for (const [id, why] of Object.entries(KNOWN_DEAD)) console.warn(`   ${id} — ${why}`);
}

if (failed) {
  console.error(`\n❌ 运行时覆盖审计未通过！`);
  process.exit(1);
} else {
  console.log(`\n✅ 运行时覆盖审计通过：无新增死事件;H1 职场板块运行时可达;分类清单无过期项。`);
}
