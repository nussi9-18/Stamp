// Renders the PWA icons from the STAMP seal (public/icons/*). Needs Playwright:
//   node scripts/gen-icons.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const RING = '• MEDIA PASSPORT • REPUBLIC OF TASTE • EST. 2026 ';
const C = 2 * Math.PI * 72 - 2;
const SEAL = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
  <defs><path id="r" d="M 28,100 a 72,72 0 1,1 144,0 a 72,72 0 1,1 -144,0" fill="none"/></defs>
  <circle cx="100" cy="100" r="96" fill="#F9F6F0" stroke="#D95D74" stroke-width="5"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#D95D74" stroke-width="1.2" stroke-dasharray="3 3"/>
  <text fill="#181716" style="font-family:Anton;font-size:17px" textLength="${C}" lengthAdjust="spacing"><textPath href="#r">${RING}</textPath></text>
  <circle cx="100" cy="100" r="54" fill="#181716"/>
  <circle cx="100" cy="100" r="48" fill="none" stroke="#F5F1E8" stroke-width="1.2" stroke-dasharray="4 3"/>
  <path d="M100,60 L103.5,69.2 L113.3,69.6 L105.6,75.6 L108.2,85 L100,79.6 L91.8,85 L94.4,75.6 L86.7,69.6 L96.5,69.2 Z" fill="#D95D74"/>
  <text x="100" y="114" text-anchor="middle" fill="#F5F1E8" style="font-family:Anton;font-size:30px;letter-spacing:.02em">STMP</text>
  <text x="100" y="126" text-anchor="middle" fill="#D95D74" style="font-family:'JetBrains Mono';font-size:7px;letter-spacing:.2em;font-weight:700">PASSPORT</text>
</svg>`;

const page = (scale, bg) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<style>html,body{margin:0;background:${bg}}#box{width:512px;height:512px;display:grid;place-items:center;background:${bg}}#s{width:${scale * 100}%;height:${scale * 100}%}</style>
</head><body><div id="box"><div id="s">${SEAL}</div></div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 512, height: 512 } });
  const p = await ctx.newPage();
  const shoot = async (scale, bg, file, size) => {
    await p.setContent(page(scale, bg), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const buf = await p.locator('#box').screenshot();
    const out = path.join(OUT, file);
    if (size === 512) require('node:fs').writeFileSync(out, buf);
    else {
      const tmp = out + '.tmp.png';
      require('node:fs').writeFileSync(tmp, buf);
      require('node:child_process').execFileSync('python3', ['-c', `from PIL import Image;import sys;Image.open(sys.argv[1]).resize((int(sys.argv[3]),)*2, Image.LANCZOS).save(sys.argv[2], optimize=True)`, tmp, out, String(size)]);
      require('node:fs').unlinkSync(tmp);
    }
  };
  await shoot(0.92, '#F5F1E8', 'icon-512.png', 512);
  await shoot(0.92, '#F5F1E8', 'icon-192.png', 192);
  await shoot(0.66, '#3A1620', 'icon-maskable-512.png', 512);
  await shoot(0.84, '#F5F1E8', 'apple-touch-icon.png', 180);
  await shoot(0.98, '#F5F1E8', 'icon-32.png', 32);
  await browser.close();
})();
