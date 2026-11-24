import type { Metadata } from 'next';
import { ArchivistScreen } from '@/components/app/screens/ArchivistScreen';

export const metadata: Metadata = { title: 'The Archivist' };

export default function Page() {
  return <ArchivistScreen />;
}
