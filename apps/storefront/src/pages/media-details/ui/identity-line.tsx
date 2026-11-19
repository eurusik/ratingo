import { formatReleaseDate } from '@/entities/media';
import { formatCount, getDictionary, interpolate, type Locale } from '@/shared/i18n';
import { formatRuntime } from '../model/details-format';
import type { MediaDetailsView } from '../model/details-view';
import { ShowStatusChip, UpcomingReleaseChip } from './status-chip';

function lengthOf(view: MediaDetailsView, locale: Locale): string | undefined {
  const dict = getDictionary(locale).details;
  if (view.type === 'movie') {
    return view.runtimeMinutes === undefined ? undefined : formatRuntime(view.runtimeMinutes, dict);
  }
  return view.seasonCount === undefined
    ? undefined
    : formatCount(view.seasonCount, dict.seasons, locale);
}

function upcomingLabel(view: MediaDetailsView, locale: Locale): string | undefined {
  const release = view.type === 'movie' ? view.upcomingRelease : undefined;
  if (!release) return undefined;
  const dict = getDictionary(locale);
  const date = interpolate(dict.details.upcoming.release, {
    date: formatReleaseDate(locale, release.date),
  });
  return `${date} · ${dict.release[release.kind]}`;
}

export function IdentityLine({ view, locale }: { view: MediaDetailsView; locale: Locale }) {
  const dict = getDictionary(locale).details;
  const upcoming = upcomingLabel(view, locale);
  const facts = [view.year, lengthOf(view, locale)].filter(Boolean).join(' · ');
  const showStatus = view.type === 'show' ? view.status : undefined;
  const genres = view.genres.join(', ');

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-3">
      <p className="text-[15px] leading-snug font-medium text-foreground/90 tabular-nums [text-shadow:0_0_12px_color-mix(in_oklab,var(--background)_80%,transparent)] md:text-lg">
        {facts}
        {facts && genres ? (
          <>
            <br className="md:hidden" />
            <span className="hidden md:inline"> · </span>
          </>
        ) : null}
        {genres ? <span className="text-foreground/70">{genres}</span> : null}
      </p>
      {showStatus ? (
        <ShowStatusChip status={showStatus} label={dict.showStatus[showStatus]} />
      ) : null}
      {upcoming ? <UpcomingReleaseChip label={upcoming} /> : null}
    </div>
  );
}
