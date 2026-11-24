import type { Metadata } from 'next';
import { FeedScreen } from '@/components/app/screens/FeedScreen';

export const metadata: Metadata = { title: 'Feed' };

export default function Page() {
  return <FeedScreen />;
}
