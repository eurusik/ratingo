import type { Metadata } from 'next';
import { UiSpikeDetailsPage } from '@/pages/ui-spike';

export const metadata: Metadata = { title: 'UI spike: деталі' };

export default function UiSpikeDetailsRoute() {
  return <UiSpikeDetailsPage />;
}
