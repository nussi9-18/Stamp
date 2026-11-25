'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatDate } from '@/lib/format';
import { claimLookPrompt, endMoment, getItem, getState, openSheet, requestSearchFocus, toggleTheme, useLook, useStore } from '@/lib/store/store';
import { Icon, type IconName } from '../brand/Icon';
import { Seal } from '../brand/Seal';
import { ItemStamp, stampLook } from '../brand/Stamp';
import { PullCord } from './PullCord';
import { SheetHost } from './sheets/SheetHost';

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: '/app', label: 'Passport', icon: 'passport' },
  { href: '/app/discover', label: 'Discover', icon: 'discover' },
  { href: '/app/feed', label: 'Feed', icon: 'feed' },
  { href: '/app/people', label: 'People', icon: 'people' },
  { href: '/app/wrapped', label: 'Wrapped', icon: 'wrapped' },
];
const TOOLS: { href: string; label: string; icon: IconName }[] = [
  { href: '/app/archivist', label: 'Archivist', icon: 'archivist' },
  { href: '/app/diplomat', label: 'Diplomat', icon: 'diplomat' },
  { href: '/app/shield', label: 'Shield', icon: 'shield' },
];

function isActive(pathname: string, href: string) {
  if (href === '/app') return pathname === '/app' || pathname === '/app/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/app';
  const router = useRouter();
  const theme = useStore((s) => s.data?.passport?.theme ?? 'day');
  const passport = useStore((s) => s.data?.passport);
  const thud = useStore((s) => s.moment?.key ?? 0);
  const [thudding, setThudding] = useState(false);

  useEffect(() => {
    if (!thud) return;
    const t1 = setTimeout(() => setThudding(true), 220);
    const t2 = setTimeout(() => setThudding(false), 520);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [thud]);

  const look = useLook();
  // Passports that haven't picked a look yet get the choice once (new ones then read the field manual).
  const needsLook = useStore((s) => !!s.data?.passport && !s.data.prefs.look);
  useEffect(() => {
    if (!needsLook) return;
    const t = setTimeout(() => {
      const s = getState();
      if (s.sheets.length || s.moment || !claimLookPrompt()) return;
      openSheet({ type: 'look', next: s.data?.prefs.manualSeen ? undefined : 'manual' });
    }, 500);
    return () => clearTimeout(t);
  }, [needsLook]);

  const stampSomething = () => {
    requestSearchFocus();
    if (!isActive(pathname, '/app/discover')) router.push('/app/discover');
  };

  return (
    <div className={`app${thudding ? ' thud' : ''}`}>
      <a className="sr-only" href="#main">
        Skip to content
      </a>

      {/* Phone top bar */}
      <header className="topbar">
        <Link href="/app" className="topbar-brand" aria-label="STAMP — your passport">
          <Seal size={34} />
          <span className="display">STAMP</span>
        </Link>
        <div className="topbar-actions">
          <Link href="/app/archivist" className="icon-btn" aria-label="Archivist">
            <Icon name="archivist" />
          </Link>
          <Link href="/app/wrapped" className="icon-btn" aria-label="Wrapped">
            <Icon name="wrapped" />
          </Link>
          {look === 'retro' ? (
            <PullCord />
          ) : (
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-pressed={theme === 'night'} aria-label={theme === 'night' ? 'Light mode' : 'Dark mode'}>
              <Icon name={theme === 'night' ? 'sun' : 'moon'} />
            </button>
          )}
        </div>
      </header>

      {/* iPad / desktop rail */}
      <nav className="rail" aria-label="Main">
        <Link href="/app" className="rail-brand">
          <Seal size={52} />
          <span>
            <span className="display" style={{ display: 'block' }}>
              STAMP
            </span>
            <span className="label" style={{ display: 'block' }}>
              Media passport
            </span>
          </span>
        </Link>
        <div className="rail-links">
          {MAIN.map((l) => (
            <Link key={l.href} href={l.href} className="rail-link" aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
              <Icon name={l.icon} />
              {l.label}
            </Link>
          ))}
        </div>
        <div className="label rail-group">Tools</div>
        <div className="rail-links">
          {TOOLS.map((l) => (
            <Link key={l.href} href={l.href} className="rail-link" aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
              <Icon name={l.icon} />
              {l.label}
            </Link>
          ))}
        </div>
        <button type="button" className="btn btn-pri rail-cta" onClick={stampSomething}>
          Stamp something
        </button>
        <div className="rail-foot">
          {look === 'retro' ? (
            <div className="cord-row">
              <PullCord />
              <span className="label">{theme === 'night' ? 'Pull for light' : 'Pull for dark'}</span>
            </div>
          ) : (
            <button type="button" className="btn" onClick={toggleTheme} aria-pressed={theme === 'night'}>
              <Icon name={theme === 'night' ? 'sun' : 'moon'} size={16} />
              {theme === 'night' ? 'Light mode' : 'Dark mode'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => openSheet({ type: 'settings' })}>
            <Icon name="settings" size={16} />
            Settings
          </button>
          {passport ? (
            <div className="rail-meta">
              {passport.passportNo}
              <br />
              Issued {formatDate(passport.issued)}
            </div>
          ) : null}
        </div>
      </nav>

      <main id="main" className="app-main" tabIndex={-1}>
        <div className="page" key={pathname}>
          {children}
        </div>
      </main>

      {/* Phone tab bar */}
      <nav className="tabbar" aria-label="Tabs">
        {MAIN.slice(0, 2).map((l) => (
          <Link key={l.href} href={l.href} className="tab" aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
            <Icon name={l.icon} />
            <span className="tab-label">{l.label}</span>
          </Link>
        ))}
        <button type="button" className="tab-stamp" onClick={stampSomething} aria-label="Stamp something">
          <span className="tab-stamp-sq">
            <Icon name="plus" />
          </span>
          <span className="tab-label" aria-hidden="true">
            Stamp
          </span>
        </button>
        {MAIN.slice(2, 4).map((l) => (
          <Link key={l.href} href={l.href} className="tab" aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
            <Icon name={l.icon} />
            <span className="tab-label">{l.label}</span>
          </Link>
        ))}
      </nav>

      <SheetHost />
      <StampMoment />
      <Toast />
    </div>
  );
}

export function Toast() {
  const t = useStore((s) => s.toast);
  return (
    <div aria-live="polite" role="status" className="sr-only-wrap">
      {t ? (
        <div className="toast" key={t.key}>
          {t.text}
        </div>
      ) : null}
    </div>
  );
}

/** 5.4 The stamp moment (signature animation). */
function StampMoment() {
  const moment = useStore((s) => s.moment);
  const stamp = useStore((s) => (s.moment ? s.data?.stamps[s.moment.itemId] : undefined));
  const sound = useStore((s) => s.data?.prefs.sound ?? false);
  const [out, setOut] = useState(false);
  const played = useRef(0);

  useEffect(() => {
    if (!moment || played.current === moment.key) return;
    played.current = moment.key;
    setOut(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => {
      try {
        navigator.vibrate?.([18, 40, 30]);
      } catch {
        /* ignore */
      }
      if (sound) playThunk();
    }, reduce ? 0 : 220);
    const t2 = setTimeout(() => setOut(true), 1250);
    const t3 = setTimeout(() => {
      setOut(false);
      endMoment();
    }, 1550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [moment, sound]);

  if (!moment || !stamp) return null;
  const item = getItem(moment.itemId);
  if (!item) return null;
  const look = stampLook(item.id, stamp.date);
  return (
    <div className={`moment${out ? ' is-out' : ''}`} aria-hidden="true">
      <div className="moment-inner">
        <div className="moment-stamp">
          <div className="moment-ring" />
          {/* The stamp's own rotation R is drawn inside the SVG, so the wrapper settles at 0deg. */}
          <div className="stamp-wrap" style={{ '--r': '0deg' } as React.CSSProperties} data-r={look.rotate}>
            <ItemStamp item={item} stamp={stamp} />
          </div>
        </div>
        <div className="moment-caption">{moment.update ? 'Stamp updated' : 'Passport stamped'}</div>
      </div>
    </div>
  );
}

let audioCtx: AudioContext | null = null;
/** Optional soft "thunk" (off by default, toggle in Settings). Synthesised — no audio file. */
export function playThunk() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx ?? new AC();
    const ctx = audioCtx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch {
    /* ignore */
  }
}
