'use client';

import { usePathname } from 'next/navigation';
import { trackingStateFor, type TrackingHints } from '@/entities/episode';
import { ShowActionsSkeleton } from './show-actions-skeleton';

function slugOf(pathname: string): string {
  const segment = pathname.split('/')[2] ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function RouteShowActionsSkeleton({ hints }: { hints: TrackingHints | null }) {
  const pathname = usePathname() ?? '';
  return <ShowActionsSkeleton state={trackingStateFor(hints, slugOf(pathname))} />;
}
