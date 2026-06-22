import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

// 使い方: リポジトリ root で `python3 -m http.server 8099` を起動してから
//   node docs/screenshots/shot.mjs
const base = 'http://localhost:8099';
const OUT = 'docs/screenshots';
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
  await page.screenshot({ path: OUT + '/01-start.png' });
  await ctx.close();
}

// 進行後セーブデータ（ロード前に seed）
const PROGRESS = {
  stardust: 48230, runEarned: 4200000, clickLevel: 6,
  generators: [
    { id: 'drone', count: 22 }, { id: 'miner', count: 11 },
    { id: 'station', count: 4 }, { id: 'warp', count: 1 }, { id: 'dyson', count: 0 },
  ],
  nebula: 8, nebulaEarned: 12,
  upgrades: { click: 2, prod: 3, boost: 1, idle: 0 },
  achievements: { tap50: true, tap1000: true, earn1k: true, earn1m: true, gen10: true, gen100: true, prestige1: true },
  lifetime: { earned: 4200000, taps: 1200, prestiges: 2, boostUsed: true },
  daily: { lastClaimDay: -1, streak: 0 },
  settings: { sound: true, vibe: true },
  buyMode: 1, lastSeen: Date.now(),
};

// --- 2) 進行後（ショップ） / 3) 転生 / 4) QoL ---
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
  await page.screenshot({ path: OUT + '/02-progress.png' });

  await page.locator('.tab[data-tab="prestige"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/03-prestige.png' });

  // 4) QoL: Max まとめ買い + ブースト発動状態
  await page.locator('.tab[data-tab="shop"]').click();
  await page.locator('.bm[data-mode="max"]').click();
  await page.locator('#boostButton').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/04-qol.png' });

  // 5) 恒久アップグレード（強化タブ）
  await page.locator('.tab[data-tab="upgrades"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/05-upgrades.png' });

  // 6) 実績タブ
  await page.locator('.tab[data-tab="achievements"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/06-achievements.png' });

  // 7) 任務タブ
  await page.locator('.tab[data-tab="missions"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/08-missions.png' });

  // 8) ボス戦闘中（コックピット）
  await page.locator('.tab[data-tab="shop"]').click();
  await page.locator('#bossButton').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('#tapButton').click({ force: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/09-boss.png' });
  await ctx.close();
}

await browser.close();
console.log('done');
