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
  { ...generateInitialState(), visa: 'F1 (学生)', job_type: 'unemployed', age: 23, status: 'playing' },
  { ...generateInitialState(), visa: 'OPT (实习)', job_type: 'big_tech', company: 'Google', level: 'L3', age: 24, status: 'playing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'big_tech', company: 'Meta', level: 'L5', age: 28, status: 'playing', gc_stage: 'perm_processing' },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'startup', company: 'AI Startup', level: 'Senior', age: 29, status: 'playing', gc_stage: 'i140_approved' },
  { ...generateInitialState(), visa: '绿卡', job_type: 'big_tech', company: 'Apple', level: 'L6', age: 32, status: 'playing', gc_stage: 'approved', has_housing: true },
  { ...generateInitialState(), visa: '公民', job_type: 'ai_research', company: 'OpenAI', level: 'Staff', age: 30, status: 'playing', is_ssr_unlocked: true },
  { ...generateInitialState(), visa: 'H1B (工签)', job_type: 'unemployed', laid_off: true, age: 27, status: 'playing' },
  { ...generateInitialState(), visa: 'Day 1 CPT', job_type: 'startup', age: 26, status: 'playing' },
  { ...generateInitialState(), visa: 'L1 (外派)', job_type: 'big_tech', age: 27, status: 'playing' },
  { ...generateInitialState(), visa: '无', job_type: 'cn_tech', company: 'cn_big_tech', age: 24, status: 'playing' }
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

import fs from 'fs';

// Check Rule 4: Reachability and Orphan Events Detector
const referencedEvents = new Set<string>(['choose_trait', 'end', 'fire_milestone_choice', 'manage_rental_properties']);

// Gather nextEventIds from choices
for (const [id, ev] of Object.entries(events)) {
  ev.choices.forEach(c => {
    if (typeof c.nextEventId === 'string') {
      referencedEvents.add(c.nextEventId);
    } else if (typeof c.nextEventId === 'function') {
      dummyStates.forEach(st => {
        try {
          const target = (c.nextEventId as (s: GameState) => string)(st);
          if (target) referencedEvents.add(target);
        } catch (e) {}
      });
    }
  });
}

// Check router reachability
dummyStates.forEach(st => {
  try {
    const routed = midYearEventRouter(st);
    if (routed) referencedEvents.add(routed);
  } catch (e) {}
});

const eventsSource = fs.readFileSync('./src/data/events.ts', 'utf8');
const appSource = fs.readFileSync('./src/App.tsx', 'utf8');
const shopSource = fs.readFileSync('./src/components/ShopModal.tsx', 'utf8');
const allCode = eventsSource + '\n' + appSource + '\n' + shopSource;

for (const id of Object.keys(events)) {
  const regex = new RegExp(`['"\`]${id}['"\`]`, 'g');
  const matches = allCode.match(regex) || [];
  if (matches.length <= 2 && !referencedEvents.has(id)) {
    logWarning('Unreferenced Event / Potential Orphan', id, `Event '${id}' appears to be defined without router/choice callers.`);
  }
}

console.log(`\nAudit finished with ${issueCount} critical issues found.`);
if (issueCount > 0) {
  process.exit(1);
}

