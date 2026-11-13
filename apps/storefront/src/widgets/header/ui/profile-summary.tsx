import type { MeDto } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { UserAvatar } from './user-avatar';

type StatKey = 'moviesRated' | 'showsRated' | 'watchlist';

const STAT_KEYS: readonly StatKey[] = ['moviesRated', 'showsRated', 'watchlist'];

function statValues(stats: MeDto['stats']): Record<StatKey, number> {
  return {
    moviesRated: stats.moviesRated,
    showsRated: stats.showsRated,
    watchlist: stats.watchlistCount,
  };
}

export function ProfileSummary({ user }: { user: MeDto }) {
  const { dict, locale } = useTranslation();
  const values = statValues(user.stats);
  const formatCount = new Intl.NumberFormat(locale);

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
      <dl aria-label={dict.profile.stats.label} className="grid grid-cols-3 gap-2">
        {STAT_KEYS.map((key) => (
          <div
            key={key}
            className="flex flex-col-reverse rounded-2xl bg-surface-secondary px-3 py-2.5"
          >
            <dt className="text-xs text-muted">{dict.profile.stats[key]}</dt>
            <dd className="text-xl font-extrabold tabular-nums">
              {formatCount.format(values[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
