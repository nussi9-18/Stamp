import type { Metadata } from 'next';
import { ShortsScreen } from '@/components/app/screens/ShortsScreen';

export const metadata: Metadata = { title: 'Indie shorts' };

export default function Page() {
  return <ShortsScreen />;
}
