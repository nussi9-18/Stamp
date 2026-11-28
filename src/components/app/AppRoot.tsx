'use client';

import { useEffect } from 'react';
import { bootApp } from '@/lib/auth/session';
import { configureSound, installButtonSounds } from '@/lib/sound';
import { useStore } from '@/lib/store/store';
import { PassportControl } from '../control/PassportControl';
import { AppShell } from './AppShell';

function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
  if (document.readyState === 'complete') navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
}

/** Boots the local store and gates the app behind Passport Control (§8, §9). */
export function AppRoot({ children }: { children: React.ReactNode }) {
  const boot = useStore((s) => s.boot);
  const authState = useStore((s) => s.auth);
  const control = useStore((s) => s.control);

  const soundOn = useStore((s) => s.data?.prefs.sfx !== 'off');
  const look = useStore((s) => s.look);

  useEffect(() => {
    void bootApp();
    registerServiceWorker();
    return installButtonSounds();
  }, []);

  useEffect(() => {
    configureSound({ on: soundOn, look });
  }, [soundOn, look]);

  if (boot === 'loading') return <div className="boot" aria-busy="true" />;
  if (authState === 'signed-out' || control) return <PassportControl intent={control} />;
  return <AppShell>{children}</AppShell>;
}
