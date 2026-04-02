import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser to debug white screen...');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[Browser Console Error] ${msg.text()}`);
    else console.log(`[Console Logger] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[Uncaught Page Error] ${err.message}`);
  });

  try {
    console.log('Navigating to local dev server...');
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(4000);
  } catch (e) {
    console.error(`[Navigation Exception] ${e.message}`);
  }
  
  await browser.close();
  console.log("Diagnostic finished.");
})();
