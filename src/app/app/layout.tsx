import type { Metadata } from 'next';
import { AppRoot } from '@/components/app/AppRoot';
import './shell.css';
import './screens.css';
import '../themes/modern.css';
import '../themes/retro.css';

export const metadata: Metadata = {
  title: { default: 'Your passport', template: '%s · STAMP' },
  robots: { index: false, follow: false },
};

// Apply the look (Modern / Retro) and mode (light / dark) before first paint on hard loads.
const THEME = `(function(){var d=document.documentElement;try{var l=localStorage.getItem('stamp:look');d.setAttribute('data-look',l==='modern'?'modern':'retro');var t=localStorage.getItem('stamp:theme');if(t!=='day'&&t!=='night'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'night':'day';}d.setAttribute('data-theme',t);}catch(e){d.setAttribute('data-look','retro');}})();`;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME }} />
      <AppRoot>{children}</AppRoot>
    </>
  );
}
