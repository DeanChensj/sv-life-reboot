import { events, generateInitialState, midYearEventRouter } from './src/data/events';
import { GameState, GameEvent, Choice } from './src/types';
import { applyStateTransition } from './src/utils/stateTransitions';
import { getJobDisplayInfo, getVisaDisplayInfo, getHousingDisplayInfo } from './src/utils/gameStateSelectors';

console.log(`=== SV LIFE REBOOT EVENT AUDIT ===`);
console.log(`Total events defined: ${Object.keys(events).length}`);

// 1. Collect all event IDs and classify them by category
const eventIds = Object.keys(events);
const categories: Record<string, string[]> = {};

eventIds.forEach(id => {
  const ev = events[id];
  let cat = 'Other';
  if (id.startsWith('choose_') || id.startsWith('init_')) cat = 'Initialization / Character Creation';
  else if (id.startsWith('job_') || id.includes('work') || id.includes('promo') || id.includes('layoff') || id.includes('company')) cat = 'Career / Work';
  else if (id.startsWith('visa_') || id.includes('h1b') || id.includes('opt') || id.includes('perm') || id.includes('green_card') || id.includes('cpt') || id.includes('l1')) cat = 'Immigration / Visa';
  else if (id.includes('house') || id.includes('rent') || id.includes('mortgage') || id.includes('buy_')) cat = 'Housing / Finance';
  else if (id.includes('love') || id.includes('date') || id.includes('marry') || id.includes('partner') || id.includes('single')) cat = 'Dating / Relationship';
  else if (id.includes('startup') || id.includes('founder') || id.includes('vc')) cat = 'Startup / Entrepreneurship';
  else if (id.includes('daily') || id.includes('year_end') || id.includes('settlement') || id.includes('random')) cat = 'System / Turn Settlement';
  
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push(id);
});

console.log('\n--- Event Categories Breakdown ---');
for (const [cat, ids] of Object.entries(categories)) {
  console.log(`${cat}: ${ids.length} events`);
}

// 2. Specific SV Realism & Logical Consistency Checks
console.log('\n--- Running Realism & Logic Audit Rules ---');

let issueCount = 0;
function logIssue(rule: string, eventId: string, details: string) {
  issueCount++;
  console.log(`❌ [${rule}] Event ID: '${eventId}' -> ${details}`);
}

function logWarning(rule: string, eventId: string, details: string) {
  console.log(`⚠️ [${rule}] Event ID: '${eventId}' -> ${details}`);
}

// Dummy base states to test conditions and choice outcomes
const dummyStates: GameState[] = [
  { ...generateInitialState(), visa: 'F1 (学生)', job_type: 'unemployed', tc: 0, age: 23, status: 'playing' },
  { ...generateInitialState(), visa: 'OPT (实习)', job_type: 'big_tech', company: 'Google', level: 'L3', tc: 22, age: 24, status: 'playing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'big_tech', company: 'Meta', level: 'L5 (Senior)', tc: 46, age: 28, status: 'playing', gc_stage: 'perm_processing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'startup', company: 'AI Startup', level: 'Senior', tc: 24, age: 29, status: 'playing', gc_stage: 'i140_approved' },
  { ...generateInitialState(), visa: '绿卡', job_type: 'big_tech', company: 'Apple', level: 'L6 (Staff)', tc: 65, age: 32, status: 'playing', gc_stage: 'approved', has_housing: true },
  { ...generateInitialState(), visa: '公民', job_type: 'ai_research', company: 'OpenAI', level: 'MTS', tc: 75, age: 30, status: 'playing', is_ssr_unlocked: true },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'unemployed', laid_off: true, tc: 0, age: 27, status: 'playing' },
  { ...generateInitialState(), visa: 'Day 1 CPT', job_type: 'startup', tc: 18, age: 26, status: 'playing' },
  { ...generateInitialState(), visa: 'L1 (外派)', job_type: 'big_tech', company: 'Google', level: 'L4', tc: 30, age: 27, status: 'playing' },
  { ...generateInitialState(), visa: '无', job_type: 'cn_tech', company: 'cn_big_tech', level: '国内研发', tc: 8, age: 24, status: 'playing' },
  { ...generateInitialState(), visa: '绿卡', job_type: 'startup_founder', company: 'AI Startup', level: 'CEO & Founder', founder_stage: 'seed', company_valuation: 800, tc: 10, age: 30, status: 'playing' },
  { ...generateInitialState(), visa: '公民', job_type: 'trader', company: '全职 Day Trader', level: '全职 Trader', tc: 0, age: 32, status: 'playing' }
];

