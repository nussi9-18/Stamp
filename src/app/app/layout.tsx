import type { Metadata } from 'next';
import { AppRoot } from '@/components/app/AppRoot';
import './shell.css';
import './screens.css';

export const metadata: Metadata = {
  title: { default: 'Your passport', template: '%s · STAMP' },
  robots: { index: false, follow: false },
};

// Apply Nocturne before first paint on hard loads.
const THEME = `(function(){try{var t=localStorage.getItem('stamp:theme');if(t==='night'){document.documentElement.setAttribute('data-theme','night');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#0E0D0C');}}catch(e){}})();`;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME }} />
      <AppRoot>{children}</AppRoot>
    </>
  );
}
