import { events } from './src/data/events';

let errors = 0;
const validIds = new Set(Object.keys(events));

// Check all nextEventIds
for (const [id, event] of Object.entries(events)) {
  for (let i = 0; i < event.choices.length; i++) {
    const choice = event.choices[i];
    
    if (typeof choice.nextEventId === 'string') {
      if (!validIds.has(choice.nextEventId)) {
        console.error(`❌ [${id}] Choice ${i} has invalid nextEventId string: ${choice.nextEventId}`);
        errors++;
      }
    } else if (typeof choice.nextEventId === 'function') {
       // We can't statically check function returns for all states easily, but we can verify it doesn't crash on empty state
       try {
         // Create some dummy states to test the function
         const states = [
           { status: 'playing' },
           { status: 'win' },
           { laid_off: true },
           { visa: '绿卡' },
           { ap: 0 },
           { ap: 3 },
           { has_housing: true },
           { message: '晋升' },
           { message: '夏威夷' },
         ];
         for (const s of states) {
           const nextId = choice.nextEventId(s as any);
           if (!validIds.has(nextId) && nextId !== 'sv_year_end_settlement') {
             // sv_year_end_settlement is valid
             // actually it should be in validIds
             if (!validIds.has(nextId)) {
               console.error(`❌ [${id}] Choice ${i} function returned invalid nextEventId: ${nextId} with state ${JSON.stringify(s)}`);
               errors++;
             }
           }
         }
       } catch (e) {
         console.error(`❌ [${id}] Choice ${i} nextEventId function threw an error:`, e);
         errors++;
       }
    }
  }
}

if (errors === 0) {
  console.log('✅ 所有 nextEventId 指向全部合法，没有死胡同！');
} else {
  console.log(`❌ 发现 ${errors} 个路由错误！`);
}

