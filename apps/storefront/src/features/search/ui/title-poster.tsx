import Image from 'next/image';
import { Clapperboard, Tv } from 'lucide-react';
import type { MediaType } from '@/shared/api';

const POSTER_WIDTH = 40;
const POSTER_HEIGHT = 60;

export function TitlePoster({ type, posterUrl }: { type: MediaType; posterUrl?: string }) {
  if (!posterUrl) {
    const Icon = type === 'movie' ? Clapperboard : Tv;
    return (
      <span className="flex h-15 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted">
        <Icon aria-hidden className="size-4" />
      </span>
    );
  }

  return (
    <Image
      src={posterUrl}
      alt=""
      width={POSTER_WIDTH}
      height={POSTER_HEIGHT}
      unoptimized
      className="h-15 w-10 shrink-0 rounded-lg bg-surface-secondary object-cover"
    />
  );
}
