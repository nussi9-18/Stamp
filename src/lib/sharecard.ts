'use client';

import { SEAL_RING } from '@/components/brand/Seal';

function fontVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, display: string, mono: string) {
  const s = size / 200;
  ctx.save();
  ctx.translate(cx - 100 * s, cy - 100 * s);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(100, 100, 96, 0, Math.PI * 2);
  ctx.fillStyle = '#F9F6F0';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#D95D74';
  ctx.stroke();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(100, 100, 88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // ring text
  ctx.fillStyle = '#181716';
  ctx.font = `17px ${display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const chars = [...SEAL_RING];
  const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    const a = -Math.PI + i * step;
    ctx.save();
    ctx.translate(100 + 72 * Math.cos(a), 100 + 72 * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(100, 100, 54, 0, Math.PI * 2);
  ctx.fillStyle = '#181716';
  ctx.fill();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#F5F1E8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(100, 100, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 13 : 5.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = 100 + r * Math.cos(a);
    const y = 73 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#D95D74';
  ctx.fill();
  ctx.fillStyle = '#F5F1E8';
  ctx.font = `30px ${display}`;
  ctx.fillText('STMP', 100, 114);
  ctx.fillStyle = '#D95D74';
  ctx.font = `700 7px ${mono}`;
  ctx.fillText('P A S S P O R T', 100, 126);
  ctx.restore();
}

export type ShareCardInput = {
  year: number;
  name: string;
  passportNo: string;
  stamps: number;
  hours: number;
  stats: { value: string; label: string }[];
};

/** Renders a 1080×1920 story-format image of the Wrapped hero + 3 stats + seal. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const display = fontVar('--font-anton', 'Anton');
  const italic = fontVar('--font-playfair', 'Georgia');
  const mono = fontVar('--font-jetbrains', 'monospace');
  try {
    await Promise.all([
      document.fonts.load(`100px ${display}`),
      document.fonts.load(`italic 60px ${italic}`),
      document.fonts.load(`700 30px ${mono}`),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#181716';
  ctx.fillRect(0, 0, W, H);

  // grain
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(245,241,232,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  // outlined two-digit year
  ctx.save();
  ctx.font = `760px ${display}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(245,198,208,0.45)';
  ctx.strokeText(String(input.year).slice(-2), W + 30, -60);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F5C6D0';
  ctx.font = `700 34px ${mono}`;
  ctx.fillText(`${input.name.toUpperCase()} / ${input.passportNo}`.slice(0, 40), 84, 840);

  ctx.fillStyle = '#F5F1E8';
  ctx.font = `150px ${display}`;
  ctx.fillText(`${input.stamps} ${input.stamps === 1 ? 'STAMP' : 'STAMPS'}.`, 80, 1000);
  ctx.font = `italic 96px ${italic}`;
  ctx.fillText(`${input.hours} ${input.hours === 1 ? 'hour' : 'hours'} well spent.`, 84, 1105);

  ctx.fillStyle = '#E2DCCE';
  ctx.font = `700 30px ${mono}`;
  ctx.fillText(`YOUR ${input.year} IN STAMPS`, 86, 1175);

  // three stats
  const top = 1240;
  ctx.strokeStyle = 'rgba(245,241,232,0.6)';
  ctx.lineWidth = 2;
  input.stats.slice(0, 3).forEach((s, i) => {
    const y = top + i * 125;
    ctx.beginPath();
    ctx.moveTo(84, y);
    ctx.lineTo(W - 84, y);
    ctx.stroke();
    ctx.fillStyle = '#F5F1E8';
    ctx.font = `88px ${display}`;
    ctx.fillText(s.value, 84, y + 98);
    ctx.fillStyle = '#F5C6D0';
    ctx.font = `700 28px ${mono}`;
    ctx.textAlign = 'right';
    ctx.fillText(s.label.toUpperCase(), W - 84, y + 86);
    ctx.textAlign = 'left';
  });

  ctx.beginPath();
  ctx.moveTo(84, top + 3 * 125);
  ctx.lineTo(W - 84, top + 3 * 125);
  ctx.stroke();

  drawSeal(ctx, W - 190, H - 170, 220, display, mono);
  ctx.fillStyle = '#F5F1E8';
  ctx.font = `56px ${display}`;
  ctx.fillText('STAMP', 84, H - 140);
  ctx.fillStyle = '#E2DCCE';
  ctx.font = `700 26px ${mono}`;
  ctx.fillText('MEDIA PASSPORT', 86, H - 100);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render'))), 'image/png'));
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My year in stamps' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
