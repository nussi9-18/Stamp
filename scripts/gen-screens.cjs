// Regenerates the real app screenshots used on the website (public/screens/*.webp).
// Needs a running app (npm run dev) and Playwright + Python Pillow on the machine:
//   BASE=http://localhost:3000 node scripts/gen-screens.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'public', 'screens');

async function seeded(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Continue without an account' }).click();
  await page.getByLabel('Name on passport').fill('Nussi');
  await page.getByRole('button', { name: 'Slow cinema' }).click();
  await page.getByRole('button', { name: 'Issue my passport' }).click();
  await page.getByRole('button', { name: 'Start stamping' }).waitFor({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.getByRole('button', { name: 'Add sample stamps' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.count()) await dismiss.click();
  // let the "Added 15 sample stamps" toast clear
  await page.waitForTimeout(2800);
  return { ctx, page };
}

function toWebp(png, webp, width) {
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w = int(sys.argv[3]); h = round(im.height * w / im.width)
im.resize((w, h), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=84, method=6)
print(w, h)`, png, webp, String(width)], { stdio: 'inherit' });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  {
    const { ctx, page } = await seeded(browser, { width: 1180, height: 820 });
    const png = path.join(OUT, 'ipad.png');
    await page.screenshot({ path: png });
    toWebp(png, path.join(OUT, 'ipad-passport.webp'), 1600);
    fs.unlinkSync(png);
    await ctx.close();
  }
  {
    const { ctx, page } = await seeded(browser, { width: 390, height: 844 });
    await page.goto(`${BASE}/app/discover`, { waitUntil: 'networkidle' });
    await page.getByRole('searchbox').fill('chungking');
    await page.locator('.drow').first().click();
    await page.waitForTimeout(700);
    const png = path.join(OUT, 'phone.png');
    await page.screenshot({ path: png });
    toWebp(png, path.join(OUT, 'phone-record.webp'), 600);
    fs.unlinkSync(png);
    await ctx.close();
  }
  await browser.close();
})();
