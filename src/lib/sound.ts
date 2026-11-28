'use client';

// STAMP sound design. Every sound is synthesised with Web Audio — no audio files, nothing to license.
// Retro: mechanical and analog (plastic keys, VCR piano keys, a ticket punch, a rubber stamp,
// a lamp pull-chain, paper, a VHS motor, a Dymo label maker).
// Modern: quiet and short, in the spirit of iOS (soft ticks, a gentle chime when you stamp).

export type Sfx =
  | 'key'
  | 'piano'
  | 'select'
  | 'punch'
  | 'stamp'
  | 'stamp-soft'
  | 'cord'
  | 'toggle'
  | 'slide'
  | 'page'
  | 'tape'
  | 'toast'
  | 'error'
  | 'success'
  | 'open'
  | 'applause';

type Look = 'modern' | 'retro';
type Play = (c: AudioContext, out: AudioNode, t: number) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;
let look: Look = 'retro';
let lastAt: Record<string, number> = {};

/** Called whenever the passport's sound setting or look changes. */
export function configureSound(opts: { on: boolean; look: Look }) {
  enabled = opts.on;
  look = opts.look;
}

export function soundEnabled() {
  return enabled;
}

/** Create / resume the audio context. Must run inside a user gesture the first time (iOS, Chrome). */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Play a named sound in the current look (no-op when sounds are off or the page is hidden). */
export function sfx(name: Sfx, opts: { force?: boolean } = {}) {
  if ((!enabled && !opts.force) || typeof document === 'undefined' || document.hidden) return;
  unlockAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  // The same sound twice within 35ms is one event reaching us twice (pointer + keyboard).
  const now = performance.now();
  if (now - (lastAt[name] ?? 0) < 35) return;
  lastAt[name] = now;
  const play = (look === 'retro' ? RETRO : MODERN)[name];
  if (!play) return;
  try {
    const level = ctx.createGain();
    level.gain.value = LEVEL[look][name] ?? 1;
    level.connect(master);
    play(ctx, level, ctx.currentTime + 0.004);
  } catch {
    /* never let a sound break the UI */
  }
}

/**
 * Loudness of each sound, measured from offline renders so that ticks sit around −18 dB,
 * the bell and errors around −11 dB and the stamp itself near −2 dB. Modern is a step quieter.
 */
export const LEVEL: Record<Look, Partial<Record<Sfx, number>>> = {
  retro: {
    key: 5, piano: 3, select: 7, punch: 3.2, stamp: 2.2, 'stamp-soft': 3.4, cord: 2.5, toggle: 2.5,
    slide: 10, page: 0.8, tape: 2.5, toast: 4, error: 4.2, success: 10, open: 9, applause: 4.3,
  },
  modern: {
    key: 9, piano: 9, select: 8, punch: 11, stamp: 7.5, 'stamp-soft': 7, cord: 5, toggle: 5,
    slide: 14, page: 9, toast: 11, error: 6, success: 7.5, open: 12, applause: 8,
  },
};

/* ── Building blocks ──────────────────────────────────────────────────── */

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function envelope(c: AudioContext, t: number, gain: number, attack: number, dur: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: { freq: number; to?: number; dur: number; gain?: number; type?: OscillatorType; attack?: number; lowpass?: number },
) {
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = envelope(c, t, o.gain ?? 0.2, o.attack ?? 0.002, o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
}

function noise(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; attack?: number },
) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = envelope(c, t, o.gain ?? 0.2, o.attack ?? 0.001, o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.03);
}

const jitter = (n: number, amt = 0.06) => n * (1 + (Math.random() * 2 - 1) * amt);

/* ── Retro: things you can touch ──────────────────────────────────────── */

