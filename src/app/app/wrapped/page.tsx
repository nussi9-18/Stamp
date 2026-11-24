import type { Metadata } from 'next';
import { WrappedScreen } from '@/components/app/screens/WrappedScreen';

export const metadata: Metadata = { title: 'Wrapped' };

export default function Page() {
  return <WrappedScreen />;
}
