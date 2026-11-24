import type { Metadata } from 'next';
import { PeopleScreen } from '@/components/app/screens/PeopleScreen';

export const metadata: Metadata = { title: 'People' };

export default function Page() {
  return <PeopleScreen />;
}
