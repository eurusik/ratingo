import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MeDto } from '@ratingo/web-core/auth';
import { libraryListRoute } from '@/entities/library';
import { BROWSE_ROUTE } from '@/shared/config';
import { useTranslation, type Dictionary } from '@/shared/i18n';
import { UserAvatar } from './user-avatar';

type ProfileStatsLayout = 'tiles' | 'rows';

type StatLabels = Dictionary['profile']['stats'];

interface ProfileStat {
  label: string;
  href: string;
  count?: string;
}

const NARROW_NO_BREAK_SPACE = ' ';

const countFormats = new Map<string, Intl.NumberFormat>();

function formatStatCount(locale: string, count: number): string {
  let format = countFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    countFormats.set(locale, format);
  }
  return format
    .formatToParts(count)
    .map((part) => (part.type === 'group' ? NARROW_NO_BREAK_SPACE : part.value))
    .join('');
}

function profileStats(stats: MeDto['stats'], labels: StatLabels, locale: string): ProfileStat[] {
  const isWatchlistEmpty = stats.watchlistCount === 0;
  return [
    {
      label: labels.movies,
      href: libraryListRoute('history'),
      count: formatStatCount(locale, stats.moviesRated),
    },
    {
      label: labels.shows,
      href: libraryListRoute('history'),
      count: formatStatCount(locale, stats.showsRated),
    },
    {
      label: labels.watchlist,
      href: isWatchlistEmpty ? BROWSE_ROUTE : libraryListRoute('plan'),
      count: isWatchlistEmpty ? undefined : formatStatCount(locale, stats.watchlistCount),
    },
  ];
}

function accessibleName(stat: ProfileStat, labels: StatLabels): string {
  const value = stat.count ?? `${labels.emptyWatchlist}. ${labels.findToWatch}`;
  return `${stat.label}: ${value}`;
}

const LINK_CLASS =
  'text-foreground no-underline transition-colors hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-focus';

const LAYOUT_LINK_CLASS: Record<ProfileStatsLayout, string> = {
  tiles: `@container flex min-h-28 flex-col gap-4 rounded-2xl bg-surface-secondary px-3.5 pt-3.5 pb-4 ${LINK_CLASS}`,
  rows: `flex min-h-16 items-center gap-3 rounded-xl ps-4 pe-3.5 ${LINK_CLASS}`,
};

const LAYOUT_LIST_CLASS: Record<ProfileStatsLayout, string> = {
  tiles: 'grid grid-cols-3 gap-2',
  rows: 'flex flex-col gap-0.5 rounded-2xl bg-surface-secondary p-1.5',
};

const CHEVRON_CLASS = 'size-4 shrink-0 text-muted';

const COUNT_CLASS = 'font-extrabold leading-none tracking-tight tabular-nums whitespace-nowrap';

function TileContent({ stat, labels }: { stat: ProfileStat; labels: StatLabels }) {
  return (
    <>
      <span className="flex items-center justify-between gap-1 text-sm font-medium text-muted">
        {stat.label}
        <ChevronRight aria-hidden className={CHEVRON_CLASS} />
      </span>
      {stat.count === undefined ? (
        <span className="flex flex-col gap-1 text-xs leading-tight font-semibold">
          <span className="text-sm">{labels.emptyWatchlist}</span>
          <span className="text-accent">{labels.findToWatch}</span>
        </span>
      ) : (
        <span className={`text-[min(2.125rem,30cqi)] ${COUNT_CLASS}`}>{stat.count}</span>
      )}
    </>
  );
}

function RowContent({ stat, labels }: { stat: ProfileStat; labels: StatLabels }) {
  return (
    <>
      <span className="min-w-0 flex-1 text-base font-medium text-muted">{stat.label}</span>
      {stat.count === undefined ? (
        <span className="text-[15px] font-semibold text-accent">{labels.findToWatch}</span>
      ) : (
        <span className={`text-[26px] ${COUNT_CLASS}`}>{stat.count}</span>
      )}
      <ChevronRight aria-hidden className={CHEVRON_CLASS} />
    </>
  );
}

export function ProfileSummary({
  user,
  layout,
  onNavigate,
}: {
  user: MeDto;
  layout: ProfileStatsLayout;
  onNavigate: () => void;
}) {
  const { dict, locale } = useTranslation();
  const labels = dict.profile.stats;
  const stats = profileStats(user.stats, labels, locale);
  const Content = layout === 'tiles' ? TileContent : RowContent;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <UserAvatar user={user} size="lg" />
        <div className="flex min-w-0 flex-col">
          <span translate="no" className="truncate text-lg font-extrabold">
            {user.username}
          </span>
          <span translate="no" className="truncate text-sm text-muted">
            {user.email}
          </span>
        </div>
      </div>
      <ul aria-label={labels.label} className={LAYOUT_LIST_CLASS[layout]}>
        {stats.map((stat) => (
          <li key={stat.label} className="grid">
            <Link
              href={stat.href}
              onClick={onNavigate}
              aria-label={accessibleName(stat, labels)}
              className={LAYOUT_LINK_CLASS[layout]}
            >
              <Content stat={stat} labels={labels} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
