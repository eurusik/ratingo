import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';
import { formatCompactPeople } from '../model/details-format';

interface WatchingNowBadgeProps {
  count: number;
  totalWatchers?: number;
}

export function WatchingNowBadge({ count, totalWatchers }: WatchingNowBadgeProps) {
  const { dict, locale } = useTranslation();
  const watching = formatCompactPeople(count, dict.media.watchingNowShort, locale);
  const label =
    totalWatchers === undefined
      ? interpolate(dict.details.watchingNow, { watching })
      : `${interpolate(dict.details.watchingNowLong, { watching })} · ${interpolate(
          dict.details.totalWatchers,
          { count: formatCompactCount(locale, totalWatchers) },
        )}`;

  return (
    <span className="inline-flex h-8 max-w-full items-center gap-2 rounded-full bg-surface/60 px-3 text-[13px] font-semibold text-foreground tabular-nums backdrop-blur-xl">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-success ring-3 ring-success/25"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
