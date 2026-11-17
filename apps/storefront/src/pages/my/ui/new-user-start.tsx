'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton, toast } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { Check, ChevronRight, Download, Plus, Search } from 'lucide-react';
import { isSaved, useMediaStateStore, useSaveStatus } from '@/entities/library';
import {
  ScoreChip,
  fromTrendingMovie,
  fromTrendingShow,
  type TrendingMedia,
} from '@/entities/media';
import { openSearch } from '@/features/search';
import { useLibrarySave } from '@/features/save-to-library';
import { catalogApi, libraryApi } from '@/shared/api';
import { IMPORT_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { interleave, track } from '@/shared/lib';
import type { LibraryActions } from '../model/library-actions';

const POPULAR_SHOWS = 3;
const POPULAR_MOVIES = 2;
const POPULAR_STALE_MS = 10 * 60 * 1000;

async function loadPopular(): Promise<TrendingMedia[]> {
  const [shows, movies] = await Promise.all([
    catalogApi.getTrendingShows(POPULAR_SHOWS),
    catalogApi.getTrendingMovies(POPULAR_MOVIES),
  ]);
  return interleave(shows.map(fromTrendingShow), movies.map(fromTrendingMovie));
}

const ACTION_CLASS = 'phone-tap-target shrink-0 gap-1 rounded-full font-bold';

function StartShowButton({ media, actions }: { media: TrendingMedia; actions: LibraryActions }) {
  const { dict } = useTranslation();
  const mediaStates = useMediaStateStore();
  const [isStarted, setIsStarted] = useState(false);

  const start = async () => {
    setIsStarted(true);
    try {
      mediaStates.write(media.mediaItemId, await libraryApi.startWatching(media.mediaItemId));
      track('onboarding', { step: 'start_show' });
    } catch (error) {
      console.error('Starting a popular show failed', { mediaItemId: media.mediaItemId, error });
      setIsStarted(false);
      toast.danger(dict.my.newUser.startFailed);
      return;
    }
    await actions.refresh().catch((error: unknown) => {
      console.error('Refreshing the library failed', { error });
    });
  };

  return (
    <Button
      size="sm"
      variant={isStarted ? 'secondary' : 'outline'}
      aria-pressed={isStarted}
      aria-label={interpolate(dict.my.newUser.watchingLabel, { title: media.title })}
      isDisabled={isStarted}
      onPress={() => void start()}
      className={cn(ACTION_CLASS, isStarted && 'text-accent opacity-100')}
    >
      {isStarted ? <Check aria-hidden className="size-4" /> : null}
      {dict.my.newUser.watching}
    </Button>
  );
}

function WantMovieButton({ media }: { media: TrendingMedia }) {
  const { dict } = useTranslation();
  const isWanted = isSaved(useSaveStatus(media.mediaItemId));
  const { toggleSaved } = useLibrarySave();

  return (
    <Button
      size="sm"
      variant={isWanted ? 'secondary' : 'outline'}
      aria-pressed={isWanted}
      onPress={() => {
        if (!isWanted) track('onboarding', { step: 'want_movie' });
        toggleSaved({ mediaItemId: media.mediaItemId, title: media.title });
      }}
      aria-label={interpolate(dict.my.newUser.wantLabel, { title: media.title })}
      className={cn(ACTION_CLASS, isWanted && 'text-accent')}
    >
      {isWanted ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Plus aria-hidden className="size-4" />
      )}
      {dict.my.newUser.want}
    </Button>
  );
}

function PopularRow({ media, actions }: { media: TrendingMedia; actions: LibraryActions }) {
  const { dict } = useTranslation();
  const meta = [media.type === 'movie' ? dict.media.type.movie : null, media.year].filter(Boolean);

  return (
    <li className="flex items-center gap-3 py-2">
      {media.posterUrl ? (
        <Image
          unoptimized
          src={media.posterUrl}
          alt=""
          width={40}
          height={60}
          className="h-15 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span aria-hidden className="h-15 w-10 shrink-0 rounded-lg bg-default" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-bold">{media.title}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted tabular-nums">
          {media.score !== undefined ? <ScoreChip score={media.score} /> : null}
          <span className="truncate">{meta.join(' · ')}</span>
        </span>
      </span>
      {media.type === 'show' ? (
        <StartShowButton media={media} actions={actions} />
      ) : (
        <WantMovieButton media={media} />
      )}
    </li>
  );
}

export function NewUserStart({ actions }: { actions: LibraryActions }) {
  const { dict } = useTranslation();
  const popular = useQuery({
    queryKey: ['catalog', 'library-start'],
    queryFn: loadPopular,
    staleTime: POPULAR_STALE_MS,
  });

  useEffect(() => {
    track('onboarding', { step: 'shown' });
  }, []);

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <section
        aria-labelledby="library-start"
        className="flex flex-col gap-3.5 rounded-3xl bg-surface px-4.5 py-5"
      >
        <h2 id="library-start" className="text-[22px] leading-tight font-extrabold tracking-tight">
          {dict.my.newUser.title}
        </h2>
        <p className="text-[15px] text-muted">{dict.my.newUser.text}</p>
        <button
          type="button"
          onClick={() => {
            track('onboarding', { step: 'search' });
            openSearch();
          }}
          className="flex h-12 items-center gap-2.5 rounded-full border border-border bg-default px-3.5 text-start text-base text-muted outline-none focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Search aria-hidden className="size-4.5" />
          {dict.my.newUser.search}
        </button>
        <h3 className="mt-1 text-[13px] font-bold text-muted">{dict.my.newUser.popular}</h3>
        <ul className="flex flex-col">
          {popular.data
            ? popular.data.map((media) => (
                <PopularRow key={media.mediaItemId} media={media} actions={actions} />
              ))
            : Array.from({ length: POPULAR_SHOWS + POPULAR_MOVIES }, (_, index) => (
                <li key={index} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-15 w-10 shrink-0 rounded-lg" />
                  <Skeleton className="h-4 flex-1 rounded-md" />
                  <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
                </li>
              ))}
        </ul>
      </section>
      <Link
        href={IMPORT_ROUTE}
        onClick={() => track('onboarding', { step: 'import' })}
        className="flex items-center gap-3.5 rounded-[20px] bg-surface px-4.5 py-4 text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-default"
        >
          <Download className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{dict.my.newUser.import.title}</span>
          <span className="text-[13px] text-muted">{dict.my.newUser.import.text}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted" />
      </Link>
    </div>
  );
}
