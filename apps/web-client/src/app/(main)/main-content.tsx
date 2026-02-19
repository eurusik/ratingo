/**
 * Main content wrapper that adjusts padding based on announcement bar visibility.
 */

'use client';

import { useAnnouncementBar } from '@/shared/components';
import { MOBILE_DOCK_HEIGHT_PX } from '@/shared/components/mobile-dock';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { height: announcementHeight } = useAnnouncementBar();

  // Base header height is 64px (h-16), plus announcement bar if visible
  const paddingTop = 64 + announcementHeight;

  return (
    <main style={{ paddingTop, paddingBottom: MOBILE_DOCK_HEIGHT_PX }} className="md:!pb-0">
      {children}
    </main>
  );
}