const RETRO: Partial<Record<Sfx, Play>> = {
  // A chunky plastic key bottoming out.
  key: (c, o, t) => {
    noise(c, o, t, { dur: 0.02, gain: 0.32, freq: jitter(2600), q: 1.3 });
    tone(c, o, t + 0.003, { freq: jitter(150), to: 85, dur: 0.055, gain: 0.2 });
  },
  // A VCR piano key: press, then the latch catching.
  piano: (c, o, t) => {
    noise(c, o, t, { dur: 0.028, gain: 0.38, freq: jitter(1500), q: 1 });
    tone(c, o, t, { freq: jitter(118), to: 68, dur: 0.085, gain: 0.3 });
    noise(c, o, t + 0.04, { dur: 0.012, gain: 0.22, type: 'highpass', freq: 3200 });
  },
  select: (c, o, t) => {
    noise(c, o, t, { dur: 0.014, gain: 0.24, freq: jitter(3000), q: 1.4 });
    tone(c, o, t, { freq: jitter(180), to: 110, dur: 0.04, gain: 0.12 });
  },
  // A ticket punch: a sharp snap, a tiny metal ring, paper giving way.
  punch: (c, o, t) => {
    noise(c, o, t, { dur: 0.008, gain: 0.5, type: 'highpass', freq: 4500 });
    tone(c, o, t, { freq: jitter(3400, 0.03), dur: 0.1, gain: 0.05, type: 'triangle' });
    noise(c, o, t + 0.012, { dur: 0.05, gain: 0.2, freq: 1200, q: 0.8 });
  },
  // The rubber stamp: a short rush of air, a deep thud, the paper slap, a little rattle.
  stamp: (c, o, t) => {
    noise(c, o, t, { dur: 0.06, gain: 0.1, type: 'lowpass', freq: 900, to: 250, attack: 0.02 });
    tone(c, o, t + 0.05, { freq: 135, to: 42, dur: 0.24, gain: 0.95 });
    noise(c, o, t + 0.05, { dur: 0.075, gain: 0.5, freq: 850, q: 0.7 });
    noise(c, o, t + 0.15, { dur: 0.016, gain: 0.14, freq: 2400, q: 2 });
  },
  'stamp-soft': (c, o, t) => {
    tone(c, o, t + 0.02, { freq: 150, to: 60, dur: 0.16, gain: 0.55 });
    noise(c, o, t + 0.02, { dur: 0.05, gain: 0.28, freq: 1000, q: 0.8 });
  },
  // Lamp pull-chain: the beads rattle, the switch clacks.
  cord: (c, o, t) => {
    noise(c, o, t, { dur: 0.01, gain: 0.25, freq: 3200, q: 2 });
    [0.025, 0.045, 0.07, 0.095].forEach((d) => noise(c, o, t + d, { dur: 0.006, gain: 0.1, type: 'highpass', freq: 5000 }));
    noise(c, o, t + 0.15, { dur: 0.022, gain: 0.42, freq: 1800, q: 1 });
    tone(c, o, t + 0.15, { freq: 240, to: 150, dur: 0.06, gain: 0.14, type: 'square', lowpass: 1600 });
  },
  toggle: (c, o, t) => RETRO.cord!(c, o, t),
  // The stamp sliding along its rail.
  slide: (c, o, t) => {
    noise(c, o, t, { dur: 0.24, gain: 0.16, freq: 480, to: 1500, q: 0.9, attack: 0.04 });
  },
  page: (c, o, t) => {
    noise(c, o, t, { dur: 0.26, gain: 0.18, freq: 900, to: 2800, q: 0.6, attack: 0.05 });
    noise(c, o, t + 0.13, { dur: 0.12, gain: 0.08, type: 'highpass', freq: 3500, attack: 0.02 });
  },
  // A VHS tape being taken in: motor whirr, then the clunk.
  tape: (c, o, t) => {
    tone(c, o, t, { freq: 55, to: 88, dur: 0.3, gain: 0.07, type: 'sawtooth', lowpass: 420, attack: 0.03 });
    noise(c, o, t, { dur: 0.28, gain: 0.045, type: 'lowpass', freq: 600, attack: 0.03 });
    noise(c, o, t + 0.29, { dur: 0.03, gain: 0.3, freq: 700, q: 1 });
    tone(c, o, t + 0.29, { freq: 92, to: 50, dur: 0.08, gain: 0.24 });
  },
  // A Dymo label maker embossing a few letters.
  toast: (c, o, t) => {
    for (let i = 0; i < 4; i++) {
      noise(c, o, t + i * 0.048, { dur: 0.012, gain: 0.26, freq: 1900 + i * 160, q: 1.5 });
      tone(c, o, t + i * 0.048, { freq: 175, dur: 0.03, gain: 0.07 });
    }
  },
  // A VCR refusing a tape.
  error: (c, o, t) => {
    tone(c, o, t, { freq: 130, dur: 0.09, gain: 0.11, type: 'square', lowpass: 1200 });
    tone(c, o, t + 0.12, { freq: 98, dur: 0.13, gain: 0.11, type: 'square', lowpass: 1200 });
  },
  // A small desk bell.
  success: (c, o, t) => {
    tone(c, o, t, { freq: 1318, dur: 0.6, gain: 0.12 });
    tone(c, o, t, { freq: 2637, dur: 0.28, gain: 0.04 });
    tone(c, o, t, { freq: 3950, dur: 0.12, gain: 0.015 });
  },
  // The passport cover's leather hinge.
  open: (c, o, t) => {
    noise(c, o, t, { dur: 0.38, gain: 0.06, type: 'lowpass', freq: 300, to: 900, attack: 0.08 });
    tone(c, o, t, { freq: 85, to: 120, dur: 0.32, gain: 0.04, type: 'sawtooth', lowpass: 500, attack: 0.06 });
  },
  applause: (c, o, t) => clap(c, o, t, 3),
};

/* ── Modern: quiet and short ──────────────────────────────────────────── */

