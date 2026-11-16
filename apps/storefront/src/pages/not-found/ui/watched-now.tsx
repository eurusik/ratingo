import type { ReactNode } from 'react';
import { PosterTile, PosterTileSkeleton } from '@/entities/media';
import { getDictionary, type Locale } from '@/shared/i18n';
import { loadWatchedNow } from '../api/load-watched-now';
import { WATCHED_NOW_COLUMNS } from '../model/watched-now-grid';

const HEADING_ID = 'watched-now';

function tileVisibility(index: number): string {
  return index < WATCHED_NOW_COLUMNS.phone ? 'min-w-0' : 'min-w-0 max-md:hidden';
}

function WatchedNowFrame({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="mt-1.5 flex w-full flex-col gap-2.5 text-start md:mt-3"
    >
      <h2 id={HEADING_ID} className="text-[13px] font-bold text-muted">
        {heading}
      </h2>
      <ul className="grid grid-cols-3 items-start gap-x-2.5 gap-y-4.5 md:grid-cols-6 md:gap-x-4">
        {children}
      </ul>
    </section>
  );
}

export function WatchedNowSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-hidden className="w-full">
      <WatchedNowFrame heading={getDictionary(locale).notFound.watchedNow}>
        {Array.from({ length: WATCHED_NOW_COLUMNS.desktop }, (_, index) => (
          <li key={index} className={tileVisibility(index)}>
            <PosterTileSkeleton />
          </li>
        ))}
      </WatchedNowFrame>
    </div>
  );
}

export async function WatchedNow({ locale }: { locale: Locale }) {
  const titles = await loadWatchedNow();
  if (titles.length === 0) return null;

  return (
    <WatchedNowFrame heading={getDictionary(locale).notFound.watchedNow}>
      {titles.map((media, index) => (
        <li key={media.mediaItemId} className={tileVisibility(index)}>
          <PosterTile media={media} />
        </li>
      ))}
    </WatchedNowFrame>
  );
}
