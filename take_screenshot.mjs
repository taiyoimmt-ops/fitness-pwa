import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser fallback...');
  const browser = await chromium.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  
  await page.goto('https://fitness-k0xzuuir4-taiyoimmt-ops-projects.vercel.app/');
  console.log('Waiting for data to load...');
  await page.waitForTimeout(5000); 
  
  const path = 'dashboard_screenshot.png';
  await page.screenshot({ path, fullPage: true });
  
  await browser.close();
  console.log(`Screenshot saved to ${path}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
