// STORY-FLAGS HYGIENE GUARD — ratchets the "set but never checked" bug class.
//
// The ICU bug (a once-per-life flag that was written but never read → the event silently
// recurred as a paid-heal engine) is a whole CLASS: a story_flag assigned in an effect but
// never consumed anywhere. This guard statically cross-references every story_flags write
// against reads and FAILS if a newly-written flag is never read — so the next ICU-class slip
// breaks the build instead of shipping.
//
// Preferred fix when this fails: use the unified once-per-life base (GameEvent.oncePerLife +
// helpers.hasSeen/markSeen) instead of a bespoke flag, or actually consume the flag. Only add
// to KNOWN_UNREAD if the flag is a deliberate breadcrumb (recorded for a future feature /
// achievement) — with a reason.
import fs from 'fs';

const dirs = ['src/data/events', 'src/data', 'src/utils'];
const files: string[] = [];
for (const d of dirs) for (const f of fs.readdirSync(d)) if (f.endsWith('.ts')) files.push(`${d}/${f}`);
const baseName = (f: string) => f.split('/').pop() as string;
const parts = files.map((f) => fs.readFileSync(f, 'utf8'));
const src = parts.join('\n');

// Static story_flags writes: keys assigned at the top level of a `story_flags: { ... }` block.
const writes = new Map<string, string>();
files.forEach((f, idx) => {
  const t = parts[idx];
  for (const m of t.matchAll(/story_flags:\s*\{/g)) {
    let i = m.index! + m[0].length - 1, depth = 0, j = i;
    for (; j < t.length; j++) { if (t[j] === '{') depth++; else if (t[j] === '}') { depth--; if (depth === 0) { j++; break; } } }
    for (const k of t.slice(i, j).matchAll(/[,{]\s*([a-zA-Z_]\w*)\s*:/g)) {
      if (k[1] !== 'story_flags' && !writes.has(k[1])) writes.set(k[1], baseName(f));
    }
  }
});

const isRead = (key: string) => new RegExp('\\.' + key + '\\b').test(src);

// Deliberate breadcrumbs: written to record what happened, intentionally not (yet) consumed
// (future features / achievements / top-level advisor perks). NOT once-per-life event gates.
// Keep this list minimal; prefer consuming the flag or the oncePerLife base over adding here.
const KNOWN_UNREAD: Record<string, string> = {
  credit_grabbed: 'dilemma 抢功记录,留作未来 karma/口碑',
  had_divorce: '离婚记录,留作未来再婚/成就',
  met_dave: 'Dave 宿敌首遇记录(宿敌线由 has_dave_evidence/dave_conflict_year 驱动)',
  dave_meet_year: '同上,首遇年份breadcrumb',
  icu_insurance_saved: 'ICU 分支记录(大厂医保),留作成就',
  icu_itemized_negotiated: 'ICU 分支记录(砍价),留作成就',
  icu_legal_win: 'ICU 分支记录(法律维权),留作成就',
  icu_uninsured_hit: 'ICU 分支记录(裸奔),留作成就',
  icu_complication: 'ICU 裸奔后遗症记录,留作成就/未来慢性病',
  linda_advisor: '顶层字段:Linda 投资顾问加成,留作未来消费',
  linda_fast_track: '顶层字段:Linda pre-IPO 快车道,留作未来消费',
  omniagent_advisor: '顶层字段:OmniAgent 顾问加成,留作未来消费',
};

const written = [...writes.keys()].sort();
const unread = written.filter((k) => !isRead(k));
const newlyDead = unread.filter((k) => !(k in KNOWN_UNREAD));
const staleAllow = Object.keys(KNOWN_UNREAD).filter((k) => !writes.has(k) || isRead(k));

console.log(`\n🩺 === story_flags 卫生审计 ===`);
console.log(`静态写入键 ${written.length} | 从不读取 ${unread.length} | 已登记面包屑 ${Object.keys(KNOWN_UNREAD).length}`);

let failed = false;
if (newlyDead.length) {
  failed = true;
  console.error(`\n❌ 新增"写了但从不读取"的 story_flags(疑似 ICU 类"该一次却复发"bug):`);
  newlyDead.forEach((k) => console.error(`   ${k}  (${writes.get(k)})`));
  console.error(`   → 请:① 用 GameEvent.oncePerLife + hasSeen/markSeen 统一机制;或 ② 真正消费该 flag;`);
  console.error(`      或 ③ 若确为有意 breadcrumb,加入 KNOWN_UNREAD 并注明理由。`);
}
if (staleAllow.length) {
  failed = true;
  console.error(`\n❌ KNOWN_UNREAD 过期项(已被读取或不再写入,请移除以保持清单诚实):`);
  staleAllow.forEach((k) => console.error(`   ${k}`));
}
if (failed) { console.error('\n❌ story_flags 卫生审计未通过!'); process.exit(1); }
console.log('✅ story_flags 卫生审计通过:无新增死 flag;登记清单无过期项。\n');
