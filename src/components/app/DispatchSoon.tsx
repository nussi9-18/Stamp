'use client';

import { setPref, toast, useStore } from '@/lib/store/store';
import { StampArt } from '../brand/Stamp';

/**
 * Mystery dispatch — shown as "Coming soon". No prices, no payment: "Notify me" only records interest
 * (stored in the passport's prefs, which sync to profiles.prefs for account holders).
 */
export function DispatchSoon({ compact = false }: { compact?: boolean }) {
  const interested = useStore((s) => !!s.data?.prefs.dispatchInterest);
  return (
    <section className="soon" aria-labelledby="soon-h">
      <div className="soon-stamp" aria-hidden="true">
        <StampArt shape="rect" title="COMING SOON" top={'MYSTERY • DISPATCH'} date="STAMP" rating={0} ink="var(--ink-out)" rotate={-7} seed={31} label="Coming soon" />
      </div>
      <span className="label">Coming soon</span>
      <h2 id="soon-h" className="soon-title">
        Mystery <em>dispatch</em>
      </h2>
      <p className="body2">A monthly box of physical things picked from your wishlist and your heat limits, with a few surprises you wouldn’t have chosen.</p>
      {compact ? null : (
        <ul className="soon-tiers">
          <li>
            <strong>Matinee pouch</strong>
            <span>Two cinema tickets, an enamel pin and a mini zine.</span>
          </li>
          <li>
            <strong>Repertory crate</strong>
            <span>A Blu-ray from your wishlist, two repertory tickets, a poster and a wax-sealed certificate.</span>
          </li>
        </ul>
      )}
      {interested ? (
        <p className="label" role="status" style={{ color: 'var(--ink)' }}>
          ✓ You’re on the list. We’ll tell you when it opens.
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-pri"
          data-sfx="success"
          onClick={() => {
            setPref('dispatchInterest', true);
            toast('You’re on the list');
          }}
        >
          Notify me
        </button>
      )}
    </section>
  );
}
