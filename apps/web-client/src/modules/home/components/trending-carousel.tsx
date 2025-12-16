/**
 * Trending Carousel
 */

'use client';

import type { ReactNode } from 'react';
import { Carousel } from '@/shared/components/carousel';

export interface TrendingCarouselProps {
  children: ReactNode;
  title?: string;
  titleIcon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}

export function TrendingCarousel({
  children,
  title,
  titleIcon,
  subtitle,
  actions,
}: TrendingCarouselProps) {
  // Формуємо заголовок з іконкою
  const titleWithIcon = titleIcon && title ? (
    <div className="flex items-center gap-2">
      {titleIcon}
      <span>{title}</span>
    </div>
  ) : title;

  return (
    <Carousel
      title={titleWithIcon}
      subtitle={subtitle}
      actions={actions}
      gap="md"
      className="mb-12"
    >
      {children}
    </Carousel>
  );
}
