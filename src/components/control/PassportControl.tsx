'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { formatDate, initials, todayISO } from '@/lib/format';
import { mrzLines } from '@/lib/mrz';
import { auth, AuthError, EMAIL_RE, type AuthUser } from '@/lib/auth/adapter';
import { cancelControl, completeSignOut, issuePassport, migrateLocal, resolveLocal, resolveUser, walkThrough, type Resolution } from '@/lib/auth/session';
import { getState, liveStamps, setState, type ControlIntent, type UserData } from '@/lib/store/store';
import { AFFINITIES } from '@/lib/types';
import { AppleMark, GoogleMark } from '../brand/Icon';
import { Seal } from '../brand/Seal';
import { StampArt } from '../brand/Stamp';
import { playThunk } from '../app/AppShell';
import './control.css';

/** All Passport Control timings in one place (ms) so they can be tuned (§9.8). */
export const PC_TIMING = {
  entrance: 500,
  breatheDelay: 520,
  breathe: 400,
  crossfade: 200,
  checkingTurn: 1200,
  restTurn: 40000,
  press: 420,
  hinge: 1000,
  closeHinge: 700,
  mrzChar: 11,
  slam: 620,
  exitSlam: 480,
  impact: 220,
  walk: 680,
  walkFallback: 300,
  skipAfter: 1400,
  flip: 180,
  photoWipe: 600,
  initials: 200,
  nameChar: 30,
  numberRoll: 600,
  shake: 240,
  resend: 30,
} as const;

type Form = 'email' | 'code' | 'link' | 'issue' | 'none';
type StampKind = null | 'admitted' | 'issued' | 'exit';
type HolderView = {
  name: string;
  typed: number;
  number: string;
  issued: string;
  showDate: boolean;
  aff: string[];
  showAff: boolean;
  photo: 'blank' | 'wipe' | 'full';
  initials: 'none' | 'pop' | 'show';
  mrz: [string, string];
  mrzTyped: number;
  mrzCursor: boolean;
};

const BLANK: HolderView = {
  name: '',
  typed: 0,
  number: '',
  issued: '',
  showDate: false,
  aff: [],
  showAff: false,
  photo: 'blank',
  initials: 'none',
  mrz: ['', ''],
  mrzTyped: 0,
  mrzCursor: false,
};

