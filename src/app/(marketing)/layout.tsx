import Link from 'next/link';
import { Seal } from '@/components/brand/Seal';
import { ForceDay } from '@/components/site/ForceDay';
import './marketing.css';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <ForceDay />
      <a className="sr-only" href="#content">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-in">
          <Link href="/" className="nav-brand" aria-label="STAMP home">
            <Seal size={44} />
            <span className="display">STAMP</span>
          </Link>
          <nav aria-label="Sections">
            <ul className="nav-links">
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#shield">Shield</a>
              </li>
              <li>
                <a href="#ai">AI tools</a>
              </li>
              <li>
                <a href="#people">People</a>
              </li>
              <li>
                <a href="#dispatch">Dispatch</a>
              </li>
            </ul>
          </nav>
          <Link href="/app" className="btn">
            Open the app
          </Link>
        </div>
      </header>
      <main id="content">{children}</main>
      <footer className="footer">
        <div className="wrap footer-in">
          <span className="label">STAMP — Media passport</span>
          <span className="label">Designed by Nussi</span>
        </div>
      </footer>
    </div>
  );
}
