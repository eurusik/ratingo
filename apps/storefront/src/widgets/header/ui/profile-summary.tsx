import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { MeDto } from '@ratingo/web-core/auth';
import { libraryListRoute, listCount, useLibraryCounts } from '@/entities/library';
import type { LibraryCounts } from '@/shared/api';
import { BROWSE_ROUTE } from '@/shared/config';
import { useTranslation, type Dictionary } from '@/shared/i18n';
import { UserAvatar } from './user-avatar';

type ProfileStatsLayout = 'tiles' | 'rows';

type StatLabels = Dictionary['profile']['stats'];

type StatValue = { kind: 'count'; text: string } | { kind: 'empty' } | { kind: 'loading' };

interface ProfileStat {
  label: string;
  href: string;
  value: StatValue;
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

function countValue(locale: string, count: number): StatValue {
  return { kind: 'count', text: formatStatCount(locale, count) };
}

function watchlistStat(
  counts: LibraryCounts | undefined,
  labels: StatLabels,
  locale: string,
): ProfileStat {
  const count = counts ? listCount(counts, 'plan') : undefined;
  const value: StatValue =
    count === undefined
      ? { kind: 'loading' }
      : count === 0
        ? { kind: 'empty' }
        : countValue(locale, count);
  return {
    label: labels.watchlist,
    href: value.kind === 'empty' ? BROWSE_ROUTE : libraryListRoute('plan'),
    value,
  };
}

function profileStats(
  stats: MeDto['stats'],
  counts: LibraryCounts | undefined,
  labels: StatLabels,
  locale: string,
): ProfileStat[] {
  return [
    {
      label: labels.movies,
      href: libraryListRoute('history'),
      value: countValue(locale, stats.moviesRated),
    },
    {
      label: labels.shows,
      href: libraryListRoute('history'),
      value: countValue(locale, stats.showsRated),
    },
    watchlistStat(counts, labels, locale),
  ];
}

function accessibleName({ label, value }: ProfileStat, labels: StatLabels): string {
  if (value.kind === 'count') return `${label}: ${value.text}`;
  if (value.kind === 'empty') return `${label}: ${labels.emptyWatchlist}. ${labels.find}`;
  return label;
}

const LINK_CLASS =
  'text-foreground no-underline transition-colors hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-focus';

const LAYOUT_LINK_CLASS: Record<ProfileStatsLayout, string> = {
  tiles: `@container flex min-h-26 flex-col justify-between rounded-2xl bg-surface-secondary p-3.5 ${LINK_CLASS}`,
  rows: `flex min-h-14 items-center gap-3 rounded-xl ps-4 pe-3.5 ${LINK_CLASS}`,
};

const LAYOUT_LIST_CLASS: Record<ProfileStatsLayout, string> = {
  tiles: 'grid grid-cols-3 gap-2',
  rows: 'flex flex-col gap-0.5 rounded-2xl bg-surface-secondary p-1.5',
};

const LAYOUT_COUNT_CLASS: Record<ProfileStatsLayout, string> = {
  tiles: 'text-[min(1.625rem,30cqi)]',
  rows: 'text-[22px]',
};

const CHEVRON_CLASS = 'size-4 shrink-0 text-muted';

function StatValueView({
  value,
  labels,
  layout,
}: {
  value: StatValue;
  labels: StatLabels;
  layout: ProfileStatsLayout;
}) {
  if (value.kind === 'loading') {
    return <span aria-hidden className="h-[22px] w-10 rounded-md bg-surface-tertiary" />;
  }
  if (value.kind === 'empty') {
    return (
      <span className="flex items-center gap-1 text-[15px] leading-none font-bold whitespace-nowrap text-accent">
        {labels.find}
        <ArrowRight aria-hidden className="size-4" />
      </span>
    );
  }
  return (
    <span
      className={`${LAYOUT_COUNT_CLASS[layout]} leading-none font-extrabold tracking-tight whitespace-nowrap tabular-nums`}
    >
      {value.text}
    </span>
  );
}

function TileContent({ stat, labels }: { stat: ProfileStat; labels: StatLabels }) {
  return (
    <>
      <span className="flex items-start justify-between gap-1 text-sm leading-tight font-medium text-muted">
        {stat.label}
        <ChevronRight aria-hidden className={CHEVRON_CLASS} />
      </span>
      <StatValueView value={stat.value} labels={labels} layout="tiles" />
    </>
  );
}

function RowContent({ stat, labels }: { stat: ProfileStat; labels: StatLabels }) {
  return (
    <>
      <span className="min-w-0 flex-1 text-base font-medium text-muted">{stat.label}</span>
      <StatValueView value={stat.value} labels={labels} layout="rows" />
      {stat.value.kind === 'empty' ? null : <ChevronRight aria-hidden className={CHEVRON_CLASS} />}
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
  const counts = useLibraryCounts();
  const labels = dict.profile.stats;
  const stats = profileStats(user.stats, counts, labels, locale);
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