function fullHolder(d: UserData): HolderView {
  const p = d.passport!;
  return {
    name: p.name,
    typed: p.name.length,
    number: p.passportNo,
    issued: p.issued,
    showDate: true,
    aff: p.affinities,
    showAff: true,
    photo: 'full',
    initials: 'show',
    mrz: mrzLines(p.name, p.passportNo, liveStamps(d).length, p.issued),
    mrzTyped: 44,
    mrzCursor: false,
  };
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

const MSG = {
  email: 'Enter an email like name@example.com.',
  code: 'That code didn’t match. Check the email and try again.',
  rate: 'Too many tries. Wait a minute, then try again.',
  network: 'Can’t reach passport control. Check your connection and try again.',
  name: 'Type the name to print on your passport.',
};

const TICKER = 'P<STMP<<EVERY<FILM<YOU<WATCH<<GETS<A<STAMP<<<<<<<<<<<<<<<<<<   STMP2026<032FILMS<15COUNTRIES<<REPUBLIC<OF<CINEMA<<<<<<<<<<   ';

export function PassportControl({ intent }: { intent: ControlIntent | null }) {
  const reduce = useReducedMotion();
  const a = auth();
  const T = PC_TIMING;
  const emailId = useId();
  const nameId = useId();

  const [form, setForm] = useState<Form>(intent?.kind === 'oauth-return' || intent?.kind === 'exit' ? 'none' : 'email');
  const [checking, setChecking] = useState(intent?.kind === 'oauth-return');
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [netErr, setNetErr] = useState<{ text: string; retry: () => void } | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, setPending] = useState<Extract<Resolution, { kind: 'new' }> | null>(null);
  const [name, setName] = useState('');
  const [aff, setAff] = useState<string[]>([]);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [flip, setFlip] = useState<'out' | 'in' | null>(null);
  const [status, setStatus] = useState('');

  const exitData = intent?.kind === 'exit' ? getState().data : null;
  const [open, setOpen] = useState(intent?.kind === 'exit');
  const [closing, setClosing] = useState(false);
  const [holder, setHolder] = useState<HolderView>(() => (exitData?.passport ? fullHolder(exitData) : BLANK));
  const [stamp, setStamp] = useState<StampKind>(null);
  const [thud, setThud] = useState(false);
  const [shake, setShake] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const [walking, setWalking] = useState(false);
  const [vtHolder, setVtHolder] = useState(false);
  const [entering] = useState(intent?.kind !== 'exit');

  const sealRef = useRef<HTMLDivElement>(null);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<Form>(form);
  formRef.current = form;
  const busyRef = useRef(false);
  const skip = useRef<{ fired: boolean; cut?: () => void }>({ fired: false });
  const startedExit = useRef(false);
  const startedReturn = useRef(false);
  const soundOn = useRef(false);

  /* ── helpers ─────────────────────────────────────────────── */

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((res) => {
        if (skip.current.fired || ms <= 0) return res();
        const t = setTimeout(res, ms);
        skip.current.cut = () => {
          clearTimeout(t);
          res();
        };
      }),
    [],
  );

  const doShake = () => {
    if (reduce) return;
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    setTimeout(() => setShake(false), T.shake + 40);
  };

  const pressSeal = () => {
    if (reduce) return;
    sealRef.current?.animate(
      [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(.84) rotate(-6deg)', offset: 0.5 }, { transform: 'scale(1) rotate(0deg)' }],
      { duration: T.press, easing: 'ease-in-out' },
    );
  };

  const impact = () => {
    try {
      navigator.vibrate?.([18, 40, 30]);
    } catch {
      /* ignore */
    }
    if (soundOn.current) playThunk();
    if (reduce) return;
    setThud(false);
    requestAnimationFrame(() => setThud(true));
    setTimeout(() => setThud(false), 320);
  };

  const typeMRZ = async (lines: [string, string]) => {
    if (reduce || skip.current.fired) {
      setHolder((h) => ({ ...h, mrz: lines, mrzTyped: 44, mrzCursor: false }));
      return;
    }
    setHolder((h) => ({ ...h, mrz: lines, mrzTyped: 0, mrzCursor: true }));
    for (let n = 1; n <= 44; n++) {
      if (skip.current.fired) break;
      await new Promise((r) => setTimeout(r, T.mrzChar));
      setHolder((h) => ({ ...h, mrzTyped: n }));
    }
    setHolder((h) => ({ ...h, mrzTyped: 44, mrzCursor: false }));
  };

  /* Seal ring speeds up to one turn per 1.2s while checking. */
  useEffect(() => {
    const ring = sealRef.current?.querySelector('.seal-ring');
    const anims = ring?.getAnimations?.() ?? [];
    for (const an of anims) {
      try {
        an.updatePlaybackRate(checking && !reduce ? T.restTurn / T.checkingTurn : 1);
      } catch {
        an.playbackRate = checking && !reduce ? T.restTurn / T.checkingTurn : 1;
      }
    }
  }, [checking, reduce, T.restTurn, T.checkingTurn]);

  /* Entrance: slide up + fade (500ms), then the seal breathes once. */
  useEffect(() => {
    if (!entering || reduce) return;
    const t = setTimeout(() => {
      sealRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: T.breathe, easing: 'ease-in-out' });
    }, T.breatheDelay);
    return () => clearTimeout(t);
  }, [entering, reduce, T.breathe, T.breatheDelay]);

  /* Resend countdown */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /* ── sequences ───────────────────────────────────────────── */

  const walk = async (data: UserData, isNew: boolean) => {
    setSkippable(false);
    const hasVT = typeof (document as { startViewTransition?: unknown }).startViewTransition === 'function';
    if (hasVT && !reduce) {
      setVtHolder(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await walkThrough(data, isNew);
    } else {
      setWalking(true);
      await new Promise((r) => setTimeout(r, reduce ? 200 : T.walkFallback));
      await walkThrough(data, isNew);
    }
  };

  /** 9.3 Success — returning user ("ADMITTED"), ≈3.2s, skippable by tap after 1.4s. */
  const runAdmitted = async (data: UserData) => {
    busyRef.current = true;
    soundOn.current = !!data.prefs.sound;
    skip.current = { fired: false };
    setHolder({ ...fullHolder(data), mrzTyped: 0 });
    setChecking(false);
    setNetErr(null);
    setForm('none');
    setStatus('Papers checked. Admitted.');
    pressSeal();
    await sleep(T.press);
    setOpen(true);
    const skipTimer = setTimeout(() => setSkippable(true), T.skipAfter - T.press);
    await sleep(reduce ? 200 : T.hinge);
    await typeMRZ(fullHolder(data).mrz);
    setStamp('admitted');
    await sleep(reduce ? 200 : T.impact);
    if (!skip.current.fired) impact();
    await sleep(reduce ? 0 : T.slam - T.impact);
    clearTimeout(skipTimer);
    if (skip.current.fired) {
      setOpen(true);
      setHolder(fullHolder(data));
      setStamp('admitted');
    }
    await walk(data, false);
  };

  /** 9.4 Success — new user ("ISSUED"): the printing sequence. */
  const runIssuing = async (res: Extract<Resolution, { kind: 'new' }>) => {
    if (!name.trim()) {
      setNameErr(MSG.name);
      doShake();
      document.getElementById(nameId)?.focus();
      return;
    }
    busyRef.current = true;
    setChecking(true);
    setNetErr(null);
    let data: UserData;
    try {
      data = await issuePassport(res, name.trim().slice(0, 40), aff);
    } catch {
      busyRef.current = false;
      setChecking(false);
      setNetErr({ text: MSG.network, retry: () => void runIssuing(res) });
      return;
    }
    setChecking(false);
    skip.current = { fired: false };
    const full = fullHolder(data);
    setHolder({ ...BLANK, name: full.name, number: '', issued: full.issued, aff: full.aff, mrz: full.mrz });
    setForm('none');
    setStatus('Issuing your passport.');
    pressSeal();
    await sleep(T.press);
    setOpen(true);
    await sleep(reduce ? 200 : T.hinge);

    if (reduce) {
      setHolder(full);
      await sleep(200);
    } else {
      // Photo slot fills with halftone in a top-to-bottom wipe, then the initials stamp in.
      setHolder((h) => ({ ...h, photo: 'wipe' }));
      await sleep(T.photoWipe - 120);
      setHolder((h) => ({ ...h, initials: 'pop' }));
      await sleep(T.initials);
      // Name types in (30ms per letter) while the number rolls like slot-machine digits (600ms).
      const digitsFinal = full.number.replace('STMP-', '').split('');
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = performance.now() - t0;
          const typed = Math.min(full.name.length, Math.floor(t / T.nameChar) + 1);
          const settled = Math.floor(t / (T.numberRoll / 4));
          const frame = Math.floor(t / 40);
          const num = digitsFinal.map((d, i) => (i < settled ? d : String((frame + i * 3) % 10))).join('');
          setHolder((h) => ({ ...h, typed, number: `STMP-${num}` }));
          if (typed >= full.name.length && settled >= 4) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      setHolder((h) => ({ ...h, typed: full.name.length, number: full.number, showDate: true, showAff: true }));
      await sleep(160);
      await typeMRZ(full.mrz);
    }
    setStamp('issued');
    setStatus('Passport issued.');
    await sleep(reduce ? 200 : T.impact);
    impact();
    await sleep(reduce ? 0 : T.slam - T.impact + 120);
    await walk(data, true);
  };

  /** 9.6 Sign out ("EXIT"). */
  useEffect(() => {
    if (intent?.kind !== 'exit' || startedExit.current) return;
    startedExit.current = true;
    (async () => {
      soundOn.current = !!getState().data?.prefs.sound;
      await sleep(380);
      setStamp('exit');
      await sleep(reduce ? 200 : T.impact);
      impact();
      await sleep(reduce ? 0 : T.exitSlam - T.impact + 260);
      await completeSignOut();
      setClosing(true);
      setOpen(false);
      await sleep(reduce ? 200 : T.closeHinge);
      setStamp(null);
      setHolder(BLANK);
      setClosing(false);
      setForm('email');
      setState({ control: null });
      setStatus('Signed out.');
    })();
  }, [intent?.kind, reduce, sleep, T.impact, T.exitSlam, T.closeHinge]);

  /* ── resolution ─────────────────────────────────────────── */

  const handleResolution = async (res: Resolution, retry: () => void) => {
    if (res.kind === 'returning') {
      await runAdmitted(res.data);
      return;
    }
    if (res.kind === 'error') {
      busyRef.current = false;
      setChecking(false);
      setNetErr({ text: MSG.network, retry });
      return;
    }
    busyRef.current = false;
    setChecking(false);
    setPending(res);
    // The cover stays closed and the form area flips (rotateX 90° out / in, 2×180ms).
    if (reduce) {
      setForm('issue');
    } else {
      setFlip('out');
      await new Promise((r) => setTimeout(r, T.flip));
      setForm('issue');
      setFlip('in');
      await new Promise((r) => setTimeout(r, T.flip));
      setFlip(null);
    }
    setStatus('Issue your passport.');
    setTimeout(() => document.getElementById(nameId)?.focus(), 30);
  };

  const signedIn = async (u: AuthUser, retry: () => void) => {
    const mode = a.kind === 'supabase' ? 'account' : 'demo';
    const res = intent?.kind === 'save' ? (a.kind === 'supabase' ? await migrateLocal(u) : await demoMigrate(u)) : await resolveUser(u, mode);
    await handleResolution(res, retry);
  };

  /** Demo mode has no server: saving a local passport moves it under the demo account id. */
  const demoMigrate = async (u: AuthUser): Promise<Resolution> => {
    const local = getState().data;
    if (!local?.passport) return resolveUser(u, 'demo');
    const data: UserData = { ...local, userId: u.id, mode: 'demo', email: u.email };
    const { idbSet, idbDel } = await import('@/lib/store/idb');
    await idbSet(`user:${u.id}`, data);
    await idbDel('user:local');
    return { kind: 'returning', data };
  };

  const failWith = (err: unknown, where: 'email' | 'code', retry: () => void) => {
    busyRef.current = false;
    setChecking(false);
    const code = err instanceof AuthError ? err.code : 'unknown';
    if (code === 'network' || code === 'unknown') {
      setNetErr({ text: MSG.network, retry });
      return;
    }
    doShake();
    if (code === 'rate') {
      if (where === 'email') setEmailErr(MSG.rate);
      else setCodeErr(MSG.rate);
      return;
    }
    if (code === 'invalid-email' || where === 'email') {
      setEmailErr(MSG.email);
      emailRef.current?.focus();
      return;
    }
    setCodeErr(MSG.code);
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => digitRefs.current[0]?.focus(), 20);
  };

  /* OAuth / magic-link return: resolve with the checking animation. */
  useEffect(() => {
    if (intent?.kind !== 'oauth-return' || startedReturn.current) return;
    startedReturn.current = true;
    const go = async () => {
      setChecking(true);
      setNetErr(null);
      try {
        const u = await a.current();
        try {
          sessionStorage.removeItem('stamp:oauth');
        } catch {
          /* ignore */
        }
        if (!u) {
          setChecking(false);
          setForm('email');
          setState({ control: null });
          return;
        }
        await signedIn(u, go);
      } catch (e) {
        failWith(e, 'email', go);
      }
    };
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.kind]);

  /* Magic link opened in another tab signs this tab in too. */
  useEffect(() => {
    return a.onSignIn((u) => {
      if (formRef.current !== 'link' || busyRef.current) return;
      busyRef.current = true;
      setChecking(true);
      void signedIn(u, () => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── actions ────────────────────────────────────────────── */

  const submitEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailErr(MSG.email);
      doShake();
      emailRef.current?.focus();
      return;
    }
    setEmailErr(null);
    setNetErr(null);
    setChecking(true);
    setStatus('Checking papers…');
    try {
      await a.sendCode(value);
      setChecking(false);
      setDigits(['', '', '', '', '', '']);
      setCodeErr(null);
      setResendIn(T.resend);
      setForm('code');
      setStatus(`Enter the 6-digit code we sent to ${value}`);
      setTimeout(() => digitRefs.current[0]?.focus(), T.crossfade);
    } catch (err) {
      failWith(err, 'email', () => void submitEmail());
    }
  };

  const verify = async (code: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCodeErr(null);
    setNetErr(null);
    setChecking(true);
    setStatus('Checking papers…');
    try {
      const u = await a.verify(email.trim(), code);
      await signedIn(u, () => void verify(code));
    } catch (err) {
      failWith(err, 'code', () => void verify(code));
    }
  };

  const setDigit = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    setCodeErr(null);
    if (clean.length > 1) {
      // paste / one-time-code autofill: spread across the boxes
      const next = [...digits];
      clean
        .slice(0, 6 - i)
        .split('')
        .forEach((ch, k) => (next[i + k] = ch));
      setDigits(next);
      const last = Math.min(5, i + clean.length);
      digitRefs.current[last]?.focus();
      if (next.every((d) => d)) void verify(next.join(''));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) digitRefs.current[i + 1]?.focus();
    if (next.every((d) => d)) void verify(next.join(''));
  };

  const onDigitKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      digitRefs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) digitRefs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) digitRefs.current[i + 1]?.focus();
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setCodeErr(null);
    setChecking(true);
    try {
      await a.sendCode(email.trim());
      setResendIn(T.resend);
      setDigits(['', '', '', '', '', '']);
      setStatus('A new code is on its way.');
      digitRefs.current[0]?.focus();
    } catch (err) {
      failWith(err, 'code', () => void resend());
    } finally {
      setChecking(false);
    }
  };

  const useLink = async () => {
    setChecking(true);
    setNetErr(null);
    try {
      await a.sendLink(email.trim());
      // The scan line keeps going while form === 'link' (see isChecking below).
      setChecking(false);
      setForm('link');
      setStatus(`Check your email. We sent a link to ${email.trim()}.`);
    } catch (err) {
      failWith(err, 'code', () => void useLink());
    }
  };

  const demoOpenLink = async () => {
    if (!a.demoLink || busyRef.current) return;
    busyRef.current = true;
    try {
      const u = await a.demoLink(email.trim());
      await signedIn(u, () => undefined);
    } catch (err) {
      failWith(err, 'code', () => void demoOpenLink());
    }
  };

  const oauth = async (provider: 'apple' | 'google') => {
    setNetErr(null);
    setEmailErr(null);
    setChecking(true);
    setStatus('Checking papers…');
    try {
      const r = await a.oauth(provider);
      if (r === 'redirect') return;
      await signedIn(r, () => void oauth(provider));
    } catch (err) {
      failWith(err, 'email', () => void oauth(provider));
    }
  };

  const goLocal = async () => {
    setNetErr(null);
    setEmailErr(null);
    setChecking(true);
    setStatus('Checking papers…');
    await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
    const res = await resolveLocal();
    await handleResolution(res, () => void goLocal());
  };

  const onSkip = () => {
    if (!skippable) return;
    skip.current.fired = true;
    skip.current.cut?.();
    setSkippable(false);
  };

  /* ── render ─────────────────────────────────────────────── */

  const isChecking = checking || form === 'link';
  const today = formatDate(todayISO());
  const code = a.demoCode?.() ?? null;
  const formCls = ['pp-form', form === 'none' ? 'is-hidden' : '', flip === 'out' ? 'flip-out' : flip === 'in' ? 'flip-in' : ''].filter(Boolean).join(' ');

  return (
    <div className={`pc force-day${walking ? ' is-walking' : ''}`}>
      <h1 className="sr-only">Passport control — sign in to STAMP</h1>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {intent?.kind === 'save' && form === 'email' ? (
        <button type="button" className="btn btn-sec pc-back" onClick={cancelControl}>
          ← Back to my passport
        </button>
      ) : null}
      {skippable ? <button type="button" className="pc-skip" aria-label="Skip to your passport" onClick={onSkip} /> : null}

      <div className="pc-stage">
        <div className={['pc-desk', open ? 'is-open' : '', entering ? 'is-entering' : '', form === 'link' ? 'has-envelope' : ''].filter(Boolean).join(' ')}>
          <div className={['passport', thud ? 'thud' : '', shake ? 'shake' : ''].filter(Boolean).join(' ')}>
            {/* Pages under the cover */}
            <div className="pp-pages">
              <div className={`hp${vtHolder ? ' vt-holder' : ''}`} style={{ containerType: 'inline-size' }} aria-hidden={!open}>
                <div className="hp-band">
                  <span className="display">STAMP</span>
                  <span className="mono">Media passport / Passeport culturel</span>
                </div>
                <div className="hp-top">
                  <div className="hp-photo">
                    {holder.photo !== 'blank' ? <div className={`hp-photo-fill${holder.photo === 'wipe' ? ' wipe' : ''}`} /> : null}
                    {holder.initials !== 'none' ? <span className={`hp-initials${holder.initials === 'pop' ? ' pop' : ''}`}>{initials(holder.name)}</span> : null}
                  </div>
                  <dl className="hp-fields">
                    <div>
                      <dt>Holder</dt>
                      <dd className="hp-name">{holder.name.slice(0, holder.typed)}</dd>
                    </div>
                    <div>
                      <dt>Passport no.</dt>
                      <dd>{holder.number}</dd>
                    </div>
                    <div>
                      <dt>Issued</dt>
                      <dd className="hp-date" style={{ opacity: holder.showDate ? 1 : 0 }}>
                        {holder.issued ? formatDate(holder.issued) : ''}
                      </dd>
                    </div>
                  </dl>
                </div>
                {holder.showAff && holder.aff.length ? (
                  <div className="hp-aff">
                    {holder.aff.map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                ) : null}
                <div className="hp-spacer" />
                <div className="hp-mrz">
                  <div className="mrz">
                    <span className="mrz-line">{holder.mrz[0].slice(0, holder.mrzTyped) || ' '}</span>
                    <span className="mrz-line">
                      {holder.mrz[1].slice(0, holder.mrzTyped)}
                      {holder.mrzCursor ? <span className="pc-cursor" aria-hidden="true" /> : null}
                    </span>
                  </div>
                </div>
                {stamp ? (
                  <div
                    className={`hp-stamp${stamp === 'exit' ? ' is-exit' : ''}`}
                    style={{ '--slam-ms': `${stamp === 'exit' ? T.exitSlam : T.slam}ms`, width: stamp === 'exit' ? '44%' : '54%' } as React.CSSProperties}
                  >
                    <div className="hp-stamp-ring" />
                    <div className="stamp-wrap">
                      {stamp === 'admitted' ? (
                        <StampArt shape="round" title="STAMP CONTROL" center="ADMITTED" bottom="WELCOME BACK" date={today} rating={5} ink="#C2405A" rotate={-8} seed={41} label={`Admitted, ${today}`} />
                      ) : stamp === 'issued' ? (
                        <StampArt shape="rect" title="ISSUED" top="ADMITTED • MEDIA" date={today} rating={0} ink="#C2405A" rotate={-6} seed={23} label={`Issued, ${today}`} />
                      ) : (
                        <StampArt shape="round" title="PASSPORT CONTROL" center="EXIT" bottom="SEE YOU SOON" date={today} rating={0} ink="#3E6E86" rotate={7} seed={9} label={`Exit, ${today}`} />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Cover */}
            <div className={['pp-cover', open ? 'is-open' : '', closing ? 'is-closing' : ''].filter(Boolean).join(' ')}>
              <div className="pp-front" aria-hidden={open}>
                <div className="pp-cover-inner">
                  <div className="pp-republic">Republic of Taste</div>
                  <div ref={sealRef} className="pp-seal">
                    <Seal size="100%" spin style={{ width: '100%', height: 'auto' }} />
                  </div>
                  <div className="pp-title">STAMP</div>
                  <p className="pp-tag">A passport for everything you watch, read, play and play on repeat.</p>

                  <div className={formCls}>
                    {netErr ? (
                      <div className="pp-fade" style={{ display: 'grid', gap: 10 }}>
                        <p className="pp-err" role="alert">
                          {netErr.text}
                        </p>
                        <button type="button" className="pp-btn pp-btn-rose" onClick={() => netErr.retry()} disabled={checking}>
                          {checking ? 'Checking papers…' : 'Try again'}
                        </button>
                        {form === 'code' || form === 'link' ? (
                          <button type="button" className="pp-link" onClick={() => { setNetErr(null); setForm('email'); }}>
                            Use a different email
                          </button>
                        ) : null}
                      </div>
                    ) : form === 'email' ? (
                      <form className="pp-fade" onSubmit={submitEmail} noValidate style={{ display: 'grid', gap: 10 }}>
                        <label className="pp-label" htmlFor={emailId}>
                          Email
                        </label>
                        <input
                          id={emailId}
                          ref={emailRef}
                          className="pp-input"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={email}
                          placeholder="name@example.com"
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailErr && EMAIL_RE.test(e.target.value.trim())) setEmailErr(null);
                          }}
                          onBlur={() => email.trim() && !EMAIL_RE.test(email.trim()) && setEmailErr(MSG.email)}
                          aria-invalid={!!emailErr || undefined}
                          aria-describedby={emailErr ? `${emailId}-err` : undefined}
                        />
                        {emailErr ? (
                          <p id={`${emailId}-err`} className="pp-err" role="alert">
                            {emailErr}
                          </p>
                        ) : null}
                        <button type="submit" className="pp-btn pp-btn-rose" disabled={checking}>
                          {checking ? 'Checking papers…' : 'Continue'}
                        </button>
                        <div className="pp-or">or</div>
                        <button type="button" className="pp-btn" onClick={() => oauth('apple')} disabled={checking}>
                          <AppleMark /> Continue with Apple
                        </button>
                        <button type="button" className="pp-btn" onClick={() => oauth('google')} disabled={checking}>
                          <GoogleMark /> Continue with Google
                        </button>
                        {intent?.kind === 'save' ? null : (
                          <button type="button" className="pp-link" onClick={goLocal} disabled={checking}>
                            Continue without an account
                          </button>
                        )}
                      </form>
                    ) : form === 'code' ? (
                      <form
                        className="pp-fade"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (digits.every((d) => d)) void verify(digits.join(''));
                          else {
                            setCodeErr('Type all six digits from the email.');
                            digitRefs.current[digits.findIndex((d) => !d)]?.focus();
                          }
                        }}
                        style={{ display: 'grid', gap: 10 }}
                      >
                        <p className="pp-copy">
                          Enter the 6-digit code we sent to <b>{email.trim()}</b>
                        </p>
                        {a.kind === 'demo' && code ? <p className="pp-demo">Demo mode — no email is sent. Your code is {code}.</p> : null}
                        <div className="pp-code" role="group" aria-label="6-digit code">
                          {digits.map((d, i) => (
                            <input
                              key={i}
                              ref={(el) => {
                                digitRefs.current[i] = el;
                              }}
                              className="pp-digit"
                              inputMode="numeric"
                              autoComplete={i === 0 ? 'one-time-code' : 'off'}
                              pattern="[0-9]*"
                              maxLength={i === 0 ? 6 : 1}
                              value={d}
                              aria-label={`Digit ${i + 1}`}
                              aria-invalid={!!codeErr || undefined}
                              disabled={checking}
                              onChange={(e) => setDigit(i, e.target.value)}
                              onKeyDown={(e) => onDigitKey(i, e)}
                              onFocus={(e) => e.currentTarget.select()}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text');
                                if (/\d{2,}/.test(text)) {
                                  e.preventDefault();
                                  setDigit(i, text);
                                }
                              }}
                            />
                          ))}
                        </div>
                        {codeErr ? (
                          <p className="pp-err" role="alert">
                            {codeErr}
                          </p>
                        ) : null}
                        <button type="submit" className="pp-btn pp-btn-rose" disabled={checking}>
                          {checking ? 'Checking papers…' : 'Check code'}
                        </button>
                        <div className="pp-links">
                          <button type="button" className="pp-link" onClick={resend} disabled={resendIn > 0 || checking}>
                            {resendIn > 0 ? `Resend code (in ${resendIn}s)` : 'Resend code'}
                          </button>
                          <button
                            type="button"
                            className="pp-link"
                            onClick={() => {
                              setForm('email');
                              setCodeErr(null);
                              setTimeout(() => emailRef.current?.focus(), 30);
                            }}
                          >
                            Use a different email
                          </button>
                          <button type="button" className="pp-link" onClick={useLink} disabled={checking}>
                            Email me a link instead
                          </button>
                        </div>
                      </form>
                    ) : form === 'link' ? (
                      <div className="pp-fade" style={{ display: 'grid', gap: 8 }}>
                        <p className="pp-copy">Waiting for you to open the link…</p>
                      </div>
                    ) : form === 'issue' && pending ? (
                      <form
                        className="pp-fade"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          void runIssuing(pending);
                        }}
                        style={{ display: 'grid', gap: 10 }}
                      >
                        <p className="pp-label" style={{ textAlign: 'center', fontSize: 11 }}>
                          Issue your passport
                        </p>
                        <label className="pp-label" htmlFor={nameId}>
                          Name on passport
                        </label>
                        <input
                          id={nameId}
                          className="pp-input"
                          value={name}
                          maxLength={40}
                          autoComplete="name"
                          placeholder="Your name"
                          onChange={(e) => {
                            setName(e.target.value);
                            if (e.target.value.trim()) setNameErr(null);
                          }}
                          aria-invalid={!!nameErr || undefined}
                          aria-describedby={nameErr ? `${nameId}-err` : undefined}
                          disabled={checking}
                        />
                        {nameErr ? (
                          <p id={`${nameId}-err`} className="pp-err" role="alert">
                            {nameErr}
                          </p>
                        ) : null}
                        <span className="pp-label">Your tastes (pick up to 3)</span>
                        <div className="pp-chips">
                          {AFFINITIES.map((x) => (
                            <button
                              key={x}
                              type="button"
                              className="pp-chip"
                              aria-pressed={aff.includes(x)}
                              onClick={() => setAff((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : cur.length >= 3 ? cur : [...cur, x]))}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                        <button type="submit" className="pp-btn pp-btn-rose" disabled={checking}>
                          {checking ? 'Issuing…' : 'Issue my passport'}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {isChecking && !reduce ? <div className="pp-scan" aria-hidden="true" /> : null}
              </div>
              <div className="pp-back" aria-hidden="true">
                <Seal size={160} />
              </div>
            </div>
          </div>

          {form === 'link' ? (
            <div className="pc-envelope force-day" role="region" aria-label="Magic link">
              <span className="pc-wax" aria-hidden="true">
                S
              </span>
              <p>
                Check your email. We sent a link to <b>{email.trim()}</b>.
              </p>
              {a.kind === 'demo' ? (
                <button type="button" className="btn btn-sm btn-pri" onClick={demoOpenLink}>
                  Open the demo link
                </button>
              ) : null}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setForm('code');
                  setTimeout(() => digitRefs.current[0]?.focus(), 30);
                }}
              >
                Use a 6-digit code instead
              </button>
            </div>
          ) : null}
        </div>

        <p className="pc-copy" aria-hidden="true">
          Every film you watch <em>gets a stamp.</em>
        </p>
      </div>

      <div className="pc-ticker" aria-hidden="true">
        <span>{TICKER.repeat(3)}</span>
        <span>{TICKER.repeat(3)}</span>
      </div>
    </div>
  );
}
