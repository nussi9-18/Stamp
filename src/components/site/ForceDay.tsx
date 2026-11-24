'use client';

import { useEffect } from 'react';

/** The website always uses the day palette, even after visiting the app in Nocturne. */
export function ForceDay() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'day');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F5F1E8');
  }, []);
  return null;
}
