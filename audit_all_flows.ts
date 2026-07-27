import { events, generateInitialState } from './src/data/events';
import { GameState, GameEvent, Choice } from './src/types';

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
  { ...generateInitialState(), visa: 'F1 (学生)', job_type: 'unemployed', age: 23, status: 'playing' },
  { ...generateInitialState(), visa: 'OPT (实习)', job_type: 'big_tech', company: 'Google', level: 'L3', age: 24, status: 'playing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'big_tech', company: 'Meta', level: 'L5', age: 28, status: 'playing', gc_stage: 'perm_processing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'startup', company: 'AI Startup', level: 'Senior', age: 29, status: 'playing', gc_stage: 'i140_approved' },
  { ...generateInitialState(), visa: '绿卡', job_type: 'big_tech', company: 'Apple', level: 'L6', age: 32, status: 'playing', gc_stage: 'approved', has_housing: true },
  { ...generateInitialState(), visa: '公民', job_type: 'ai_research', company: 'OpenAI', level: 'Staff', age: 30, status: 'playing', is_ssr_unlocked: true },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'unemployed', laid_off: true, age: 27, status: 'playing' },
  { ...generateInitialState(), visa: 'Day 1 CPT', job_type: 'startup', age: 26, status: 'playing' },
  { ...generateInitialState(), visa: 'L1 (外派)', job_type: 'big_tech', age: 27, status: 'playing' }
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

// Check Rule 2: Layoff check & unemployed state logic
for (const [id, ev] of Object.entries(events)) {
  if (id.includes('promo') || id.includes('perf_review') || id.includes('work_project')) {
    ev.choices.forEach((c, idx) => {
      const testLaidOff = { ...dummyStates[6] };
      if (!c.condition || c.condition(testLaidOff)) {
        logWarning('Unemployed At Work Event', id, `Work event choice ${idx} ('${c.text}') is accessible when player is laid off/unemployed! Missing condition for job_type != unemployed.`);
      }
    });
  }
}

// Check Rule 3: Priority Date / Green Card waiting speed vs Reality
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    dummyStates.forEach(st => {
      if (!c.condition || c.condition(st)) {
        try {
          const eff = c.effect(st);
          if (eff.gc_progress && eff.gc_progress > 5) {
            logWarning('GC Progress overflow', id, `Choice ${idx} sets gc_progress to ${eff.gc_progress} (>5)`);
          }
        } catch (e) {}
      }
    });
  });
}

// Check Rule 4: Financial numbers sanity check
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach((c, idx) => {
    dummyStates.forEach(st => {
      if (!c.condition || c.condition(st)) {
        try {
          const eff = c.effect(st);
          if (eff.tc !== undefined && (eff.tc < 0 || eff.tc > 5000)) {
            logIssue('Abnormal TC value', id, `Choice ${idx} ('${c.text}') sets TC to $${eff.tc}w (unusual TC range)`);
          }
          if (eff.rent !== undefined && (eff.rent < 0 || eff.rent > 100)) {
            logIssue('Abnormal Rent value', id, `Choice ${idx} ('${c.text}') sets annual rent to $${eff.rent}w`);
          }
        } catch (e) {}
      }
    });
  });
}

console.log(`\nAudit finished with ${issueCount} critical issues found.`);
