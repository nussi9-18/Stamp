'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StampArt } from '../brand/Stamp';

const BAND = [
  'P<STMP<<EVERY<FILM<YOU<WATCH<<GETS<A<STAMP<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  'STMP2026<032FILMS<15COUNTRIES<<REPUBLIC<OF<CINEMA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
];

/** 7.1 Hero — the big round rose stamp slams onto the headline once, on load. */
export function Hero() {
  const [thud, setThud] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = setTimeout(() => setThud(true), 720);
    const b = setTimeout(() => setThud(false), 1040);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  return (
    <section className="hero" aria-labelledby="hero-h">
      <div className="wrap">
        <div className="kicker">
          <span className="label">Media passport / est. 2026</span>
          <span className="label">Films, series, books, manga, games &amp; albums</span>
        </div>
        <div className="hero-grid">
          <h1 id="hero-h" className={`hero-h1${thud ? ' thud' : ''}`}>
            <span className="line">Every film</span>
            <span className="line">you watch</span>
            <em>gets a stamp.</em>
          </h1>
          <div className="hero-stamp" aria-hidden="true">
            <div className="ring" />
            <div className="stamp-wrap" style={{ '--r': '0deg' } as React.CSSProperties}>
              <StampArt
                shape="round"
                title="YOUR FIRST FILM"
                date="TODAY"
                bottom="THEATER • CINEMA"
                rating={5}
                ink="var(--ink-out)"
                rotate={-9}
                seed={17}
                label="Your first film, stamped today at the cinema"
              />
            </div>
          </div>
        </div>
        <p className="hero-lede">
          STAMP is a diary shaped like a passport, for films and everything else you love: series, books, manga, games and albums. Rate it, note how it felt, and press it into your pages — one rubber stamp each.
        </p>
        <div className="cta-row">
          <Link href="/app" className="btn btn-pri">
            Open the app
          </Link>
          <a href="#how" className="btn">
            See how it works
          </a>
        </div>
      </div>
      <div className="mrz-band" role="img" aria-label="Machine-readable zone: every film you watch gets a stamp">
        <div className="wrap">
          {BAND.map((l) => (
            <span key={l} className="mrz-band-line" aria-hidden="true">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
