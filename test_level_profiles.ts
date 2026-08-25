// Behavior-lock test for LEVEL_PROFILES (src/data/levelProfiles.ts).
// Guards the ladder rank/stage, non-standard title normalization, and the
// (now unified) organic-promotion stat bar so a future edit is deliberate.
import { LEVEL_PROFILES, normalizeLevel, getLevelRank, isStaffPlus, getOrganicPromoReq, getHopImpactGate, meetsOrganicPromo } from './src/data/levelProfiles';
import { generateInitialState } from './src/data/events';
import { GameState } from './src/types';

console.log('--- [level-profiles] ladder rank / normalization / promo-bar lock ---');
let fail = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { console.error(`\u274c ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); fail++; }
  else console.log(`\u2705 ${name}`);
};

// 1. Rank order is strictly increasing L3<L4<L5<L6<L7<L8
check('rank L3', LEVEL_PROFILES['L3'].rank, 3);
check('rank L8', LEVEL_PROFILES['L8 (Principal)'].rank, 8);
check('rank order', getLevelRank('L6 (Staff)') > getLevelRank('L5 (Senior)') && getLevelRank('L8 (Principal)') > getLevelRank('L7 (Senior Staff)'), true);

// 2. stage buckets
check('stage L4 entry', LEVEL_PROFILES['L4'].stage, 'entry');
check('stage L5 senior', LEVEL_PROFILES['L5 (Senior)'].stage, 'senior');
check('stage L6 staff_plus', LEVEL_PROFILES['L6 (Staff)'].stage, 'staff_plus');
check('isStaffPlus L6', isStaffPlus('L6 (Staff)'), true);
check('isStaffPlus L5', isStaffPlus('L5 (Senior)'), false);

// 3. Non-standard title normalization (kills the `'L6 (Staff)'||'Staff'||'MTS'` variant lists)
check('normalize Staff', normalizeLevel('Staff'), 'L6 (Staff)');
check('normalize L5 short', normalizeLevel('L5'), 'L5 (Senior)');
check('normalize Senior Staff', normalizeLevel('Senior Staff'), 'L7 (Senior Staff)');
check('normalize 待业 -> null', normalizeLevel('待业'), null);
// MTS depends on tc/impact
check('normalize MTS high -> L6', normalizeLevel('MTS', { tc: 70, impact: 25 } as GameState), 'L6 (Staff)');
check('normalize MTS low -> L5', normalizeLevel('MTS', { tc: 30, impact: 0 } as GameState), 'L5 (Senior)');
check('normalize Founder high impact -> L7', normalizeLevel('CEO & Founder', { impact: 50 } as GameState), 'L7 (Senior Staff)');

// 4. Canonical (unified) organic promo bar — the single source that all promo sites now read.
check('promoReq L6', getOrganicPromoReq('L6 (Staff)'), { impact: 20, leetcode: 65, charm: 15, network: 25, tc: 30, health: 35 });
check('promoReq L7', getOrganicPromoReq('L7 (Senior Staff)'), { impact: 45, leetcode: 70, charm: 16, network: 35, tc: 45, health: 40 });
check('promoReq L8', getOrganicPromoReq('L8 (Principal)'), { impact: 80, leetcode: 80, charm: 20, network: 50, tc: 65, health: 45 });
check('hop gate L6/L7/L8', [getHopImpactGate('L6 (Staff)'), getHopImpactGate('L7 (Senior Staff)'), getHopImpactGate('L8 (Principal)')], [20, 45, 80]);

// 5. meetsOrganicPromo: sprint skips tc+health; standard requires them.
const base = { ...generateInitialState(), leetcode: 65, charm: 15, network: 25, impact: 20, tc: 10, health: 20 } as GameState;
check('sprint ignores tc/health', meetsOrganicPromo(base, 'L6 (Staff)', { sprint: true }), true);
check('standard needs tc/health', meetsOrganicPromo(base, 'L6 (Staff)'), false);
const full = { ...base, tc: 30, health: 35 } as GameState;
check('standard passes with tc/health', meetsOrganicPromo(full, 'L6 (Staff)'), true);
check('below stat bar fails', meetsOrganicPromo({ ...full, leetcode: 64 } as GameState, 'L6 (Staff)'), false);

console.log(fail === 0 ? '\n\ud83c\udf89 ALL LEVEL BEHAVIOR CHECKS PASSED' : `\n\u274c ${fail} CHECKS FAILED`);
if (fail !== 0) throw new Error('level-profiles behavior lock failed');
