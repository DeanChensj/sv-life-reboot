import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/sv-life-reboot/', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 1280, height: 800 });
  
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  
  await page.screenshot({ path: '/Users/deanchen/.gemini/jetski/brain/679789be-55a3-4c5d-8b23-c24a0aa8ef7c/preview_welcome_modal_v2.png', fullPage: true });
  
  await browser.close();
})();
