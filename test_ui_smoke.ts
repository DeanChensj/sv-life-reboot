/**
 * test_ui_smoke.ts — Headless UI smoke test (Playwright).
 *
 * Closes the long-standing "UI layer has ZERO automated coverage" blind spot.
 * The tsx suites all exercise the pure event/state logic; nothing renders the
 * actual React tree. A single render crash (a null deref in App.tsx, a bad
 * lazy import, a WarReport canvas throw) would ship green today.
 *
 * What this does:
 *   1. Boots the real Vite dev server on an isolated port.
 *   2. Drives a full life in a real Chromium: dismiss welcome, then rotate
 *      through the enabled choices each turn until the game reaches an ending.
 *   3. Asserts the render layer NEVER breaks: no ErrorBoundary fallback, no
 *      uncaught pageerror, no (non-benign) console error — at every turn.
 *   4. Exercises the ending screen + opens the WarReport poster and asserts its
 *      <canvas> actually renders with non-zero dimensions.
 *
 * Run: npx tsx test_ui_smoke.ts   (needs `npx playwright install chromium` once)
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 4319;
const BASE = `http://localhost:${PORT}/sv-life-reboot/`;
const MAX_STEPS = 400;
const ERR_BOUNDARY_TEXT = '前端发生未捕获的渲染异常'; // unique ErrorBoundary fallback subtitle

// Console "error" lines that are environmental noise, not app bugs.
const BENIGN_CONSOLE = [
  'Failed to load resource',
  'net::ERR_',
  'favicon',
  'status of 404',
  'status of 403',
  'ERR_CONNECTION',
];

const problems: string[] = [];

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`vite dev server did not come up at ${url} within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  console.log(`[ui_smoke] starting vite dev server on :${PORT} ...`);
  const server: ChildProcess = spawn(
    'npx',
    ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'],
    { cwd: process.cwd(), stdio: 'ignore', detached: false },
  );
  server.on('error', (e) => problems.push(`failed to spawn vite: ${e.message}`));

  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };

  try {
    await waitForServer(BASE, 60_000);
    console.log('[ui_smoke] server up; launching chromium ...');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (BENIGN_CONSOLE.some((b) => t.includes(b))) return;
      consoleErrors.push(t);
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const assertNoErrorBoundary = async (where: string) => {
      if ((await page.getByText(ERR_BOUNDARY_TEXT).count()) > 0) {
        const detail =
          (await page.locator('.text-red-400.font-semibold').first().textContent().catch(() => '')) ||
          '(no detail)';
        problems.push(`ErrorBoundary tripped at ${where}: ${detail.trim()}`);
        throw new Error(`ErrorBoundary at ${where}`);
      }
    };

    // Start from a clean slate AND skip the welcome modal by pre-seeding
    // localStorage before any app script runs (addInitScript fires pre-load).
    // Fighting the modal's fade-in animation is flaky; this is deterministic.
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem('sv_life_welcome_seen', '1');
      } catch {
        /* ignore */
      }
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // First event card (choose_trait) should render straight away.
    await page.locator('[data-testid="choice-btn"]').first().waitFor({ state: 'visible', timeout: 20_000 });

    // Play a full life: rotate through enabled choices to exercise variety.
    const seenEvents = new Set<string>();
    let steps = 0;
    let reachedEnd = false;
    const restartBtn = page.getByRole('button', { name: '再次重开人生' });
    // The year-end settlement modal is React.lazy: on the turn it triggers, its
    // chunk (overlay + continue button) mounts a few ms late, so a naive check
    // races and clicks the choice card lurking behind it. Classify each turn by
    // polling with priority ending > settlement > choices, giving the lazy modal
    // time to mount before we accept the choice card as the active screen.
    for (; steps < MAX_STEPS; steps++) {
      await assertNoErrorBoundary(`turn ${steps}`);

      const settleBtn = page.getByRole('button', { name: /进入下一年/ });
      const choices = page.locator('[data-testid="choice-btn"]:not([disabled])');
      const blocker = page.locator('div.fixed.inset-0.z-50');

      let target: 'end' | 'settle' | 'choice' | null = null;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if ((await restartBtn.count()) > 0) { target = 'end'; break; }
        if ((await settleBtn.count()) > 0) { target = 'settle'; break; }
        // Only treat the choice card as active when NO blocking modal is up.
        if ((await blocker.count()) === 0 && (await choices.count()) > 0) { target = 'choice'; break; }
        await page.waitForTimeout(100);
      }

      if (target === 'end') { reachedEnd = true; break; }
      if (target === null) {
        problems.push(`no actionable screen (ending/settlement/choice) at turn ${steps}`);
        break;
      }
      if (target === 'settle') {
        await settleBtn.first().click({ timeout: 10_000 });
        await page.waitForTimeout(80);
        continue;
      }

      // target === 'choice'
      const n = await choices.count();
      const title = (await page.locator('h2').first().textContent().catch(() => null))?.trim();
      if (title) seenEvents.add(title);
      try {
        await choices.nth(steps % n).click({ timeout: 10_000 });
      } catch {
        // A React.lazy modal (settlement) can mount in the gap between "no blocker is up" and
        // the click landing, and then swallows it. That's a harness race, not an app bug:
        // re-classify the turn instead of failing the run.
        if ((await blocker.count()) > 0) { steps--; continue; }
        throw new Error(`choice click failed with no blocking modal present at turn ${steps}`);
      }
      await page.waitForTimeout(80);
    }

    if (!reachedEnd) {
      problems.push(`did not reach an ending within ${MAX_STEPS} turns`);
    } else {
      // Ending screen coverage + WarReport poster.
      // WarReportModal draws to an offscreen (hidden) <canvas>, then exports it
      // via toDataURL into a visible <img>. Assert BOTH: the canvas drew with
      // non-zero dims (no draw throw) and the poster image actually renders.
      await assertNoErrorBoundary('ending screen');
      await page.getByRole('button', { name: /生成炫彩战报海报/ }).click({ timeout: 15_000 });
      const canvas = page.locator('canvas').first();
      await canvas.waitFor({ state: 'attached', timeout: 20_000 });
      const dims = await canvas.evaluate((c) => ({
        w: (c as HTMLCanvasElement).width,
        h: (c as HTMLCanvasElement).height,
      }));
      if (!(dims.w > 0 && dims.h > 0)) {
        problems.push(`war report canvas has zero dimensions (${dims.w}x${dims.h})`);
      }
      const poster = page.locator('img[src^="data:image"]').first();
      try {
        await poster.waitFor({ state: 'visible', timeout: 20_000 });
        const ok = await poster.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0);
        if (!ok) problems.push('war report poster <img> failed to decode (naturalWidth 0)');
      } catch {
        problems.push('war report poster <img> (data URL) never rendered');
      }
      await assertNoErrorBoundary('war report');
    }

    if (consoleErrors.length) {
      problems.push(`console errors (${consoleErrors.length}): ${consoleErrors.slice(0, 5).join(' | ')}`);
    }
    if (pageErrors.length) {
      problems.push(`uncaught page errors (${pageErrors.length}): ${pageErrors.slice(0, 5).join(' | ')}`);
    }

    await browser.close();

    if (problems.length === 0) {
      console.log(
        `\n✅ [ui_smoke] PASS — played ${steps} turns to an ending, ` +
          `${seenEvents.size} distinct events rendered, war report canvas OK, ` +
          `zero uncaught/console errors.`,
      );
    }
  } catch (e) {
    if (!problems.length) problems.push(`unexpected: ${(e as Error).message}`);
  } finally {
    cleanup();
  }

  if (problems.length) {
    console.error('\n❌ [ui_smoke] FAILED:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
}

main();
