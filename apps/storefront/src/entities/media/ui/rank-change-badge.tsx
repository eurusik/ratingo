import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { RankChange } from '../model/rank-change';

const BADGE_CLASS = 'h-4.5 shrink-0 px-1.5 text-[11px] font-extrabold tabular-nums';

function useRankChangeLabel(): (change: RankChange) => string {
  const { dict } = useTranslation();
  return (change) => {
    if (change.kind === 'up') return interpolate(dict.rating.change.up, { places: change.places });
    if (change.kind === 'down')
      return interpolate(dict.rating.change.down, { places: change.places });
    return dict.rating.change[change.kind];
  };
}

function visibleText(change: RankChange, newShort: string): string {
  if (change.kind === 'up') return `↑ ${change.places}`;
  if (change.kind === 'down') return `↓ ${change.places}`;
  if (change.kind === 'new') return newShort;
  return '—';
}

export function RankChangeBadge({ change }: { change: RankChange }) {
  const { dict } = useTranslation();
  const label = useRankChangeLabel()(change);
  const text = visibleText(change, dict.rating.change.newShort);

  if (change.kind === 'same') {
    return (
      <span className="text-[11px] font-extrabold text-muted">
        <span aria-hidden>{text}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Chip
      size="sm"
      variant={change.kind === 'new' ? 'primary' : 'soft'}
      color={change.kind === 'down' ? 'default' : 'accent'}
      className={BADGE_CLASS}
    >
      <span aria-hidden>{text}</span>
      <span className="sr-only">{label}</span>
    </Chip>
  );
}
