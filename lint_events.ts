// Static lint over event DATA + shop UI — a fast regression guard for the bug classes we
// keep re-introducing (unseeded RNG, company-as-job_type, dangling string routes). Runs as
// the first step of `npm test`. Deeper reachability/routing is covered by audit_all_flows.
import { events } from './src/data/events';
import type { GameEvent } from './src/types';
import fs from 'fs';
import path from 'path';

console.log('🧹 === 事件数据静态 Lint (防回归护栏) ===\n');

let errors = 0;
const fail = (msg: string) => { console.error(`❌ ${msg}`); errors++; };

// --- 1. Banned source patterns over event data + shop UI ---------------------------------
const SCAN_DIRS = ['src/data/events', 'src/components'];
const BANNED: { re: RegExp; why: string }[] = [
  {
    re: /Math\.random\s*\(/,
    why: 'Math.random() 破坏可复现种子 —— 游戏内随机请用 gameRandom() (确需播种可加 // lint:allow-math-random)',
  },
  {
    re: /job_type\s*(?:===|==|:)\s*['"](?:nvidia|tiktok|amazon)['"]/,
    why: "amazon/nvidia/tiktok 是 company 不是 job_type —— 请用 company === '...' (见归一化 #42)",
  },
];

const collectFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: fs.Dirent) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return collectFiles(p);
    return e.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx')) ? [p] : [];
  });

for (const dir of SCAN_DIRS) {
  for (const file of collectFiles(dir)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line: string, i: number) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments
      if (line.includes('lint:allow-math-random')) return; // explicit opt-out (seed bootstrap)
      for (const b of BANNED) {
        if (b.re.test(line)) fail(`${file}:${i + 1} 命中禁用模式: ${b.why}\n    > ${trimmed}`);
      }
    });
  }
}

// --- 2. Every string-literal nextEventId resolves to a real event ------------------------
//     (function-form nextEventId returns are covered by audit_all_flows' BFS.)
for (const [id, ev] of Object.entries(events as Record<string, GameEvent>)) {
  for (const c of ev.choices || []) {
    if (typeof c.nextEventId === 'string' && c.nextEventId !== 'end' && !events[c.nextEventId]) {
      fail(`事件 '${id}' 的选项「${c.text?.slice(0, 20)}…」nextEventId 指向不存在的事件 '${c.nextEventId}'`);
    }
  }
}

if (errors > 0) {
  console.error(`\n🚨 静态 Lint 失败：共 ${errors} 处违规。`);
  process.exit(1);
}
console.log('🎉 事件数据静态 Lint 通过：无禁用模式、无悬空字符串路由。\n');
