// Guard test against the recurring "route/branch on a message substring" bug class.
//
// Deciding control flow (nextEventId) or achievement unlocks from `message.includes('X')`
// is fragile: a non-target outcome's message can also contain X (false positive) or the
// target message may not (false negative). This has bitten us repeatedly (promotion
// celebration on a rejection, unobtainable gamble achievements, etc.). Prefer routing on
// STATE fields (level / last_promo_age / visa / status / story_flags).
//
// This is a RATCHET: it fails if the number of message-substring routings goes UP.
// When you refactor one to state-based, LOWER the baseline below. Never raise it.

import fs from 'fs';

const EVENTS_DIR = './src/data/events';
const BASELINE = 12; // known message-substring routings remaining (2026-08); only ever decrease.

let count = 0;
const hits: string[] = [];

for (const file of fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith('.ts'))) {
  const src = fs.readFileSync(`${EVENTS_DIR}/${file}`, 'utf8');
  src.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments
    // A message value being fed to .includes(...) on the same line.
    if (/(s\.message|message \|\| ''|\bmsg\b)[^\n]*\.includes\(/.test(line)) {
      count++;
      hits.push(`${file}:${i + 1}  ${trimmed.slice(0, 100)}`);
    }
  });
}

console.log(`=== [Routing Guard] message-substring control flow ===`);
console.log(`Found ${count} message.includes routing site(s) in ${EVENTS_DIR} (baseline ${BASELINE}).`);

if (count > BASELINE) {
  console.error(
    `\n❌ [ROUTING GUARD] message-substring routing increased ${BASELINE} -> ${count}.\n` +
      `   Do NOT branch/route on message text — a non-target outcome can contain the same\n` +
      `   substring. Route on a STATE field instead (level / last_promo_age / visa / status /\n` +
      `   story_flags). New/offending sites:\n` +
      hits.map((h) => `     - ${h}`).join('\n'),
  );
  process.exit(1);
}

if (count < BASELINE) {
  console.warn(
    `\n⚠️  Nice — message-substring routing dropped ${BASELINE} -> ${count}. ` +
      `Please lower BASELINE in test_routing_guards.ts to ${count} to lock in the win.`,
  );
}

console.log(`✅ [Routing Guard] No new message-substring routing introduced.\n`);
