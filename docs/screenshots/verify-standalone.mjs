import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(process.cwd() + '/play.html').href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(url);
await page.waitForTimeout(400);

// タップして増えるか
const before = await page.locator('#stardust').textContent();
for (let i = 0; i < 5; i++) { await page.locator('#tapButton').click({ force: true }); await page.waitForTimeout(30); }
const after = await page.locator('#stardust').textContent();

// タブが切り替わるか
await page.locator('.tab[data-tab="upgrades"]').click();
await page.waitForTimeout(150);
const upVisible = await page.locator('#tab-upgrades').isVisible();

await page.locator('.tab[data-tab="achievements"]').click();
await page.waitForTimeout(150);
const achVisible = await page.locator('#tab-achievements').isVisible();

await page.screenshot({ path: 'docs/screenshots/07-standalone.png' });

console.log(JSON.stringify({ before, after, increased: Number(after) > Number(before), upVisible, achVisible, errors }, null, 2));
await browser.close();
