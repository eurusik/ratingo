'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { pendingArtImageFor } from '@/shared/lib';

export function ArrivingArt({ fallback = null }: { fallback?: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [imageUrl] = useState(() => pendingArtImageFor(pathname));

  if (!imageUrl) return fallback;

  return (
    <Image
      src={imageUrl}
      alt=""
      fill
      unoptimized
      loading="eager"
      sizes="240px"
      className="object-cover"
    />
  );
}
