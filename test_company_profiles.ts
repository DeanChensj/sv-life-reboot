// Behavior-lock test for the COMPANY_PROFILES table (src/data/companyProfiles.ts).
// Guards the display label + TC cash/RSU split for every big-tech employer so a
// future company addition (or table edit) can't silently regress into the wrong
// fallback — the exact bug class this refactor removed (see Oracle).
import { generateInitialState } from './src/data/events';
import { getJobDisplayInfo, getTCBreakdown } from './src/utils/gameStateSelectors';
import { COMPANY_PROFILES } from './src/data/companyProfiles';
import { GameState } from './src/types';

console.log('--- [company-profiles] label + TC-split behavior lock ---');
let fail = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { console.error(`❌ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); fail++; }
  else console.log(`✅ ${name}`);
};

const mk = (over: Partial<GameState>): GameState =>
  ({ ...generateInitialState(), job_type: 'big_tech', level: 'L5 (Senior)', tc: 100, ...over } as GameState);

// Expected labels (from pre-refactor gameStateSelectors ladder) + Oracle FIX.
const labels: Record<string, string> = {
  google: 'Google', meta: 'Meta', nvidia: 'Nvidia', tiktok: 'TikTok',
  apple: 'Apple', amazon: 'Amazon', microsoft: 'Microsoft',
  cisco: 'Cisco', oracle: 'Oracle', robinhood: 'Robinhood',
};
for (const [co, want] of Object.entries(labels)) {
  check(`label ${co}`, getJobDisplayInfo(mk({ company: co })).companyLabel, want);
}

// Oracle must no longer render as the generic fallback.
const oracleLabel = getJobDisplayInfo(mk({ company: 'oracle' })).companyLabel;
check('oracle NOT generic', oracleLabel !== '硅谷科技大厂', true);

// Expected TC base/rsu split ratios (pre-refactor getTCBreakdown).
// meta/nvidia 40/60, tiktok 70/30, everyone else standard 55/45.
const splitPct = (s: GameState) => {
  const b = getTCBreakdown(s);
  const base = +(b.preTaxBase / (b.preTaxBase + b.preTaxRSU)).toFixed(2);
  const rsu = +(b.preTaxRSU / (b.preTaxBase + b.preTaxRSU)).toFixed(2);
  return { base, rsu };
};
const splits: Record<string, { base: number; rsu: number }> = {
  google: { base: 0.55, rsu: 0.45 }, apple: { base: 0.55, rsu: 0.45 },
  microsoft: { base: 0.55, rsu: 0.45 }, amazon: { base: 0.55, rsu: 0.45 },
  cisco: { base: 0.55, rsu: 0.45 }, oracle: { base: 0.55, rsu: 0.45 },
  meta: { base: 0.40, rsu: 0.60 }, nvidia: { base: 0.40, rsu: 0.60 },
  tiktok: { base: 0.70, rsu: 0.30 }, robinhood: { base: 0.60, rsu: 0.40 },
};
for (const [co, want] of Object.entries(splits)) {
  check(`tc-split ${co}`, splitPct(mk({ company: co })), want);
}
// ai_research still 40/60 (unchanged path)
check('tc-split ai_research', splitPct(mk({ job_type: 'ai_research', company: 'openai' })), { base: 0.40, rsu: 0.60 });

// Self-maintaining: EVERY table entry's label must be reachable via the selector
// (i.e. no new company is shadowed by an earlier job_type/company branch). This
// auto-covers future additions without editing this test.
for (const [co, profile] of Object.entries(COMPANY_PROFILES)) {
  check(`table→selector ${co}`, getJobDisplayInfo(mk({ company: co })).companyLabel, profile.label);
}

console.log(fail === 0 ? '\n🎉 ALL COMPANY BEHAVIOR CHECKS PASSED' : `\n❌ ${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);
