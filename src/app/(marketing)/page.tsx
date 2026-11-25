import Link from 'next/link';
import { MatchRing } from '@/components/brand/MatchRing';
import { Poster } from '@/components/brand/Poster';
import { Seal } from '@/components/brand/Seal';
import { StampArt } from '@/components/brand/Stamp';
import { Hero } from '@/components/site/Hero';
import { TryThePress } from '@/components/site/TryThePress';
import { Avatar, HeatBox } from '@/components/ui/bits';
import { CATALOG_BY_ID } from '@/lib/catalog';
import { PRESETS } from '@/lib/shield';
import type { HeatVector } from '@/lib/types';

const EXAMPLE_HEAT: HeatVector = [0, 2, 3, 3, 0, 2, 1, 0];
const SANCTUARY = PRESETS.find((p) => p.id === 'sanctuary')!.limits;
const SITE_PRESETS = [
  { name: 'No limits', copy: 'Everything shows, with heat scores.' },
  { name: 'Sanctuary', copy: 'Keeps gore, dread and animal harm at Mild.', on: true },
  { name: 'Family', copy: 'For watching with kids.' },
  { name: 'Sensory safe', copy: 'No flashing lights.' },
];

export default function Home() {
  return (
    <>
      <Hero />

      {/* 2. Devices */}
      <section className="sec" aria-labelledby="devices-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="devices-h" className="sec-title">
              Pocket-sized.
              <br />
              <em>iPad-wide.</em>
            </h2>
            <p className="sec-lede">On your phone it’s a passport you flip through. On iPad it opens flat like a real booklet: holder page on the left, visa pages on the right.</p>
          </div>
          <div className="devices">
            <div className="ipad">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/ipad-passport.webp"
                width={1600}
                height={1112}
                alt="STAMP on iPad: the passport opens flat, holder card on the left, canonical nine on the right"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="phone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/phone-record.webp"
                width={600}
                height={1298}
                alt="STAMP on iPhone: a record with its heat index and the stamp form"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
          <div className="notes">
            <div className="note">
              <h3>Split view on iPad</h3>
              <p>Browse the film list on one side and fill in your stamp on the other, without losing your place.</p>
            </div>
            <div className="note">
              <h3>Big tap targets</h3>
              <p>Stars, moods and buttons are sized for thumbs and fingers, in portrait or landscape.</p>
            </div>
            <div className="note">
              <h3>Nocturne mode</h3>
              <p>A dark theme for watching in the cinema, with nothing bright enough to bother the row behind you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="sec" id="how" aria-labelledby="how-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="how-h" className="sec-title">
              Three steps <em>to a stamp</em>
            </h2>
            <p className="sec-lede">Logging a film takes about ten seconds.</p>
          </div>
          <ol className="steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="step">
              <span className="step-num" aria-hidden="true">
                1
              </span>
              <h3>Find it</h3>
              <div className="step-demo">
                <div className="mini-search" aria-hidden="true">
                  Kiarostami
                  <span className="caret" />
                </div>
              </div>
              <p>Search by title, creator, year or country, or describe a scene to the Archivist.</p>
            </li>
            <li className="step">
              <span className="step-num" aria-hidden="true">
                2
              </span>
              <h3>Rate it</h3>
              <div className="step-demo">
                <div className="mini-stars" role="img" aria-label="Four of five stars">
                  <span className="on" />
                  <span className="on" />
                  <span className="on" />
                  <span className="on" />
                  <span />
                </div>
              </div>
              <p>Give it stars, pick how it felt, and say where you watched it.</p>
            </li>
            <li className="step">
              <span className="step-num" aria-hidden="true">
                3
              </span>
              <h3>Stamp it</h3>
              <div className="step-demo">
                <div style={{ width: 170 }}>
                  <StampArt shape="rect" title="Close-Up" top="ADMITTED • FILM" date="18 NOV 2026" rating={5} ink="var(--ink-out)" rotate={-6} seed={5} label="Close-Up stamp, 5 of 5, 18 NOV 2026" />
                </div>
              </div>
              <p>The stamp lands in your passport, inked in the colour of where you watched.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* 4. Try the press */}
      <section className="sec" aria-labelledby="press-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="press-h" className="sec-title">
              Try <em>the press</em>
            </h2>
            <p className="sec-lede">Tap a ticket to stamp it onto the page. Tap again to lift it off.</p>
          </div>
          <TryThePress />
        </div>
      </section>

      {/* 5. Shield */}
      <section className="sec" id="shield" aria-labelledby="shield-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="shield-h" className="sec-title">
              Your limits, <em>not an age rating</em>
            </h2>
            <p className="sec-lede">An age rating squeezes a whole film into one letter. STAMP scores eight kinds of content from Clear to Peak, so you can set your own comfort shield.</p>
          </div>
          <div className="shield-grid">
            <div>
              <HeatBox item={{ v: EXAMPLE_HEAT }} limits={SANCTUARY} caption="Example record" />
              <p className="warn-line" style={{ marginTop: 12 }}>
                Rose rows go past a Sanctuary shield
              </p>
            </div>
            <div>
              <div className="site-presets">
                {SITE_PRESETS.map((p) => (
                  <div key={p.name} className={`site-preset${p.on ? ' is-on' : ''}`}>
                    <h3>{p.name}</h3>
                    <p>{p.copy}</p>
                  </div>
                ))}
              </div>
              <p className="shield-sentence">
                When something goes past your shield, STAMP can <span className="ul-rose">hide it</span>, <span className="ul-rose">blur the poster</span> until you choose to look, or just{' '}
                <span className="ul-rose">show a warning</span>. The feed flags friends’ stamps the same way.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. AI tools */}
      <section className="sec" id="ai" aria-labelledby="ai-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="ai-h" className="sec-title">
              Two tools <em>that think</em>
            </h2>
            <p className="sec-lede">Both run on Claude, inside the app.</p>
          </div>
          <div className="ai-grid">
            <article className="ai-card">
              <span className="label">The Archivist</span>
              <h3>Forgot the title?</h3>
              <p>Describe what you remember — by typing or by voice — and get the match, with the clues that gave it away.</p>
              <blockquote className="ai-quote">“A rainy night in Hong Kong, a woman in a blonde wig, a cop buying tins of pineapple that expire on May 1…”</blockquote>
              <div className="verdict-bar">
                <span className="pct">96%</span>
                <span>
                  <span className="t" style={{ display: 'block' }}>
                    Chungking Express
                  </span>
                  <span className="italic">Wong Kar-wai, 1994</span>
                </span>
              </div>
            </article>
            <article className="ai-card">
              <span className="label">The Diplomat</span>
              <h3>Watching with someone?</h3>
              <p>Add each person’s taste and limits. The Diplomat finds one pick for everyone and gives each person a reason they’ll like it.</p>
              <div className="treaty-mini">
                <div className="treaty-mini-head">
                  <span className="display">Treaty pass № 959</span>
                  <span className="label" style={{ color: '#F5C6D0' }}>
                    91% agreement
                  </span>
                </div>
                <ul>
                  <li>
                    <span className="label">Nussi</span>
                    <p>Rain, longing and gorgeous framing.</p>
                  </li>
                  <li>
                    <span className="label">Marcus</span>
                    <p>A tight investigation with real dread.</p>
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 7. People */}
      <section className="sec" id="people" aria-labelledby="people-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="people-h" className="sec-title">
              Find your <em>kindred spirits</em>
            </h2>
            <p className="sec-lede">STAMP compares your ratings with other passports and shows who rates like you, which works you both gave five stars, and their own canonical nine.</p>
          </div>
          <div className="match-list">
            {[
              { name: 'Lina Haddad', city: 'Beirut', av: '#F5C6D0', pct: 90 },
              { name: 'Marcus Ode', city: 'Paris', av: '#7EA8BE', pct: 88 },
              { name: 'Omar Rizk', city: 'Cairo', av: '#F5C6D0', pct: 73 },
            ].map((p) => (
              <div key={p.name} className="match-card">
                <Avatar name={p.name} color={p.av} size={52} />
                <div>
                  <div className="display">{p.name}</div>
                  <div className="label">{p.city}</div>
                </div>
                <MatchRing pct={p.pct} />
              </div>
            ))}
            <div className="concept-card">
              <span className="concept">Concept</span>
              <h3>Tap passports at the cinema</h3>
              <p className="body2">In the native app, two phones held together exchange passports over NFC — a stamp for meeting someone at a screening.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Wrapped */}
      <section className="sec sec-black" aria-labelledby="wrapped-h">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="wrapped-h" className="sec-title">
              Your year, <em>in stamps</em>
            </h2>
            <p className="sec-lede">Every December, STAMP counts your pages: stamps, hours, the countries your stories took you to, your most stamped creator, and how it all compares to last year.</p>
          </div>
          <div className="w-grid">
            <div className="w-cell">
              <b>48</b>
              <span className="label">Stamps this year</span>
            </div>
            <div className="w-cell">
              <b className="rose">+42%</b>
              <span className="label">Hours vs last year</span>
            </div>
            <div className="w-cell">
              <b className="outline">17</b>
              <span className="label">Countries visited</span>
            </div>
            <div className="w-cell">
              <b>12</b>
              <span className="label">Five-star films</span>
            </div>
          </div>
          <p className="label w-note">Example year. Yours is built from your own stamps.</p>
        </div>
      </section>

      {/* 9. Mystery dispatch (concept) */}
      <section className="sec" id="dispatch" aria-labelledby="dispatch-h">
        <div className="wrap" style={{ maxWidth: 'calc(980px + var(--gutter) * 2)' }}>
          <figure className="crate" aria-label="Flat-lay of the Repertory crate: a Blu-ray, a poster, two tickets, an enamel pin, a mini zine and a wax-sealed certificate">
            <div className="crate-surface" />
            <div className="obj obj-bluray">
              <Poster item={CATALOG_BY_ID['in-the-mood']} />
            </div>
            <div className="obj obj-poster">
              <Poster item={CATALOG_BY_ID['stalker']} />
            </div>
            <div className="obj obj-pin">
              <Seal size="100%" style={{ width: '100%', height: 'auto' }} />
            </div>
            <div className="obj obj-zine">Field notes no. 07</div>
            <div className="obj obj-ticket a">
              <span>ADMIT ONE · REPERTORY · ROW F</span>
              <span>SEAT 12</span>
            </div>
            <div className="obj obj-ticket b">
              <span>ADMIT ONE · REPERTORY · ROW F</span>
              <span>SEAT 13</span>
            </div>
            <div className="obj obj-cert">
              <span className="label" style={{ fontSize: '1.1cqw' }}>
                Republic of Taste
              </span>
              <span className="display">Certificate of passage</span>
              <i />
              <i style={{ width: '80%' }} />
              <i style={{ width: '60%' }} />
              <span className="wax">S</span>
            </div>
            <figcaption>The Repertory crate, mood board</figcaption>
          </figure>
          <span className="concept">Concept</span>
          <h2 id="dispatch-h" className="sec-title" style={{ marginTop: 18 }}>
            Mystery <em>dispatch</em>
          </h2>
          <p className="sec-lede">A monthly box of physical things picked from your wishlist and your heat limits, with a few surprises you wouldn’t have chosen.</p>
          <div className="tiers">
            <article className="tier">
              <span className="label">Tier A</span>
              <h3>Matinee pouch</h3>
              <div className="price">
                <span className="concept">Coming soon</span>
              </div>
              <ul>
                <li>Two cinema tickets</li>
                <li>An enamel pin</li>
                <li>A mini zine</li>
              </ul>
            </article>
            <article className="tier is-featured">
              <span className="label">Tier B</span>
              <h3>Repertory crate</h3>
              <div className="price">
                <span className="concept">Coming soon</span>
              </div>
              <ul>
                <li>A Blu-ray from your wishlist</li>
                <li>Two repertory tickets</li>
                <li>A poster and a wax-sealed certificate</li>
              </ul>
            </article>
          </div>
          <p className="label" style={{ marginTop: 18 }}>
            Once a year: your Wrapped, printed as a real passport.
          </p>
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="sec" aria-labelledby="final-h">
        <div className="wrap final">
          <Seal size={170} spin title="STAMP seal" />
          <h2 id="final-h">Get your passport</h2>
          <p className="italic">It takes one name and one tap.</p>
          <p>Your passport syncs between your phone and iPad.</p>
          <Link href="/app" className="btn btn-rose" style={{ marginTop: 10, minHeight: 52, padding: '14px 30px' }}>
            Open the app
          </Link>
        </div>
      </section>
    </>
  );
}
