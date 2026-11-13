'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Skeleton } from '@heroui/react';
import { SHARED_ART_TARGET, pendingArtImageFor } from '@/shared/lib';
import { markSkeletonShownFor } from '../model/skeleton-reveal';

export function PendingPoster() {
  const pathname = usePathname() ?? '';
  const [imageUrl] = useState(() => pendingArtImageFor(pathname));
  useEffect(() => markSkeletonShownFor(pathname), [pathname]);

  return (
    <span
      {...SHARED_ART_TARGET}
      className="relative block aspect-2/3 w-full overflow-hidden rounded-[14px] [grid-area:poster] md:rounded-[20px]"
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill unoptimized sizes="240px" className="object-cover" />
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </span>
  );
}
