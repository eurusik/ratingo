'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ScrollShadow } from '@heroui/react';
import { Play } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { preloadWhenIdle } from '@/shared/lib';
import { trailerThumbnailUrl, type Trailer } from '../model/trailers';
import { DetailsSection } from './details-section';

const loadTrailerPlayer = () => import('./trailer-player').then((module) => module.TrailerPlayer);

const TrailerPlayer = dynamic(loadTrailerPlayer, { ssr: false });

function TrailerThumb({ trailer, onPlay }: { trailer: Trailer; onPlay: () => void }) {
  const { dict } = useTranslation();

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={interpolate(dict.details.trailers.watch, { title: trailer.title })}
      className="flex w-70 flex-col gap-2 rounded-2xl text-start text-foreground transition-opacity hover:opacity-85 active:opacity-70 md:w-full"
    >
      <span className="relative block aspect-video w-full overflow-hidden rounded-[14px] bg-surface-secondary md:rounded-2xl">
        <Image
          src={trailerThumbnailUrl(trailer.key)}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 48rem) 50vw, 280px"
          className="object-cover"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 flex size-13 -translate-1/2 items-center justify-center rounded-full bg-background/70 text-foreground md:size-15"
        >
          <Play className="size-5.5 fill-current" />
        </span>
      </span>
      <span className="line-clamp-2 text-sm font-semibold">{trailer.title}</span>
    </button>
  );
}

export function TrailersSection({ trailers }: { trailers: Trailer[] }) {
  const { dict } = useTranslation();
  const [selected, setSelected] = useState<Trailer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => preloadWhenIdle(loadTrailerPlayer), []);

  const play = (trailer: Trailer) => {
    setSelected(trailer);
    setIsPlaying(true);
  };

  return (
    <DetailsSection id="details-trailers" title={dict.details.trailers.title}>
      <ScrollShadow
        orientation="horizontal"
        hideScrollBar
        className="-mx-4 snap-x snap-mandatory scroll-px-4 overscroll-x-contain md:mx-0 md:overflow-visible"
      >
        <ul className="flex w-max gap-2.5 px-4 md:grid md:w-full md:grid-cols-2 md:gap-4 md:px-0 xl:grid-cols-3">
          {trailers.map((trailer) => (
            <li key={trailer.key} className="snap-start">
              <TrailerThumb trailer={trailer} onPlay={() => play(trailer)} />
            </li>
          ))}
        </ul>
      </ScrollShadow>
      {selected ? (
        <TrailerPlayer trailer={selected} isOpen={isPlaying} onClose={() => setIsPlaying(false)} />
      ) : null}
    </DetailsSection>
  );
}
