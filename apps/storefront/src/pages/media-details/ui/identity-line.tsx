import { getDictionary, type Locale } from '@/shared/i18n';
import { formatCount, formatRuntime } from '../model/details-format';
import type { MediaDetailsView, ShowStatus } from '../model/details-view';

const ONGOING_STATUSES = new Set<ShowStatus>(['Returning Series', 'In Production']);

function lengthOf(view: MediaDetailsView, locale: Locale): string | undefined {
  const dict = getDictionary(locale).details;
  if (view.type === 'movie') {
    return view.runtimeMinutes === undefined ? undefined : formatRuntime(view.runtimeMinutes, dict);
  }
  return view.seasonCount === undefined
    ? undefined
    : formatCount(view.seasonCount, dict.seasons, locale);
}

export function IdentityLine({ view, locale }: { view: MediaDetailsView; locale: Locale }) {
  const dict = getDictionary(locale).details;
  const facts = [view.year, lengthOf(view, locale)].filter(Boolean).join(' · ');
  const showStatus = view.type === 'show' ? view.status : undefined;
  const genres = view.genres.join(', ');
  const hasTail = Boolean(genres || showStatus);

  return (
    <p className="text-[15px] leading-snug text-foreground/85 tabular-nums md:text-lg">
      {facts}
      {facts && hasTail ? (
        <>
          <br className="md:hidden" />
          <span className="hidden md:inline"> · </span>
        </>
      ) : null}
      {genres ? <span className="text-muted">{genres}</span> : null}
      {genres && showStatus ? <span className="text-muted"> · </span> : null}
      {showStatus ? (
        <span
          className={ONGOING_STATUSES.has(showStatus) ? 'font-semibold text-accent' : 'text-muted'}
        >
          {dict.showStatus[showStatus]}
        </span>
      ) : null}
    </p>
  );
}