// Check Rule 1: Citizens / Green Card holders subjected to visa lottery or deportation
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    const testCitizenState = { ...dummyStates[5] };
    if (!c.condition || c.condition(testCitizenState)) {
      try {
        const eff = c.effect(testCitizenState);
        if (eff.visa && eff.visa !== '公民' && eff.visa !== '绿卡') {
          logIssue('Citizen Visa Downgrade', id, `Choice ${idx} ('${c.text}') sets visa to ${eff.visa} for a US Citizen!`);
        }
      } catch (e) {}
    }

    const testGCState = { ...dummyStates[4] };
    if (!c.condition || c.condition(testGCState)) {
      try {
        const eff = c.effect(testGCState);
        if (eff.visa && eff.visa !== '绿卡' && eff.visa !== '公民') {
          logIssue('Green Card Visa Downgrade', id, `Choice ${idx} ('${c.text}') sets visa to ${eff.visa} for a Green Card holder!`);
        }
      } catch (e) {}
    }
  });
}

// Check Rule 2: Invariant enforcement via applyStateTransition across all choices
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    dummyStates.forEach(st => {
      if (!c.condition || c.condition(st)) {
        try {
          const eff = c.effect(st);
          const { nextState } = applyStateTransition(st, eff, { eventId: id });
          
          if (isNaN(nextState.health) || nextState.health < 0 || nextState.health > 100) {
            logIssue('Health Clamping Error', id, `Choice ${idx} produced invalid health: ${nextState.health}`);
          }
          if (isNaN(nextState.cash)) {
            logIssue('Cash NaN Error', id, `Choice ${idx} produced cash: NaN`);
          }
          if ((nextState.laid_off || nextState.job_type === 'unemployed') && nextState.tc > 0) {
            logIssue('Unemployment TC Violation', id, `Choice ${idx} left TC as ${nextState.tc} while unemployed!`);
          }
        } catch (e: any) {
          logIssue('Effect Runtime Exception', id, `Choice ${idx} threw error: ${e.message}`);
        }
      }
    });
  });
}

// Check Rule 3: Selector Consistency
dummyStates.forEach((st, idx) => {
  try {
    const jobInfo = getJobDisplayInfo(st);
    const visaInfo = getVisaDisplayInfo(st);
    const housingInfo = getHousingDisplayInfo(st);
    if (!jobInfo.companyLabel || !jobInfo.levelLabel || !visaInfo.visaLabel || !housingInfo.housingLabel) {
      logIssue('Selector Empty Field', `dummyState[${idx}]`, 'Selector returned empty label string');
    }
  } catch (e: any) {
    logIssue('Selector Exception', `dummyState[${idx}]`, e.message);
  }
});

// Check Rule 3.5: Role & Corporate Context Isolation (Prevent Founder/Trader from seeing corporate employer choices)
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    // Non-employee states: Founder, Trader, Unemployed
    const nonEmployees = dummyStates.filter(s => s.job_type === 'startup_founder' || s.job_type === 'trader' || s.job_type === 'unemployed' || s.laid_off);
    for (const neState of nonEmployees) {
      if (!c.condition || c.condition(neState)) {
        const text = c.text || '';
        if (text.includes('找现任老板谈薪') || text.includes('原地 Match') || text.includes('留任原厂')) {
          logIssue('Role Context Mismatch', id, `Choice ${idx} ('${text}') is visible to non-employee role '${neState.job_type}'!`);
        }
      }
    }
  });
}

// Check Rule 3.6: Level & Compensation Realism Invariant Audit
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    dummyStates.forEach(st => {
      if (!c.condition || c.condition(st)) {
        try {
          const eff = c.effect(st);
          const nextState = { ...st, ...eff };
          if (!nextState.laid_off && nextState.job_type === 'big_tech') {
            const lvl = nextState.level;
            const tc = nextState.tc;
            if (lvl === 'L3' && (tc < 15 || tc > 35)) {
              logIssue('TC Realism Anomaly', id, `Choice ${idx} resulted in L3 with TC $${tc}w`);
            }
            if (lvl === 'L4' && (tc < 24 || tc > 45)) {
              logIssue('TC Realism Anomaly', id, `Choice ${idx} resulted in L4 with TC $${tc}w`);
            }
            if ((lvl === 'L5' || lvl === 'L5 (Senior)') && (tc < 35 || tc > 65)) {
              logIssue('TC Realism Anomaly', id, `Choice ${idx} resulted in L5 Senior with TC $${tc}w`);
            }
            if ((lvl === 'L6' || lvl === 'L6 (Staff)') && (tc < 50 || tc > 90)) {
              logIssue('TC Realism Anomaly', id, `Choice ${idx} resulted in L6 Staff with TC $${tc}w`);
            }
            if ((lvl === 'L7' || lvl === 'L7 (Senior Staff)') && (tc < 75 || tc > 140)) {
              logIssue('TC Realism Anomaly', id, `Choice ${idx} resulted in L7 Senior Staff with TC $${tc}w`);
            }
          }
        } catch (e) {}
      }
    });
  });
}

