// Guard against the "a copy change silently breaks a test-bot navigation matcher" bug class.
//
// The GATE harnesses (Monte Carlo balance + runtime coverage) navigate the event graph by
// matching choice TEXT — `c.text.includes('X')` and `/A|B/.test(c.text)`. When a copy PR
// renames a choice, the matcher silently stops matching, the bot mis-navigates, and a GATE
// number drifts WITHOUT any test going red. This actually bit us: renaming the founder
// defensive lever 苟活 -> 断臂求生 drifted Monte Carlo FIRE 28.8% -> 38.8%, grazing the 39%
// ceiling, and was nearly missed.
//
// This guard reads each harness's SOURCE, auto-extracts every text matcher it uses, and
// asserts each still resolves to >=1 registered choice. Zero manual sync: whatever a harness
// looks for, this verifies still exists. A stale matcher fails loudly HERE (a precise, cheap
// signal) instead of silently skewing a statistical gate.
//
// Grouping: multiple `.text.includes(...)` literals on ONE line are treated as a disjunction
// (the harness pattern `find(c => c.text.includes('A') || c.text.includes('B'))` only needs
// ONE to hit), so it passes if ANY literal matches. Each `/re/.test(...text)` is its own
// matcher (the regex already encodes its own alternation).

import fs from 'fs';
import { events } from './src/data/events';

const HARNESSES = ['test_monte_carlo_balance.ts', 'test_runtime_coverage.ts'];

// Every choice text currently in the event registry.
const allTexts: string[] = [];
for (const ev of Object.values(events)) {
  for (const c of (ev as { choices?: { text?: string }[] }).choices || []) {
    if (typeof c.text === 'string') allTexts.push(c.text);
  }
}

type Matcher = { file: string; line: number; kind: 'includes-group' | 'regex'; label: string; test: () => boolean };
const matchers: Matcher[] = [];

for (const file of HARNESSES) {
  const src = fs.readFileSync(`./${file}`, 'utf8');
  src.split('\n').forEach((raw: string, i: number) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments

    // 1) Disjunction of `.text.includes('literal')` on this line -> pass if ANY hits.
    const literals = [...raw.matchAll(/\.text\.includes\('([^']+)'\)/g)].map((m) => m[1]);
    if (literals.length) {
      matchers.push({
        file,
        line: i + 1,
        kind: 'includes-group',
        label: literals.map((l) => `'${l}'`).join(' | '),
        test: () => literals.some((lit) => allTexts.some((t) => t.includes(lit))),
      });
    }

    // 2) Each `/re/.test(<var>.text)` -> pass if the regex hits any choice.
    for (const m of raw.matchAll(/(\/[^/\n]+\/)\.test\([a-zA-Z_]+\.text\)/g)) {
      const body = m[1].slice(1, -1);
      let re: RegExp | null = null;
      try {
        re = new RegExp(body);
      } catch {
        re = null;
      }
      matchers.push({
        file,
        line: i + 1,
        kind: 'regex',
        label: m[1],
        test: () => re != null && allTexts.some((t) => re!.test(t)),
      });
    }
  });
}

const stale = matchers.filter((mt) => !mt.test());

console.log(`=== [Harness Matcher Hygiene] test-bot navigation matchers ===`);
console.log(
  `Scanned ${HARNESSES.length} gate harness(es); extracted ${matchers.length} text matcher(s) against ${allTexts.length} live choices.`,
);

if (stale.length) {
  console.error(
    `\n❌ ${stale.length} stale matcher(s) — the choice text the test bot navigates by no longer exists:`,
  );
  for (const s of stale) console.error(`   ${s.file}:${s.line}  [${s.kind}] ${s.label}`);
  console.error(
    `\n   A copy change renamed a choice out from under a gate harness. This would let the bot\n` +
      `   mis-navigate and silently drift a balance/coverage gate. Fix by either restoring the\n` +
      `   keyword in the choice text, or updating the harness matcher to the new wording.`,
  );
  process.exit(1);
}

console.log(`✅ All ${matchers.length} harness navigation matchers still resolve to a live choice.`);
