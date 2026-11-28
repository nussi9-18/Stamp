// The STAMP logo pack: every logo as an SVG (all text turned into outlines, so it looks the
// same everywhere) and a transparent 1024px PNG, plus a contact sheet and a zip.
//   node scripts/gen-logos.mjs
// Needs Playwright (for the PNGs) and the brand fonts from Google Fonts (cached on first run).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

// Playwright via require, so a globally installed copy (NODE_PATH) works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'brand', 'logos');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'stamp-fonts');

/* ── Fonts (all SIL Open Font License) ─────────────────────────────────── */

const FONT_URLS = {
  anton: 'https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K0.ttf',
  'inter-600': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
  'inter-800': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf',
  'jetbrains-mono-700': 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf',
  'permanent-marker': 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004Hao.ttf',
  'playfair-700-italic': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UbtY.ttf',
  vt323: 'https://fonts.gstatic.com/s/vt323/v18/pxiKyp0ihIEF2hsY.ttf',
};

async function font(name) {
  const file = path.join(CACHE, `${name}.ttf`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const res = await fetch(FONT_URLS[name]);
    if (!res.ok) throw new Error(`Couldn't download ${name} (${res.status}). Put the TTF at ${file} and run again.`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = fs.readFileSync(file);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const F = {
  anton: await font('anton'),
  inter6: await font('inter-600'),
  inter8: await font('inter-800'),
  mono: await font('jetbrains-mono-700'),
  marker: await font('permanent-marker'),
  play: await font('playfair-700-italic'),
  vt: await font('vt323'),
};

/* ── Palette ──────────────────────────────────────────────────────────── */

const C = {
  ink: '#181716',
  cream: '#F9F6F0',
  paper: '#F5F1E8',
  rose: '#D95D74',
  red: '#C3272B',
  orange: '#E8862E',
  yellow: '#F2C23A',
  teal: '#2E6461',
  sky: '#7EA8BE',
  burgundy: '#5A1A2B',
  gold: '#D9B66C',
  modernRose: '#E8114B',
  graphite: '#1C1C1E',
  vcrBlue: '#1D3FBF',
};

/* ── Text as outlines ─────────────────────────────────────────────────── */

const f2 = (n) => Number(n.toFixed(2));

/** Glyph outlines for a line of text, baseline at y=0, plus its advance width and ink box. */
function shape(font, str, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  const p = new opentype.Path();
  let x = 0;
  glyphs.forEach((g, i) => {
    p.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * scale;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
  });
  return { d: p.toPathData(2), width: x, bb: p.getBoundingBox() };
}

/**
 * Place text. `at` is the anchor point; `anchor` is start | middle | end (horizontal, by advance)
 * and `v` is baseline | middle (vertical, middle = centre of the ink box).
 */
function text(font, str, { size, x = 0, y = 0, anchor = 'start', v = 'baseline', tracking = 0, fill = C.ink, extra = '' }) {
  const s = shape(font, str, size, tracking);
  const dx = anchor === 'middle' ? -s.width / 2 : anchor === 'end' ? -s.width : 0;
  const dy = v === 'middle' ? -(s.bb.y1 + s.bb.y2) / 2 : 0;
  return `<path d="${s.d}" transform="translate(${f2(x + dx)} ${f2(y + dy)})" fill="${fill}" ${extra}/>`;
}

/** Text standing on a circle, reading clockwise from 9 o'clock and spaced to fill it (like the seal). */
function ring(font, str, { cx, cy, r, size, fill = C.ink, startDeg = 180 }) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  const adv = glyphs.map((g) => g.advanceWidth * scale);
  const gap = (2 * Math.PI * r - adv.reduce((a, b) => a + b, 0)) / glyphs.length;
  let s = 0;
  const parts = [];
  glyphs.forEach((g, i) => {
    const th = (startDeg * Math.PI) / 180 + (s + adv[i] / 2) / r;
    const d = g.getPath(-adv[i] / 2, 0, size).toPathData(2);
    if (d) parts.push(`<path d="${d}" transform="translate(${f2(cx + r * Math.cos(th))} ${f2(cy + r * Math.sin(th))}) rotate(${f2((th * 180) / Math.PI + 90)})"/>`);
    s += adv[i] + gap;
  });
  return `<g fill="${fill}">${parts.join('')}</g>`;
}

/** Text on an arc centred at `centerDeg` (−90 = top). Bottom arcs read left to right, upright. */
function arc(font, str, { cx, cy, r, size, centerDeg = -90, tracking = 0, bottom = false, fill = C.ink }) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  const adv = glyphs.map((g, i) => g.advanceWidth * scale + (i < glyphs.length - 1 ? tracking * size : 0));
  const total = adv.reduce((a, b) => a + b, 0);
  const dir = bottom ? -1 : 1;
  let s = -total / 2;
  const parts = [];
  glyphs.forEach((g, i) => {
    const w = g.advanceWidth * scale;
    const th = (centerDeg * Math.PI) / 180 + (dir * (s + w / 2)) / r;
    const d = g.getPath(-w / 2, 0, size).toPathData(2);
    if (d) parts.push(`<path d="${d}" transform="translate(${f2(cx + r * Math.cos(th))} ${f2(cy + r * Math.sin(th))}) rotate(${f2((th * 180) / Math.PI + (bottom ? -90 : 90))})"/>`);
    s += adv[i];
  });
  return `<g fill="${fill}">${parts.join('')}</g>`;
}

function star(cx, cy, R, r = R * 0.4) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${f2(cx + rad * Math.cos(a))},${f2(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join('L')}Z`;
}

const SEAL_RING = '• MEDIA PASSPORT • REPUBLIC OF TASTE • EST. 2026 ';
const SEAL_STAR = 'M100,60 L103.5,69.2 L113.3,69.6 L105.6,75.6 L108.2,85 L100,79.6 L91.8,85 L94.4,75.6 L86.7,69.6 L96.5,69.2 Z';

/** The seal from the app, on a 200×200 grid. */
function seal({ bg = C.cream, rim = C.rose, ringInk = C.ink, disc = C.ink, discInk = C.cream, accent = C.rose } = {}) {
  return `
  <circle cx="100" cy="100" r="96" fill="${bg}" stroke="${rim}" stroke-width="5"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="${rim}" stroke-width="1.2" stroke-dasharray="3 3"/>
  ${ring(F.anton, SEAL_RING, { cx: 100, cy: 100, r: 72, size: 17, fill: ringInk })}
  <circle cx="100" cy="100" r="54" fill="${disc}"/>
  <circle cx="100" cy="100" r="48" fill="none" stroke="${discInk}" stroke-width="1.2" stroke-dasharray="4 3"/>
  <path d="${SEAL_STAR}" fill="${accent}"/>
  ${text(F.anton, 'STMP', { size: 30, x: 100, y: 114, anchor: 'middle', tracking: 0.02, fill: discInk })}
  ${text(F.mono, 'PASSPORT', { size: 7, x: 100, y: 126, anchor: 'middle', tracking: 0.2, fill: accent })}`;
}

/** One-colour seal: the centre's star and lettering are cut out, so it works on any background. */
function sealMono(color, id) {
  return `
  <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
    <rect width="200" height="200" fill="#fff"/>
    <circle cx="100" cy="100" r="48" fill="none" stroke="#000" stroke-width="1.6" stroke-dasharray="4 3"/>
    <path d="${SEAL_STAR}" fill="#000"/>
    ${text(F.anton, 'STMP', { size: 30, x: 100, y: 114, anchor: 'middle', tracking: 0.02, fill: '#000' })}
    ${text(F.mono, 'PASSPORT', { size: 7, x: 100, y: 126, anchor: 'middle', tracking: 0.2, fill: '#000' })}
  </mask></defs>
  <circle cx="100" cy="100" r="96" fill="none" stroke="${color}" stroke-width="5"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 3"/>
  ${ring(F.anton, SEAL_RING, { cx: 100, cy: 100, r: 72, size: 17, fill: color })}
  <circle cx="100" cy="100" r="54" fill="${color}" mask="url(#${id})"/>`;
}

/** Worn rubber: speckled ink and slightly wobbly edges. */
const WORN = (id, seed = 4, grain = 1.4, warp = 2.4) => `
  <filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${grain}" numOctaves="2" seed="${seed}" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.2 0 0 0 2.08" result="holes"/>
    <feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed + 5}" result="warp"/>
    <feDisplacementMap in="speckled" in2="warp" scale="${warp}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;

/* ── The logos ────────────────────────────────────────────────────────── */

const LOGOS = [];
/** tile: the contact-sheet background it reads best on; smooth: keep full colour (gradients). */
const add = (id, name, w, h, body, tile = 'light', smooth = false) => LOGOS.push({ id, name, w, h, body, tile, smooth });

add('01-seal', 'Seal', 200, 200, seal());
add('02-seal-ink', 'Seal · one colour', 200, 200, sealMono(C.ink, 'k'));
add('03-seal-white', 'Seal · white', 200, 200, sealMono('#FFFFFF', 'k'), 'dark');
add('04-seal-rubber', 'Seal · rubber stamp', 200, 200, `<defs>${WORN('w', 4, 1.6, 2.2)}</defs><g filter="url(#w)" transform="rotate(-9 100 100)">${sealMono(C.red, 'k')}</g>`);
add('05-seal-retro', 'Seal · Retro', 200, 200, seal({ bg: '#EFE5CF', rim: C.red, ringInk: '#1C1712', disc: '#1C1712', discInk: '#EFE5CF', accent: C.yellow }));
add('06-seal-night', 'Seal · night', 200, 200, seal({ bg: '#14110E', rim: C.rose, ringInk: '#EFE4CC', disc: '#EFE4CC', discInk: '#14110E', accent: C.rose }), 'dark');

// Wordmark
{
  const s = shape(F.anton, 'STAMP', 240, 0.03);
  const w = s.width + 120;
  add('07-wordmark', 'Wordmark', Math.ceil(w + 40), 320, `
    ${text(F.anton, 'STAMP', { size: 240, x: 60, y: 265, tracking: 0.03 })}
    <path d="${star(60 + s.width + 52, 70, 34)}" fill="${C.rose}"/>`);
}

// Horizontal lockup
{
  const word = shape(F.anton, 'STAMP', 190, 0.03);
  const W = 60 + 260 + 48 + word.width + 60;
  add('08-lockup', 'Lockup · horizontal', Math.ceil(W), 380, `
    <g transform="translate(60 60) scale(1.3)">${seal()}</g>
    ${text(F.anton, 'STAMP', { size: 190, x: 368, y: 238, tracking: 0.03 })}
    ${text(F.mono, 'MEDIA PASSPORT', { size: 33, x: 372, y: 300, tracking: 0.32, fill: C.rose })}`);
}

// Stacked lockup
add('09-lockup-stacked', 'Lockup · stacked', 1000, 1000, `
  <g transform="translate(290 70) scale(2.1)">${seal()}</g>
  ${text(F.anton, 'STAMP', { size: 230, x: 500, y: 760, anchor: 'middle', tracking: 0.04 })}
  ${text(F.mono, 'MEDIA PASSPORT', { size: 40, x: 500, y: 850, anchor: 'middle', tracking: 0.32, fill: C.rose })}`);

// App icons (rounded for presentation; iOS applies its own mask to a square icon)
add('10-icon-modern', 'App icon · Modern', 1024, 1024, `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#2C2C2E"/><stop offset="0.75" stop-color="#0A0A0C"/></linearGradient>
    <radialGradient id="glow" cx="0.95" cy="0.02" r="0.85"><stop offset="0" stop-color="${C.modernRose}" stop-opacity="0.7"/><stop offset="0.6" stop-color="${C.modernRose}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#g)"/>
  <rect width="1024" height="1024" rx="228" fill="url(#glow)"/>
  <circle cx="512" cy="512" r="318" fill="none" stroke="#fff" stroke-width="30"/>
  <circle cx="512" cy="512" r="268" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="9" stroke-dasharray="22 16"/>
  <path d="${star(512, 528, 170, 70)}" fill="#fff"/>`, 'dark', true);

add('11-icon-retro', 'App icon · Retro', 1024, 1024, `
  <defs><clipPath id="c"><rect width="1024" height="1024" rx="228"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="1024" height="1024" fill="#EFE5CF"/>
    <g transform="rotate(-24 512 512)">
      <rect x="-300" y="560" width="1700" height="92" fill="${C.red}"/>
      <rect x="-300" y="652" width="1700" height="92" fill="${C.orange}"/>
      <rect x="-300" y="744" width="1700" height="92" fill="${C.yellow}"/>
    </g>
    <circle cx="512" cy="470" r="300" fill="#1C1712"/>
    <circle cx="512" cy="470" r="266" fill="none" stroke="#EFE5CF" stroke-width="7" stroke-dasharray="22 15"/>
    <path d="${star(512, 352, 64)}" fill="${C.yellow}"/>
    ${text(F.anton, 'STMP', { size: 200, x: 512, y: 586, anchor: 'middle', tracking: 0.03, fill: '#EFE5CF' })}
  </g>`);

add('12-icon-vhs', 'App icon · VHS tape', 1024, 1024, `
  <defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26211C"/><stop offset="1" stop-color="#0E0C0A"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="228" fill="url(#b)"/>
  <rect x="112" y="150" width="800" height="430" rx="22" fill="#F3E9D2"/>
  <rect x="112" y="150" width="800" height="34" fill="${C.red}"/>
  <rect x="112" y="184" width="800" height="34" fill="${C.orange}"/>
  <rect x="112" y="218" width="800" height="34" fill="${C.yellow}"/>
  ${text(F.anton, 'STAMP', { size: 230, x: 512, y: 512, anchor: 'middle', tracking: 0.04, fill: '#1C1712' })}
  <rect x="232" y="650" width="560" height="200" rx="26" fill="#050403" stroke="#3A332B" stroke-width="6"/>
  ${[372, 652].map((x) => `<circle cx="${x}" cy="750" r="62" fill="#EFE4CC"/><circle cx="${x}" cy="750" r="24" fill="#050403"/>${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="${x - 5}" y="${750 - 58}" width="10" height="28" fill="#050403" transform="rotate(${a} ${x} 750)"/>`).join('')}`).join('')}`, 'dark');

// Postage stamp with perforations
{
  const W = 784, H = 984, R = 20, step = 54;
  const holes = [];
  for (let x = step / 2; x < W; x += step) holes.push([x, 0], [x, H]);
  for (let y = step / 2; y < H; y += step) holes.push([0, y], [W, y]);
  add('13-postage', 'Postage stamp', W, H, `
    <defs><mask id="p"><rect width="${W}" height="${H}" fill="#fff"/>${holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${R}" fill="#000"/>`).join('')}</mask>
      <filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#181716" flood-opacity="0.22"/></filter></defs>
    <g filter="url(#sh)"><rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="#FFFFFF" mask="url(#p)"/></g>
    <rect x="74" y="74" width="${W - 148}" height="${H - 148}" fill="${C.rose}"/>
    <rect x="96" y="96" width="${W - 192}" height="${H - 192}" fill="none" stroke="${C.cream}" stroke-width="4"/>
    <circle cx="${W / 2}" cy="436" r="200" fill="${C.ink}"/>
    <circle cx="${W / 2}" cy="436" r="176" fill="none" stroke="${C.cream}" stroke-width="5" stroke-dasharray="16 11"/>
    <path d="${star(W / 2, 444, 122)}" fill="${C.cream}"/>
    ${text(F.anton, '26', { size: 92, x: 128, y: 210, fill: C.cream })}
    ${text(F.anton, 'STAMP', { size: 170, x: W / 2, y: 806, anchor: 'middle', tracking: 0.04, fill: C.cream })}
    ${text(F.mono, 'REPUBLIC OF TASTE', { size: 30, x: W / 2, y: 862, anchor: 'middle', tracking: 0.28, fill: C.ink })}`);
}

// Cinema ticket
{
  const W = 1280, H = 560;
  add('14-ticket', 'Ticket', W, H, `
    <defs><mask id="t"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="0" cy="${H / 2}" r="56" fill="#000"/><circle cx="${W}" cy="${H / 2}" r="56" fill="#000"/>
      ${Array.from({ length: 11 }, (_, i) => `<circle cx="980" cy="${40 + i * 48}" r="9" fill="#000"/>`).join('')}</mask></defs>
    <rect width="${W}" height="${H}" rx="26" fill="${C.red}" mask="url(#t)"/>
    <rect x="44" y="44" width="890" height="${H - 88}" rx="10" fill="none" stroke="#F3E9D2" stroke-width="5"/>
    ${text(F.mono, 'ADMIT ONE', { size: 46, x: 489, y: 150, anchor: 'middle', tracking: 0.42, fill: '#F3E9D2' })}
    ${text(F.anton, 'STAMP', { size: 230, x: 489, y: 392, anchor: 'middle', tracking: 0.05, fill: '#F3E9D2' })}
    ${text(F.mono, 'MEDIA PASSPORT · EST. 2026', { size: 30, x: 489, y: 460, anchor: 'middle', tracking: 0.26, fill: C.yellow })}
    <g transform="translate(1130 ${H / 2}) rotate(-90)">${text(F.anton, 'Nº 026', { size: 96, x: 0, y: 0, anchor: 'middle', v: 'middle', tracking: 0.06, fill: '#F3E9D2' })}</g>`);
}

// Passport cover
{
  const W = 760, H = 1040, cx = W / 2;
  add('15-passport', 'Passport cover', W, H, `
    <rect width="${W}" height="${H}" rx="34" fill="${C.burgundy}"/>
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="22" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="3"/>
    ${text(F.mono, 'MEDIA PASSPORT', { size: 40, x: cx, y: 168, anchor: 'middle', tracking: 0.34, fill: C.gold })}
    <circle cx="${cx}" cy="460" r="176" fill="none" stroke="${C.gold}" stroke-width="9"/>
    <circle cx="${cx}" cy="460" r="152" fill="none" stroke="${C.gold}" stroke-width="3" stroke-dasharray="10 8"/>
    ${ring(F.anton, '• REPUBLIC OF TASTE • EST. 2026 ', { cx, cy: 460, r: 122, size: 27, fill: C.gold })}
    <path d="${star(cx, 462, 76)}" fill="${C.gold}"/>
    ${text(F.anton, 'STAMP', { size: 150, x: cx, y: 800, anchor: 'middle', tracking: 0.08, fill: C.gold })}
    <g transform="translate(${cx - 44} 880)" fill="none" stroke="${C.gold}" stroke-width="6">
      <rect x="0" y="0" width="88" height="58" rx="8"/><circle cx="44" cy="29" r="14"/><path d="M0 29h30M58 29h30"/>
    </g>`, 'light');
}

// Monogram
add('16-monogram', 'Monogram S', 1000, 1000, `
  <circle cx="500" cy="500" r="470" fill="${C.rose}"/>
  <circle cx="500" cy="500" r="420" fill="none" stroke="${C.cream}" stroke-width="10" stroke-dasharray="28 20"/>
  ${text(F.anton, 'S', { size: 640, x: 500, y: 500, anchor: 'middle', v: 'middle', fill: C.cream })}`);

// Star mark
add('17-star', 'Star mark', 1000, 1000, `
  <circle cx="500" cy="500" r="462" fill="none" stroke="${C.ink}" stroke-width="34"/>
  <circle cx="500" cy="500" r="398" fill="none" stroke="${C.ink}" stroke-width="12" stroke-dasharray="30 22"/>
  <path d="${star(500, 520, 270, 112)}" fill="${C.rose}"/>`);

// Italic wordmark
{
  const s = shape(F.play, 'stamp', 300);
  const W = Math.ceil(s.width + 140);
  add('18-italic', 'Italic wordmark', W, 420, `
    ${text(F.play, 'stamp', { size: 300, x: 70, y: 260, fill: C.rose })}
    <path d="M90 330 C ${W * 0.35} 300, ${W * 0.62} 372, ${W - 80} 316" fill="none" stroke="${C.rose}" stroke-width="16" stroke-linecap="round"/>`);
}

// Neon sign
{
  const W = 1300, H = 640;
  const word = text(F.anton, 'STAMP', { size: 300, x: W / 2, y: 380, anchor: 'middle', tracking: 0.08, fill: 'none' });
  add('19-neon', 'Neon sign', W, H, `
    <defs><filter id="n" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="14" result="b1"/><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b2"/>
      <feMerge><feMergeNode in="b1"/><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="${W}" height="${H}" rx="56" fill="#0D0B12"/>
    <g filter="url(#n)">
      <g stroke="#FF4F7E" stroke-width="12" stroke-linejoin="round">${word}</g>
      <g stroke="#FFE2EA" stroke-width="3.5" stroke-linejoin="round">${word}</g>
      <g fill="none">${text(F.mono, 'MEDIA PASSPORT', { size: 40, x: W / 2, y: 500, anchor: 'middle', tracking: 0.42, fill: 'none', extra: 'stroke="#7FE7FF" stroke-width="2.6"' })}</g>
    </g>`, 'dark');
}

// Screen print (misregistered two-colour print over a halftone sun)
{
  const W = 1000, H = 1000;
  add('20-screenprint', 'Screen print', W, H, `
    <defs><pattern id="ht" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="11" cy="11" r="7.5" fill="${C.yellow}"/></pattern></defs>
    <circle cx="560" cy="430" r="330" fill="url(#ht)"/>
    <g style="mix-blend-mode:multiply">${text(F.anton, 'STAMP', { size: 300, x: 512, y: 640, anchor: 'middle', tracking: 0.03, fill: C.sky })}</g>
    <g style="mix-blend-mode:multiply">${text(F.anton, 'STAMP', { size: 300, x: 496, y: 628, anchor: 'middle', tracking: 0.03, fill: C.red })}</g>
    ${text(F.mono, 'ISSUE Nº 1 · MEDIA PASSPORT', { size: 30, x: 500, y: 720, anchor: 'middle', tracking: 0.3, fill: C.ink })}`);
}

// VCR on-screen display
{
  const W = 1280, H = 720;
  add('21-vcr', 'VCR screen', W, H, `
    <defs><pattern id="sl" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" fill-opacity="0.16"/></pattern></defs>
    <rect width="${W}" height="${H}" rx="40" fill="${C.vcrBlue}"/>
    <g fill="#fff">
      <path d="M90 92 L132 116 L90 140 Z"/>
      ${text(F.vt, 'PLAY', { size: 74, x: 150, y: 140 })}
      ${text(F.vt, 'SP 0:20:26', { size: 74, x: W - 90, y: 140, anchor: 'end' })}
    </g>
    ${text(F.vt, 'STAMP', { size: 380, x: W / 2 + 8, y: 498, anchor: 'middle', tracking: 0.04, fill: '#0B1A66' })}
    ${text(F.vt, 'STAMP', { size: 380, x: W / 2, y: 490, anchor: 'middle', tracking: 0.04, fill: '#FFFFFF' })}
    ${text(F.vt, 'MEDIA PASSPORT', { size: 66, x: W / 2, y: 612, anchor: 'middle', tracking: 0.18, fill: '#C9D4FF' })}
    <rect width="${W}" height="${H}" rx="40" fill="url(#sl)"/>`, 'dark');
}

// Marker on tape
{
  const W = 1240, H = 560;
  const tape = 'M70 150 L110 128 L150 150 L1080 132 L1120 112 L1170 136 L1180 420 L1140 444 L1100 424 L170 440 L120 462 L80 440 Z';
  add('22-marker', 'Marker on tape', W, H, `
    <g transform="rotate(-3 ${W / 2} ${H / 2})">
      <path d="${tape}" fill="${C.yellow}" fill-opacity="0.92"/>
      ${text(F.marker, 'Stamp', { size: 270, x: W / 2, y: 288, anchor: 'middle', v: 'middle', fill: C.ink })}
    </g>`);
}

// Rubber stamp (rectangle)
{
  const W = 1240, H = 760;
  add('23-rubber-stamp', 'Rubber stamp', W, H, `
    <defs>${WORN('w', 11, 1.1, 3)}</defs>
    <g filter="url(#w)" transform="rotate(-6 ${W / 2} ${H / 2})" fill="${C.red}">
      <rect x="140" y="140" width="${W - 280}" height="${H - 280}" rx="24" fill="none" stroke="${C.red}" stroke-width="16"/>
      <rect x="168" y="168" width="${W - 336}" height="${H - 336}" rx="12" fill="none" stroke="${C.red}" stroke-width="5"/>
      ${text(F.mono, 'MEDIA PASSPORT', { size: 46, x: W / 2, y: 258, anchor: 'middle', tracking: 0.3, fill: C.red })}
      ${text(F.anton, 'STAMP', { size: 220, x: W / 2, y: 488, anchor: 'middle', tracking: 0.08, fill: C.red })}
      ${text(F.mono, 'ADMITTED', { size: 46, x: W / 2, y: 560, anchor: 'middle', tracking: 0.3, fill: C.red })}
      ${[-1, 1].map((sgn) => `<path d="${star(W / 2 + sgn * (shape(F.mono, 'ADMITTED', 46, 0.3).width / 2 + 52), 544, 22)}"/>`).join('')}
    </g>`);
}

// Modern wordmark
{
  const s = shape(F.inter8, 'Stamp', 250, -0.045);
  add('24-modern-wordmark', 'Modern wordmark', Math.ceil(s.width + 190), 340, `
    ${text(F.inter8, 'Stamp', { size: 250, x: 60, y: 262, tracking: -0.045, fill: '#0A0A0C' })}
    <path d="${star(60 + s.width + 54, 96, 36)}" fill="${C.modernRose}"/>`);
}

// Modern badge
add('25-modern-badge', 'Modern badge', 1000, 1000, `
  <circle cx="500" cy="500" r="480" fill="#0A0A0C"/>
  <circle cx="500" cy="500" r="438" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="5"/>
  ${ring(F.inter6, '•  MEDIA PASSPORT  •  REPUBLIC OF TASTE  ', { cx: 500, cy: 500, r: 372, size: 44, fill: '#ffffff' })}
  <circle cx="500" cy="500" r="318" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="3"/>
  <path d="${star(500, 372, 54)}" fill="${C.modernRose}"/>
  ${text(F.inter8, 'Stamp', { size: 168, x: 500, y: 592, anchor: 'middle', tracking: -0.04, fill: '#fff' })}`, 'dark');

// Passport MRZ
{
  const L1 = 'P<STMPMEDIA<<PASSPORT<<<<<<<<<<<<<<<';
  const L2 = 'STMP2026<<REPUBLIC<OF<TASTE<<<<<<<<<';
  const m = shape(F.mono, L1, 46, 0.08);
  const W = Math.ceil(m.width + 160);
  add('26-mrz', 'Passport line', W, 520, `
    ${text(F.anton, 'STAMP', { size: 190, x: 80, y: 232, tracking: 0.04 })}
    <path d="${star(80 + shape(F.anton, 'STAMP', 190, 0.04).width + 42, 72, 28)}" fill="${C.rose}"/>
    <rect x="80" y="286" width="${W - 160}" height="6" fill="${C.ink}"/>
    ${text(F.mono, L1, { size: 46, x: 80, y: 362, tracking: 0.08 })}
    ${text(F.mono, L2, { size: 46, x: 80, y: 430, tracking: 0.08 })}`);
}

// Film reel
add('27-reel', 'Film reel', 1000, 1000, `
  <defs><mask id="r"><rect width="1000" height="1000" fill="#fff"/>
    ${[0, 72, 144, 216, 288].map((a) => { const t = ((a - 90) * Math.PI) / 180; return `<circle cx="${f2(500 + 258 * Math.cos(t))}" cy="${f2(500 + 258 * Math.sin(t))}" r="118" fill="#000"/>`; }).join('')}
    <circle cx="500" cy="500" r="86" fill="#000"/></mask></defs>
  <circle cx="500" cy="500" r="468" fill="${C.ink}" mask="url(#r)"/>
  <circle cx="500" cy="500" r="430" fill="none" stroke="${C.paper}" stroke-width="6" stroke-dasharray="20 16" mask="url(#r)"/>
  <path d="${star(500, 506, 70)}" fill="${C.rose}"/>`);

/* ── Write SVGs, render PNGs, contact sheet, zip ───────────────────────── */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });

const svgOf = (l, w = l.w, h = l.h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.w} ${l.h}" width="${f2(w)}" height="${f2(h)}"><title>STAMP — ${l.name}</title>${l.body.replace(/\n\s*/g, '')}</svg>\n`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const l of LOGOS) {
  const k = 1024 / Math.max(l.w, l.h);
  fs.writeFileSync(path.join(OUT, `${l.id}.svg`), svgOf(l, l.w * k, l.h * k));
  await page.setViewportSize({ width: Math.ceil(l.w * k), height: Math.ceil(l.h * k) });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svgOf(l, l.w * k, l.h * k)}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(OUT, 'png', `${l.id}.png`), omitBackground: true });
}

