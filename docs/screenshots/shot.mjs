import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const base = 'http://localhost:8099';
const VP = { width: 390, height: 844 };
const browser = await chromium.launch();

// --- 1) 初期状態（タップ演出つき） ---
{
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForTimeout(400);
  const star = page.locator('#tapButton');
  await star.click({ force: true });
  await page.waitForTimeout(40);
  await star.click({ force: true });
  await page.waitForTimeout(40);
  await page.screenshot({ path: 'screenshot-1-start.png' });
  await ctx.close();
}

// 進行後セーブデータ（ロード前に seed）
const PROGRESS = {
  stardust: 48230, totalEarned: 4200000, clickLevel: 6,
  generators: [
    { id: 'drone', count: 22 }, { id: 'miner', count: 11 },
    { id: 'station', count: 4 }, { id: 'warp', count: 1 }, { id: 'dyson', count: 0 },
  ],
  nebula: 3, lastSeen: Date.now(),
};

// --- 2) 進行後（ショップ） & 3) 転生タブ ---
{
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, isMobile: true });
  await ctx.addInitScript((save) => {
    localStorage.setItem('stardust-clicker-save-v1', JSON.stringify(save));
  }, PROGRESS);
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForTimeout(500);
  await page.locator('#welcomeClose').click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot-2-progress.png' });

  await page.locator('.tab[data-tab="prestige"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot-3-prestige.png' });
  await ctx.close();
}

await browser.close();
console.log('done');
