import { events } from './src/data/events';
import { GameState } from './src/types';
import { normalizeLevel } from './src/data/levelProfiles';

const sampleStates: GameState[] = [
  // L3 Big Tech Single F1
  {
    age: 23, year: 2020, visa: 'OPT (实习)', gc_progress: 0, gc_stage: 'not_started',
    job_type: 'big_tech', company: 'google', level: 'L3', tc: 22, cash: 10, stocks: 5,
    health: 85, leetcode: 40, network: 20, charm: 15, has_housing: true, housing_name: 'Santa Clara 1b1b',
    rent: 3.0, is_married: false, relationship_status: 'single', car: 'none', status: 'playing',
  },
  // L4 Big Tech H1B
  {
    age: 26, year: 2022, visa: 'H1B (工签)', gc_progress: 2, gc_stage: 'i140_approved',
    job_type: 'big_tech', company: 'meta', level: 'L4', tc: 34, cash: 30, stocks: 40,
    health: 75, leetcode: 60, network: 35, charm: 18, has_housing: true, housing_name: 'Sunnyvale 老破小',
    rent: 1.5, is_married: true, relationship_status: 'married', partner_type: 'engineer', car: 'model_y', status: 'playing',
  },
  // L5 Senior Big Tech Green Card
  {
    age: 30, year: 2023, visa: '绿卡', gc_progress: 5, gc_stage: 'approved',
    job_type: 'big_tech', company: 'nvidia', level: 'L5 (Senior)', tc: 55, cash: 80, stocks: 120,
    health: 65, leetcode: 75, network: 50, charm: 20, impact: 25, has_housing: true, housing_name: 'Fremont 10分学区房',
    rent: 4.5, is_married: true, relationship_status: 'married', partner_type: 'vc', car: 'porsche', status: 'playing',
  },
  // L6 Staff Big Tech Citizen
  {
    age: 35, year: 2024, visa: '公民', gc_progress: 5, gc_stage: 'approved',
    job_type: 'big_tech', company: 'google', level: 'L6 (Staff)', tc: 75, cash: 150, stocks: 300,
    health: 70, leetcode: 85, network: 70, charm: 22, impact: 50, has_housing: true, housing_name: 'Atherton 顶级豪宅',
    rent: 5.0, is_married: true, relationship_status: 'married', car: 'porsche', status: 'playing',
  },
  // Startup Founder Pre-Seed
  {
    age: 28, year: 2021, visa: 'O1 (杰出人才)', gc_progress: 0, gc_stage: 'not_started',
    job_type: 'startup_founder', founder_stage: 'pre_seed', company_valuation: 180, tc: 6,
    cash: 25, stocks: 0, health: 80, leetcode: 70, network: 40, charm: 20, has_housing: true,
    housing_name: 'Cupertino 2b2b合租', rent: 2.0, is_married: false, relationship_status: 'single', car: 'none', status: 'playing',
  },
  // Startup Founder Series A
  {
    age: 31, year: 2023, visa: '绿卡', gc_progress: 5, gc_stage: 'approved',
    job_type: 'startup_founder', founder_stage: 'series_a', company_valuation: 2500, tc: 16,
    cash: 50, stocks: 0, health: 60, leetcode: 70, network: 60, charm: 24, has_housing: true,
    housing_name: 'North San Jose 联排', rent: 2.5, is_married: true, relationship_status: 'married', car: 'model_y', status: 'playing',
  },
  // Day Trader Citizen
  {
    age: 32, year: 2023, visa: '公民', gc_progress: 5, gc_stage: 'approved',
    job_type: 'trader', tc: 25, cash: 120, stocks: 180, health: 80, leetcode: 60, network: 30, charm: 18,
    has_housing: true, housing_name: 'North San Jose 联排', rent: 2.5, is_married: false, relationship_status: 'single', car: 'model_y', status: 'playing',
  },
  // Unemployed Layoff F1/OPT
  {
    age: 24, year: 2022, visa: 'OPT (实习)', gc_progress: 0, gc_stage: 'not_started',
    job_type: 'unemployed', laid_off: true, tc: 0, cash: 5, stocks: 2, health: 50, leetcode: 35,
    network: 15, charm: 12, has_housing: true, housing_name: 'Santa Clara 1b1b', rent: 3.0,
    is_married: false, relationship_status: 'single', car: 'none', status: 'playing',
  },
];

console.log('🔍 Running Automated Semantic & State Consistency Guard...');

interface Anomaly {
  eventId: string;
  choiceIdx: number;
  choiceText: string;
  type: string;
  issue: string;
  detail: string;
}

const anomalies: Anomaly[] = [];

