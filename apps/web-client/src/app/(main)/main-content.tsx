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

  // Base header height is 64px (h-16), plus announcement bar if visible.
  // When no banner, header is offset by safe-area-inset-top (PWA standalone on notched devices).
  // When banner is visible, its measured height already includes safe-area-inset-top.
  const safeAreaOffset = announcementHeight > 0 ? '0px' : 'env(safe-area-inset-top, 0px)';
  const paddingTop = `calc(${64 + announcementHeight}px + ${safeAreaOffset})`;

  return (
    <main style={{ paddingTop, paddingBottom: MOBILE_DOCK_HEIGHT_PX }} className="md:!pb-0">
      {children}
    </main>
  );
}
