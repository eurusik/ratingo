import Link from 'next/link';
import type { MeDto } from '@ratingo/web-core/auth';
import { MY_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { UserAvatar } from './user-avatar';

type StatKey = 'moviesRated' | 'showsRated' | 'watchlist';

function statValues(stats: MeDto['stats']): Record<StatKey, number> {
  return {
    moviesRated: stats.moviesRated,
    showsRated: stats.showsRated,
    watchlist: stats.watchlistCount,
  };
}

const STAT_KEYS: readonly StatKey[] = ['moviesRated', 'showsRated', 'watchlist'];

export function ProfileSummary({ user, onNavigate }: { user: MeDto; onNavigate: () => void }) {
  const { dict } = useTranslation();
  const values = statValues(user.stats);

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
      <nav aria-label={dict.profile.stats.label}>
        <ul className="grid grid-cols-3 gap-2">
          {STAT_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={MY_ROUTE}
                onClick={onNavigate}
                className="flex min-h-tap flex-col rounded-2xl bg-surface-secondary px-3 py-2.5 text-foreground no-underline transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className="text-xl font-extrabold tabular-nums">{values[key]}</span>
                <span className="text-xs text-muted">{dict.profile.stats[key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