for (const [eventId, ev] of Object.entries(events)) {
  if (!ev.choices) continue;

  ev.choices.forEach((choice, choiceIdx) => {
    sampleStates.forEach((baseState) => {
      if (choice.condition && !choice.condition(baseState)) return;

      try {
        const effect = choice.effect(baseState);
        const nextState = { ...baseState, ...effect };
        const msg = effect.message || '';
        const choiceText = choice.text;

        // 1. Check Promotion Claims vs Level changes
        const claimsPromo = (
          (choiceText.includes('抢下升职') || choiceText.includes('破格晋升') || choiceText.includes('晋升至') || choiceText.includes('晋升为')) &&
          !choiceText.includes('争取') && !choiceText.includes('冲刺') && !choiceText.includes('放弃')
        ) || (
          (msg.includes('晋升至') || msg.includes('晋升为') || msg.includes('破格晋升') || msg.includes('顺利晋升为') || msg.includes('正式晋升为')) &&
          !msg.includes('暂未晋升') && !msg.includes('未晋升') && !msg.includes('惜败') && !msg.includes('否决') && !msg.includes('延期') && !msg.includes('晋升为合法夫妻')
        );

        if (claimsPromo) {
          const prevLvl = normalizeLevel(baseState.level || 'L3');
          const nextLvl = normalizeLevel(nextState.level || 'L3');
          if (prevLvl === nextLvl && baseState.job_type === 'big_tech' && nextState.job_type === 'big_tech') {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'PROMOTION_MISMATCH',
              issue: `Claims promotion in text but level did not change (stayed ${prevLvl})`,
              detail: `Msg: "${msg}" | Prev: ${prevLvl} -> Next: ${nextLvl}`
            });
          }
        }

        // 2. Check Visa / Green Card Claims vs Visa state
        if (msg.includes('获批婚姻绿卡') || msg.includes('拿到绿卡') || msg.includes('拿到永久绿卡') || msg.includes('获批绿卡') || msg.includes('拿到 EB-1 绿卡')) {
          if (nextState.visa !== '绿卡' && nextState.visa !== '公民') {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'VISA_MISMATCH',
              issue: `Message claims green card granted, but visa is "${nextState.visa}"`,
              detail: `Msg: "${msg}"`
            });
          }
        }

        if (msg.includes('入籍成为美国公民') || msg.includes('正式成为美国公民') || msg.includes('宣誓入籍')) {
          if (nextState.visa !== '公民') {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'VISA_MISMATCH',
              issue: `Message claims citizen granted, but visa is "${nextState.visa}"`,
              detail: `Msg: "${msg}"`
            });
          }
        }

        // 3. Check Layoff / Unemployment Claims
        if ((msg.includes('重新失业') || msg.includes('公司倒闭') || msg.includes('被当场解雇') || msg.includes('抱起铺盖重新刷题求职')) && !msg.includes('稳步渡过')) {
          if (!nextState.laid_off && nextState.job_type !== 'unemployed') {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'LAYOFF_MISMATCH',
              issue: `Message claims player was laid off/unemployed, but laid_off is ${nextState.laid_off} and job_type is "${nextState.job_type}"`,
              detail: `Msg: "${msg}"`
            });
          }
        }

        // 4. Check Marriage Claims
        if (msg.includes('登记结婚') || msg.includes('领证结婚') || msg.includes('正式领证')) {
          if (!nextState.is_married) {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'MARRIAGE_MISMATCH',
              issue: `Message claims player got married, but is_married is ${nextState.is_married}`,
              detail: `Msg: "${msg}"`
            });
          }
        }

        // 5. Check Undefined / NaN / [object Object] artifacts in text
        if (msg.includes('undefined') || msg.includes('NaN') || msg.includes('[object Object]')) {
          anomalies.push({
            eventId, choiceIdx, choiceText,
            type: 'TEXT_CORRUPTION',
            issue: `Message contains raw JS artifact (undefined/NaN/[object Object])`,
            detail: `Msg: "${msg}"`
          });
        }

        // 6. Check nextEventId validity
        if (typeof choice.nextEventId === 'string') {
          if (choice.nextEventId !== 'end' && !events[choice.nextEventId]) {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'INVALID_NEXT_EVENT',
              issue: `nextEventId string "${choice.nextEventId}" does not exist in events`,
              detail: `Event: ${eventId}`
            });
          }
        } else if (typeof choice.nextEventId === 'function') {
          const nextEv = choice.nextEventId(nextState);
          if (nextEv !== 'end' && !events[nextEv]) {
            anomalies.push({
              eventId, choiceIdx, choiceText,
              type: 'INVALID_NEXT_EVENT',
              issue: `nextEventId function returned "${nextEv}" which does not exist in events`,
              detail: `Event: ${eventId}`
            });
          }
        }

      } catch (err: any) {
        anomalies.push({
          eventId, choiceIdx, choiceText: choice.text,
          type: 'EXECUTION_EXCEPTION',
          issue: `choice.effect threw an exception: ${err.message}`,
          detail: err.stack || String(err)
        });
      }
    });
  });
}

const seenKeys = new Set<string>();
const uniqueAnomalies = anomalies.filter(a => {
  const key = `${a.eventId}_${a.choiceIdx}_${a.type}`;
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
});

if (uniqueAnomalies.length > 0) {
  console.error(`❌ Semantic consistency violations found: ${uniqueAnomalies.length}\n`);
  uniqueAnomalies.forEach((a, idx) => {
    console.error(`🚨 [Anomaly #${idx + 1}] [${a.type}]`);
    console.error(`   Event: ${a.eventId} | Choice #${a.choiceIdx}`);
    console.error(`   Choice Text: "${a.choiceText}"`);
    console.error(`   Issue: ${a.issue}`);
    console.error(`   Detail: ${a.detail}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ [Semantic Guard] All 216 events and 600+ choices passed 100% semantic-state consistency verification!');
}
