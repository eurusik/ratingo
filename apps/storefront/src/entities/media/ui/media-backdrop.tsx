import Image from 'next/image';
import type { MediaType } from '@/shared/api';
import { MediaTypeIcon } from './media-poster';

const BACKDROP_WIDTH = 310;
const BACKDROP_HEIGHT = 250;

export function MediaBackdrop({ type, backdropUrl }: { type: MediaType; backdropUrl?: string }) {
  if (!backdropUrl) {
    return (
      <span className="flex h-62.5 w-full items-center justify-center bg-surface-secondary text-muted">
        <MediaTypeIcon type={type} className="size-8" />
      </span>
    );
  }

  return (
    <Image
      src={backdropUrl}
      alt=""
      width={BACKDROP_WIDTH}
      height={BACKDROP_HEIGHT}
      unoptimized
      className="h-62.5 w-full bg-surface-secondary object-cover"
    />
  );
}
