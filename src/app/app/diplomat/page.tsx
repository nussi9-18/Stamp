import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiplomatScreen } from '@/components/app/screens/DiplomatScreen';

export const metadata: Metadata = { title: 'The Diplomat' };

export default function Page() {
  return (
    <Suspense>
      <DiplomatScreen />
    </Suspense>
  );
}
