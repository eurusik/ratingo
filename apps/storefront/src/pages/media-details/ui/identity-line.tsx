'use client';

import { useTranslation } from '@/shared/i18n';
import { formatCount, formatRuntime } from '../model/details-format';
import type { MediaDetailsView, ShowStatus } from '../model/details-view';

const ONGOING_STATUSES = new Set<ShowStatus>(['Returning Series', 'In Production']);

export function IdentityLine({ view }: { view: MediaDetailsView }) {
  const { dict, locale } = useTranslation();
  const length =
    view.type === 'movie'
      ? view.runtimeMinutes && formatRuntime(view.runtimeMinutes, dict.details)
      : view.seasonCount && formatCount(view.seasonCount, dict.details.seasons, locale);
  const facts = [view.year, length].filter(Boolean).join(' · ');
  const genres = view.genres.join(', ');
  const showStatus = view.type === 'show' && view.status ? view.status : undefined;

  return (
    <p className="text-[15px] leading-snug text-foreground/85 tabular-nums md:text-lg">
      {facts}
      {facts && (genres || showStatus) ? <br className="md:hidden" /> : null}
      {facts && (genres || showStatus) ? <span className="hidden md:inline"> · </span> : null}
      {genres ? <span className="text-muted">{genres}</span> : null}
      {genres && showStatus ? <span className="text-muted"> · </span> : null}
      {showStatus ? (
        <span
          className={ONGOING_STATUSES.has(showStatus) ? 'font-semibold text-accent' : 'text-muted'}
        >
          {dict.details.showStatus[showStatus]}
        </span>
      ) : null}
    </p>
  );
}