import fs from 'fs';

// =========================================================================
// Check Rule 4: Reachability and Orphan/Island Events Detector (Graph Traversal)
// =========================================================================
console.log('\n--- Checking Event Reachability & Orphan Graph ---');

// Build the set of all known entry roots (starting events, routers, narrative flags, modals)
const reachableEvents = new Set<string>([
  'choose_trait',
  'choose_year',
  'choose_school',
  'sv_daily_life',
  // 商城 (ShopModal) 里通过 onTriggerEvent 触发的面板 —— 它们不经事件图的 nextEventId 到达,
  // 而是常驻 HUD 商城弹窗随时可开,故与 manage_rental_properties 一样显式列为可达根。
  'manage_rental_properties',
  'change_rental',
  'fire_milestone_choice',
  'choose_housing',
  'end',
]);

// 1. Scan routers for all possible returned event IDs
const routerTestStates: GameState[] = [
  ...dummyStates,
  { ...dummyStates[0], age: 24, year: 2020, leetcode: 30, story_flags: { met_sam: true } },
  { ...dummyStates[1], age: 25, year: 2021, story_flags: { met_alex: true, alex_meet_year: 2019 } },
  { ...dummyStates[2], age: 29, year: 2022, story_flags: { has_dave_evidence: true, dave_conflict_year: 2020 } },
  { ...dummyStates[2], age: 31, year: 2024, level: 'L6 (Staff)', story_flags: { dave_defeated: true, dave_defeated_year: 2021 } },
  { ...dummyStates[2], company: 'meta', season_stage: 'h1' },
  { ...dummyStates[4], company: 'apple', season_stage: 'h1' },
  { ...dummyStates[2], stocks: 50, company: 'nvidia', season_stage: 'h1' },
  { ...dummyStates[4], is_married: true, season_stage: 'h2' },
  { ...dummyStates[4], car: 'porsche', season_stage: 'h2' },
  { ...dummyStates[4], car: 'cybertruck', season_stage: 'h2' },
  { ...dummyStates[4], has_housing: true, housing_name: 'Sunnyvale 老破小', season_stage: 'h2' },
  { ...dummyStates[4], cash: 120, season_stage: 'h2' },
];

routerTestStates.forEach(st => {
  try {
    const routed = midYearEventRouter(st);
    if (routed && events[routed]) reachableEvents.add(routed);
  } catch (e) {}
});

// Also scan source code for event IDs referenced in router functions and workEvents / lifeEvents arrays.
// NOTE: events live in the modular `src/data/events/` directory now; `events.ts` is just a
// 2-line re-export proxy, so reading it made this whole scan a no-op. Concatenate every module
// (helpers.ts holds the routers + workEvents/lifeEvents arrays) so the source scan works again.
const eventsDir = './src/data/events';
const extraDataFiles = ['./src/data/companyProfiles.ts', './src/data/schoolProfiles.ts'];
const eventsSource = [
  ...fs.readdirSync(eventsDir).filter((f) => f.endsWith('.ts')).map((f) => fs.readFileSync(`${eventsDir}/${f}`, 'utf8')),
  ...extraDataFiles.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8'))
].join('\n');

// Extract all event IDs in router event-pool arrays. Besides the top-level
// workEvents/lifeEvents arrays, the job-specific routers build local weighted
 // pools (aiPool / startupPool …) with `const xxxPool = [...]` and
 // `xxxPool.push(...)`, then `return gamePick(pool)`. Those literals are just as
 // deterministically reachable as workEvents.push(...), so recognize any
 // `<name>Pool` array/push too — otherwise ai_research_crisis / startup_crisis show
