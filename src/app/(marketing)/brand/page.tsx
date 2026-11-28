import type { Metadata } from 'next';
import logos from '../../../../public/brand/logos/index.json';

export const metadata: Metadata = {
  title: 'Brand kit',
  description: 'STAMP logos as SVG and transparent PNG.',
};

type Logo = { id: string; name: string; tile: 'light' | 'dark'; wide: boolean };

export default function BrandPage() {
  return (
    <section className="sec brand">
      <div className="wrap">
        <header className="sec-head">
          <h1 className="sec-title">
            Brand <em>kit</em>
          </h1>
          <p className="sec-lede">Every STAMP logo as an SVG and a transparent PNG. Give the seal room to breathe, and don’t stretch or recolour it.</p>
        </header>
        <ul className="brand-grid">
          {(logos as Logo[]).map((l) => (
            <li key={l.id} className={`brand-tile is-${l.tile}`}>
              <div className="brand-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/logos/${l.id}.svg`} alt={`STAMP ${l.name}`} loading="lazy" />
              </div>
              <div className="brand-meta">
                <span className="label">{l.name}</span>
                <span className="brand-links">
                  <a href={`/brand/logos/${l.id}.svg`} download>
                    SVG
                  </a>
                  <a href={`/brand/logos/png/${l.id}.png`} download>
                    PNG
                  </a>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="brand-foot">
          <a className="btn" href="/brand/logos/contact-sheet.jpg">
            See them all on one sheet
          </a>
        </p>
      </div>
    </section>
  );
}
