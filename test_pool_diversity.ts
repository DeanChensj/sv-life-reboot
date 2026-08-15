import { midYearEventRouter, generateInitialState, setGameSeed } from './src/data/events';
import type { GameState } from './src/types';

// ============================================================================
// Pool-Starving Guard — 反「事件池饥饿」回归守卫
// ----------------------------------------------------------------------------
// Ensures no working career path deterministically returns the SAME single H1
// event year after year. Each path's H1 "career/work" stage must draw from a
// pool: sampling the router many times for a representative state of that path
// must surface at least MIN_DISTINCT distinct events, and no single event may
// dominate beyond MAX_SHARE of the draws.
//
// Exceptions: `trader` / `startup_founder` H1 is an intentional annual STRATEGY
// HUB (a single 6-choice decision screen, analogous to the corporate yearly-focus
// menu), with their variety delivered in the H2 themed pools — so they are checked
// only for reachability, not pool diversity.
// ============================================================================

let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    failures++;
    console.log(`❌ ${msg}`);
  }
}

const SAMPLES = 800;

function sampleH1(base: Partial<GameState>): Record<string, number> {
  const counts: Record<string, number> = {};
  // Build the representative state ONCE (generateInitialState reseeds the PRNG via
  // Date.now internally, so constructing it inside the loop would clobber our seed).
  const s: GameState = {
    ...generateInitialState(),
    status: 'playing',
    season_stage: 'h1',
    health: 85,
    ...base,
  } as GameState;
  for (let i = 0; i < SAMPLES; i++) {
    setGameSeed(1000 + i * 7); // deterministic per-draw seed drives the router's gameRandom
    const id = midYearEventRouter(s);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function assertDiverse(name: string, counts: Record<string, number>, minDistinct: number, maxShare = 0.9) {
  const ids = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Math.max(...Object.values(counts));
  const topShare = top / total;
  const distribution = ids
    .sort((a, b) => counts[b] - counts[a])
    .map((id) => `${id}:${((counts[id] / total) * 100).toFixed(0)}%`)
    .join(', ');
  check(
    ids.length >= minDistinct && topShare <= maxShare,
    `[${name}] H1 池多样 (distinct=${ids.length}>=${minDistinct}, 最高占比 ${(topShare * 100).toFixed(0)}%<=${maxShare * 100}%) — ${distribution}`,
  );
}

console.log('🎲 === 反「事件池饥饿」守卫 (Pool-Starving Guard) ===\n');

// 大厂 big_tech：大 workEvents 池
assertDiverse('big_tech', sampleH1({ job_type: 'big_tech', company: 'google', level: 'L5 (Senior)', tc: 46, age: 32, visa: '绿卡', year: 2025 }), 4);

// startup：过去每年必 startup_crisis（且必失业），现为加权池
assertDiverse('startup', sampleH1({ job_type: 'startup', company: 'AI Startup', level: 'Senior', tc: 24, age: 29, visa: '绿卡', year: 2025 }), 2);

// quant：过去每年必 quant_stress
assertDiverse('quant', sampleH1({ job_type: 'quant', company: 'Citadel', level: 'Quant', tc: 60, age: 30, visa: '绿卡', year: 2025 }), 2);

// ai_research / OpenAI：过去每年必 ai_research_crisis（openai 标志事件为一次性，样本里会被 seen 挡住，故这里不置 flag）
assertDiverse('ai_research', sampleH1({ job_type: 'ai_research', company: 'OpenAI', level: 'MTS', tc: 75, age: 30, visa: '绿卡', year: 2025 }), 2);

// trader / founder：H1 为「年度策略决策枢纽」(单一多选项 hub)，多样性在 H2 主题池 —— 仅校验可达。
{
  const traderCounts = sampleH1({ job_type: 'trader', company: '全职 Day Trader', level: '全职 Trader', tc: 0, cash: 60, age: 32, visa: '公民', year: 2025 });
  check(Object.keys(traderCounts).length >= 1, `[trader] H1 年度策略枢纽可达 — ${Object.keys(traderCounts).join(', ')}`);
  const founderCounts = sampleH1({ job_type: 'startup_founder', company: 'AI Startup', level: 'CEO & Founder', founder_stage: 'seed', tc: 10, cash: 40, age: 31, visa: '绿卡', year: 2025 });
  check(Object.keys(founderCounts).length >= 1, `[founder] H1 年度策略枢纽可达 — ${Object.keys(founderCounts).join(', ')}`);
}

console.log('');
if (failures > 0) {
  console.error(`\n❌ POOL-STARVING GUARD: ${failures} 项失败！某条职业路径在 H1 总是推送同一事件，请改为事件池。`);
  process.exit(1);
}
console.log('🎉 反「事件池饥饿」守卫全部通过！没有任何职业路径在 H1 陷入单一事件饥饿。\n');
