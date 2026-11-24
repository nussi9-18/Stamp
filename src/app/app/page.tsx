import type { Metadata } from 'next';
import { PassportScreen } from '@/components/app/screens/PassportScreen';

export const metadata: Metadata = { title: 'Passport' };

export default function Page() {
  return <PassportScreen />;
}
