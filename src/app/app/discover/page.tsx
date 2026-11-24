import type { Metadata } from 'next';
import { DiscoverScreen } from '@/components/app/screens/DiscoverScreen';

export const metadata: Metadata = { title: 'Discover' };

export default function Page() {
  return <DiscoverScreen />;
}