// Flat logos compress ~6× as 256-colour PNGs (needs python3 + Pillow; skipped otherwise).
const flat = LOGOS.filter((l) => !l.smooth).map((l) => path.join(OUT, 'png', `${l.id}.png`));
try {
  execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n  Image.open(f).convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f, optimize=True)', ...flat]);
} catch {
  console.warn('Pillow not found; PNGs left at full colour.');
}

const manifest = LOGOS.map(({ id, name, w, h, tile }) => ({ id, name, tile, wide: w / h > 1.25 }));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');

// Contact sheet
const tiles = LOGOS.map(
  (l) => `<figure class="${l.tile}"><div><img src="png/${l.id}.png"></div><figcaption>${l.id.slice(0, 2)} · ${l.name}</figcaption></figure>`,
).join('');
const sheetHtml = `<!doctype html><html><head><base href="file://${OUT}/"><style>
  body{margin:0;padding:40px;background:#e9e4da;font:600 15px/1.3 ui-monospace,Menlo,monospace;color:#181716}
  p{margin:0 0 10px;color:#555}
  main{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
  figure{margin:0;background:#fbf8f2;border-radius:14px;overflow:hidden} figure.dark{background:#141110;color:#efe4cc}
  figure div{aspect-ratio:1;display:grid;place-items:center;padding:26px} img{max-width:100%;max-height:100%}
  figcaption{padding:10px 14px 14px;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
  header{display:flex;align-items:end;gap:24px;margin:0 0 28px} header img{height:84px}
</style></head><body><header><img src="png/07-wordmark.png"><p>${LOGOS.length} logos · SVG + transparent PNG</p></header><main>${tiles}</main></body></html>`;
fs.writeFileSync(path.join(OUT, 'contact-sheet.html'), sheetHtml);
await page.setViewportSize({ width: 1400, height: 1000 });
await page.goto('file://' + path.join(OUT, 'contact-sheet.html'));
await page.waitForLoadState('load');
await page.screenshot({ path: path.join(OUT, 'contact-sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 });
fs.rmSync(path.join(OUT, 'contact-sheet.html'));
await browser.close();

// `--zip <file>` also packs everything into one download.
const zipAt = process.argv.indexOf('--zip');
if (zipAt > 0 && process.argv[zipAt + 1]) {
  const zip = path.resolve(process.argv[zipAt + 1]);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', zip, '.', '-x', 'index.json'], { cwd: OUT });
  console.log(`zip → ${zip}`);
}
console.log(`${LOGOS.length} logos → ${path.relative(ROOT, OUT)}`);
