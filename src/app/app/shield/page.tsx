import type { Metadata } from 'next';
import { ShieldScreen } from '@/components/app/screens/ShieldScreen';

export const metadata: Metadata = { title: 'Comfort shield' };

export default function Page() {
  return <ShieldScreen />;
}