// up as probabilistic false-positive orphans depending on gameRandom ordering.
const routerEventRegex = /(?:workEvents|lifeEvents|\w*Pool)\.push\(([^)]+)\)|const\s+(?:workEvents|lifeEvents|\w*Pool)\s*=\s*\[([^\]]+)\]/g;
let match: RegExpExecArray | null;
while ((match = routerEventRegex.exec(eventsSource)) !== null) {
  const content = match[1] || match[2];
  if (content) {
    const ids = content.match(/['"`]([a-zA-Z0-9_]+)['"`]/g) || [];
    ids.forEach(rawId => {
      const cleanId = rawId.replace(/['"`]/g, '');
      if (events[cleanId]) reachableEvents.add(cleanId);
    });
  }
}

const routerReturnedEventMatches = eventsSource.match(/return\s+['"`]([a-zA-Z0-9_]+)['"`]/g) || [];
routerReturnedEventMatches.forEach(m => {
  const match = m.match(/['"`]([a-zA-Z0-9_]+)['"`]/);
  if (match && events[match[1]]) {
    reachableEvents.add(match[1]);
  }
});

// Routers also branch via ternary returns, e.g.
//   return gameRandom() < 0.6 ? 'news_neutral_market' : 'news_bear_market_crash';
// The `return '<literal>'` scan above misses these (there's an expression between
// `return` and the first quote), so the macro-economy news events could only be
// caught by the probabilistic runtime router calls — flaky orphans. Any event id
// appearing as a `? 'a' : 'b'` ternary branch in the router source is genuinely
// reachable, so recognize both branches deterministically.
const ternaryBranchMatches = eventsSource.match(/\?\s*['"`][a-zA-Z0-9_]+['"`]\s*:\s*['"`][a-zA-Z0-9_]+['"`]/g) || [];
ternaryBranchMatches.forEach(m => {
  const ids = m.match(/['"`]([a-zA-Z0-9_]+)['"`]/g) || [];
  ids.forEach(rawId => {
    const cleanId = rawId.replace(/['"`]/g, '');
    if (events[cleanId]) reachableEvents.add(cleanId);
  });
});

const signatureMatches = eventsSource.match(/signatureEvent:\s*['"`]([a-zA-Z0-9_]+)['"`]/g) || [];
signatureMatches.forEach(m => {
  const match = m.match(/['"`]([a-zA-Z0-9_]+)['"`]/);
  if (match && events[match[1]]) {
    reachableEvents.add(match[1]);
  }
});

// Add all test states with various flags (e.g. is_phd, laid_off, single, married)
const richTestStates: GameState[] = [
  ...routerTestStates,
  { ...dummyStates[0], is_phd: true, school: 'cmu' },
  { ...dummyStates[1], is_phd: true },
  { ...dummyStates[2], laid_off: true, job_type: 'unemployed' },
  { ...dummyStates[4], parents_helped_house: true },
  { ...dummyStates[4], has_housing: false, housing_name: '普通合租单间' },
  { ...dummyStates[0], visa: 'F1 (学生)' },
  { ...dummyStates[1], visa: 'OPT (实习)' },
  { ...dummyStates[2], visa: 'H1B (工签)' },
  { ...dummyStates[3], visa: 'Day 1 CPT' },
  { ...dummyStates[4], visa: '绿卡' },
  { ...dummyStates[5], visa: '公民' },
];

// 2. BFS graph traversal to expand reachable events from all choice nextEventId links
const queue = Array.from(reachableEvents);
while (queue.length > 0) {
  const currentId = queue.shift()!;
  const ev = events[currentId];
  if (!ev || !ev.choices) continue;

  for (const choice of ev.choices) {
    let targets: string[] = [];
    if (typeof choice.nextEventId === 'string') {
      targets.push(choice.nextEventId);
    } else if (typeof choice.nextEventId === 'function') {
      // 1) Evaluate against diverse state permutations
      richTestStates.forEach(st => {
        try {
          const res = (choice.nextEventId as (s: GameState) => string)(st);
          if (res) targets.push(res);
          const resHawai = (choice.nextEventId as (s: GameState) => string)({ ...st, message: '夏威夷' });
          if (resHawai) targets.push(resHawai);
        } catch (e) {}
      });

      // 2) Parse function body for string literals that look like event IDs
      const fnStr = choice.nextEventId.toString();
      const fnMatches = fnStr.match(/['"`]([a-zA-Z0-9_]+)['"`]/g) || [];
      fnMatches.forEach(raw => {
        const id = raw.replace(/['"`]/g, '');
        if (events[id]) targets.push(id);
      });
    }

    for (const target of targets) {
      if (events[target] && !reachableEvents.has(target)) {
        reachableEvents.add(target);
        queue.push(target);
      }
    }
  }
}

// 3. Detect unvisited orphan / island events
let orphanCount = 0;
for (const id of Object.keys(events)) {
  if (!reachableEvents.has(id)) {
    orphanCount++;
    logWarning('Orphan Island Event', id, `Event '${id}' is defined but cannot be reached from any valid entry point or router.`);
  }
}
console.log(`Reachability analysis completed: ${reachableEvents.size}/${Object.keys(events).length} events reachable (${orphanCount} orphans).`);

// =========================================================================
// Check Rule 5: Copywriting Quality, Currency Numbers & Emoji Compliance
// =========================================================================
console.log('\n--- Checking Copywriting Compliance & Text Quality ---');

// Regular expression to detect emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

// Regular expression to detect broken currency placeholders (e.g. "花费 w", "出资 w", "消耗 .5w")
const brokenCurrencyRegex = /(?:花费|消耗|出资|收益|净赚|入账|获得|亏损|损失|年供)\s*(?:[^\$0-9w\s]*)(?:(?<![0-9\.\$])w\b|(?<![0-9\$])\.5w\b)/;

// Regular expression to detect explicit leaks of hidden stats (Charm / Network / Luck) with numbers or operators
const hiddenStatLeakRegex = /(?:人脉|魅力|运气|气运|幸运值|人脉值|魅力值)\s*(?:[≥≤><=]|[\+\-]\s*\d+|\b\d+\b)/;

for (const [id, ev] of Object.entries(events)) {
  // 1. Check title & description
  if (emojiRegex.test(ev.title)) {
    logIssue('Copywriting Emoji Violation', id, `Title contains emojis: "${ev.title}"`);
  }
  if (emojiRegex.test(ev.description)) {
    logIssue('Copywriting Emoji Violation', id, `Description contains emojis: "${ev.description}"`);
  }
  if (brokenCurrencyRegex.test(ev.title) || brokenCurrencyRegex.test(ev.description)) {
    logIssue('Broken Currency Placeholder', id, `Title or description contains broken currency string.`);
  }
  if (hiddenStatLeakRegex.test(ev.title) || hiddenStatLeakRegex.test(ev.description)) {
    logIssue('Hidden Stat Leak Violation', id, `Title or description explicitly leaked hidden stat numbers.`);
  }

  // 2. Check all choices text, reqBadge, costBadge, and effect message
  ev.choices.forEach((c, idx) => {
    if (c.text && emojiRegex.test(c.text)) {
      logIssue('Copywriting Emoji Violation', id, `Choice ${idx} text contains emojis: "${c.text}"`);
    }
    if (c.reqBadge && emojiRegex.test(c.reqBadge)) {
      logIssue('Copywriting Emoji Violation', id, `Choice ${idx} reqBadge contains emojis: "${c.reqBadge}"`);
    }
    if (c.costBadge && emojiRegex.test(c.costBadge)) {
      logIssue('Copywriting Emoji Violation', id, `Choice ${idx} costBadge contains emojis: "${c.costBadge}"`);
    }
    if (c.text && brokenCurrencyRegex.test(c.text)) {
      logIssue('Broken Currency Placeholder', id, `Choice ${idx} text contains missing currency figure: "${c.text}"`);
    }
    if (c.reqBadge && hiddenStatLeakRegex.test(c.reqBadge)) {
      logIssue('Hidden Stat Leak Violation', id, `Choice ${idx} reqBadge leaked hidden stat numbers: "${c.reqBadge}"`);
    }
    if (c.text && hiddenStatLeakRegex.test(c.text)) {
      logIssue('Hidden Stat Leak Violation', id, `Choice ${idx} text leaked hidden stat numbers: "${c.text}"`);
    }

    // Check placeholder / NaN text
    const textToCheck = `${c.text} ${c.reqBadge || ''} ${c.costBadge || ''}`;
    if (textToCheck.includes('NaN') || textToCheck.includes('undefined') || textToCheck.includes('[object Object]')) {
      logIssue('Template Placeholder Artifact', id, `Choice ${idx} contains literal NaN or undefined.`);
    }

    // Test effect messages
    routerTestStates.forEach(st => {
      if (!c.condition || c.condition(st)) {
        try {
          const eff = c.effect(st);
          if (eff.message && emojiRegex.test(eff.message)) {
            logIssue('Copywriting Emoji Violation', id, `Choice ${idx} message contains emojis: "${eff.message}"`);
          }
          if (eff.message && hiddenStatLeakRegex.test(eff.message)) {
            logIssue('Hidden Stat Leak Violation', id, `Choice ${idx} message leaked hidden stat numbers: "${eff.message}"`);
          }
          if (eff.message && (eff.message.includes('NaN') || eff.message.includes('undefined') || eff.message.includes('[object Object]'))) {
            logIssue('Template Placeholder Artifact', id, `Choice ${idx} message contains NaN or undefined: "${eff.message}"`);
          }
        } catch (e) {}
      }
    });
  });
}

console.log(`\nAudit finished with ${issueCount} critical issues found.`);
if (issueCount > 0) {
  process.exit(1);
}

