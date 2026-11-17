import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MeDto } from '@ratingo/web-core/auth';
import { libraryListRoute } from '@/entities/library';
import { BROWSE_ROUTE } from '@/shared/config';
import { formatNumber, useTranslation, type Dictionary } from '@/shared/i18n';
import { UserAvatar } from './user-avatar';

type ProfileStatsLayout = 'tiles' | 'rows';

type StatKey = 'movies' | 'shows' | 'watchlist';

interface ProfileStat {
  key: StatKey;
  count: number;
  href: string;
  isEmptyWatchlist: boolean;
}

const NARROW_NO_BREAK_SPACE = ' ';

function profileStats(stats: MeDto['stats']): ProfileStat[] {
  const isEmptyWatchlist = stats.watchlistCount === 0;
  return [
    {
      key: 'movies',
      count: stats.moviesRated,
      href: libraryListRoute('history'),
      isEmptyWatchlist: false,
    },
    {
      key: 'shows',
      count: stats.showsRated,
      href: libraryListRoute('history'),
      isEmptyWatchlist: false,
    },
    {
      key: 'watchlist',
      count: stats.watchlistCount,
      href: isEmptyWatchlist ? BROWSE_ROUTE : libraryListRoute('plan'),
      isEmptyWatchlist,
    },
  ];
}

function formatStatCount(locale: string, count: number): string {
  return formatNumber(locale, count).replace(/\s/g, NARROW_NO_BREAK_SPACE);
}

const LINK_CLASS =
  'text-foreground no-underline transition-colors hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-focus';

const CHEVRON_CLASS = 'size-4 shrink-0 text-muted';

const COUNT_CLASS = 'font-extrabold leading-none tracking-tight tabular-nums whitespace-nowrap';

function StatTile({
  stat,
  dict,
  locale,
  onNavigate,
}: {
  stat: ProfileStat;
  dict: Dictionary;
  locale: string;
  onNavigate: () => void;
}) {
  const labels = dict.profile.stats;
  return (
    <Link
      href={stat.href}
      onClick={onNavigate}
      className={`@container flex min-h-28 flex-col gap-4 rounded-2xl bg-surface-secondary px-3.5 pt-3.5 pb-4 ${LINK_CLASS}`}
    >
      <span className="flex items-center justify-between gap-1 text-sm font-medium text-muted">
        {labels[stat.key]}
        <ChevronRight aria-hidden className={CHEVRON_CLASS} />
      </span>
      {stat.isEmptyWatchlist ? (
        <span className="flex flex-col gap-1 text-xs leading-tight font-semibold">
          <span className="text-sm">{labels.emptyWatchlist}</span>
          <span className="text-accent">{labels.findToWatch}</span>
        </span>
      ) : (
        <span className={`text-[min(2.125rem,30cqi)] ${COUNT_CLASS}`}>
          {formatStatCount(locale, stat.count)}
        </span>
      )}
    </Link>
  );
}

function StatRow({
  stat,
  dict,
  locale,
  onNavigate,
}: {
  stat: ProfileStat;
  dict: Dictionary;
  locale: string;
  onNavigate: () => void;
}) {
  const labels = dict.profile.stats;
  return (
    <Link
      href={stat.href}
      onClick={onNavigate}
      className={`flex min-h-16 items-center gap-3 rounded-xl ps-4 pe-3.5 ${LINK_CLASS}`}
    >
      <span className="flex-1 text-base font-medium text-muted">{labels[stat.key]}</span>
      {stat.isEmptyWatchlist ? (
        <span className="text-[15px] font-semibold text-accent">{labels.findToWatch}</span>
      ) : (
        <span className={`text-[26px] ${COUNT_CLASS}`}>{formatStatCount(locale, stat.count)}</span>
      )}
      <ChevronRight aria-hidden className={CHEVRON_CLASS} />
    </Link>
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
  const stats = profileStats(user.stats);
  const Stat = layout === 'tiles' ? StatTile : StatRow;

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
      <ul
        aria-label={dict.profile.stats.label}
        className={
          layout === 'tiles'
            ? 'grid grid-cols-3 gap-2'
            : 'flex flex-col gap-0.5 rounded-2xl bg-surface-secondary p-1.5'
        }
      >
        {stats.map((stat) => (
          <li key={stat.key} className="grid">
            <Stat stat={stat} dict={dict} locale={locale} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
