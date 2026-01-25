/**
 * Main content wrapper that adjusts padding based on announcement bar visibility.
 */

'use client';

import { useAnnouncementBar } from '@/shared/components';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { height: announcementHeight } = useAnnouncementBar();

  // Base header height is 64px (h-16), plus announcement bar if visible
  const paddingTop = 64 + announcementHeight;

  return <main style={{ paddingTop }}>{children}</main>;
}
