import type { Metadata } from 'next';
import { UiSpikePage } from '@/pages/ui-spike';

export const metadata: Metadata = { title: 'UI spike' };

export default function UiSpikeRoute() {
  return <UiSpikePage />;
}