const MODERN: Partial<Record<Sfx, Play>> = {
  key: (c, o, t) => {
    tone(c, o, t, { freq: 1700, to: 1250, dur: 0.014, gain: 0.07 });
    noise(c, o, t, { dur: 0.005, gain: 0.04, type: 'highpass', freq: 6000 });
  },
  piano: (c, o, t) => tone(c, o, t, { freq: 2200, to: 1700, dur: 0.012, gain: 0.07 }),
  select: (c, o, t) => tone(c, o, t, { freq: 2400, to: 1800, dur: 0.01, gain: 0.07 }),
  punch: (c, o, t) => {
    tone(c, o, t, { freq: 1200, dur: 0.05, gain: 0.07 });
    tone(c, o, t + 0.025, { freq: 1800, dur: 0.06, gain: 0.05 });
  },
  // A soft thud and a gentle chime.
  stamp: (c, o, t) => {
    tone(c, o, t, { freq: 170, to: 70, dur: 0.16, gain: 0.42 });
    tone(c, o, t + 0.06, { freq: 880, dur: 0.38, gain: 0.08 });
    tone(c, o, t + 0.06, { freq: 1320, dur: 0.44, gain: 0.055 });
  },
  'stamp-soft': (c, o, t) => {
    tone(c, o, t, { freq: 160, to: 80, dur: 0.12, gain: 0.3 });
    tone(c, o, t + 0.05, { freq: 660, dur: 0.25, gain: 0.05 });
  },
  toggle: (c, o, t) => {
    tone(c, o, t, { freq: 900, dur: 0.014, gain: 0.08 });
    tone(c, o, t + 0.06, { freq: 1350, dur: 0.014, gain: 0.08 });
  },
  cord: (c, o, t) => MODERN.toggle!(c, o, t),
  slide: (c, o, t) => noise(c, o, t, { dur: 0.14, gain: 0.05, freq: 1500, to: 3500, attack: 0.03 }),
  page: (c, o, t) => noise(c, o, t, { dur: 0.16, gain: 0.05, freq: 1400, to: 3200, q: 0.7, attack: 0.03 }),
  toast: (c, o, t) => tone(c, o, t, { freq: 660, to: 880, dur: 0.06, gain: 0.06 }),
  error: (c, o, t) => {
    tone(c, o, t, { freq: 440, dur: 0.1, gain: 0.08, type: 'triangle' });
    tone(c, o, t + 0.1, { freq: 330, dur: 0.14, gain: 0.08, type: 'triangle' });
  },
  success: (c, o, t) => {
    tone(c, o, t, { freq: 660, dur: 0.14, gain: 0.08 });
    tone(c, o, t + 0.08, { freq: 990, dur: 0.22, gain: 0.08 });
  },
  open: (c, o, t) => tone(c, o, t, { freq: 520, to: 780, dur: 0.12, gain: 0.05 }),
  applause: (c, o, t) => clap(c, o, t, 2, 0.6),
};

/** A few people clapping. */
function clap(c: AudioContext, o: AudioNode, t: number, claps: number, level = 1) {
  for (let i = 0; i < claps; i++) {
    const at = t + i * 0.11 + Math.random() * 0.02;
    for (let k = 0; k < 3; k++) noise(c, o, at + k * 0.009, { dur: 0.03, gain: 0.32 * level, freq: jitter(1150, 0.15), q: 0.9 });
  }
}

/* ── Button sounds, wired once for the whole app ──────────────────────── */

/** Which sound a pressed control makes, unless it says otherwise with data-sfx. */
function soundFor(el: Element): Sfx | null {
  const named = el.getAttribute('data-sfx');
  if (named) return named === 'none' ? null : (named as Sfx);
  if (el.matches('.seg > button, .preset, .radio-card, .tab, .tab-stamp, .rail-link')) return 'piano';
  if (el.matches('.chip, .look-card, .pick-row, .pp-chip')) return 'select';
  if (el.matches('.star-btn')) return 'punch';
  return 'key';
}

const PRESSABLE = '[data-sfx], button, a[href], [role="button"], label.radio-card, summary';

/** Install one listener that gives every button a press sound. Returns a cleanup function. */
export function installButtonSounds(): () => void {
  const onDown = (e: PointerEvent) => {
    unlockAudio();
    if (e.button !== 0) return;
    const el = (e.target as Element | null)?.closest(PRESSABLE);
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    const s = soundFor(el);
    if (s) sfx(s);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    unlockAudio();
    const el = (e.target as Element | null)?.closest(PRESSABLE);
    if (!el || el.matches('input, textarea, select') || (el as HTMLButtonElement).disabled) return;
    const s = soundFor(el);
    if (s) sfx(s);
  };
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  document.addEventListener('keydown', onKey, { capture: true });
  return () => {
    document.removeEventListener('pointerdown', onDown, { capture: true });
    document.removeEventListener('keydown', onKey, { capture: true });
  };
}

/** Every sound in both looks (for previews and tests). */
export const SOUND_BANK = { retro: RETRO, modern: MODERN };
