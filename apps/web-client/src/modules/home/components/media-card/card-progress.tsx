/**
 * Season progress indicator for shows.
 *
 * Shows episode count as TEXT, not a video-style progress bar.
 * This avoids the "video player" mental model.
 *
 * IMPORTANT: We use text/segments, NOT animated bars.
 * Ratingo is a discovery tool, not a player.
 */

import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';

interface SeasonProgressProps {
  /** Season number. */
  season: number;
  /** Current episode number (released). */
  current: number;
  /** Total episodes in season. */
  total: number;
  /** Show as segments instead of text. */
  variant?: 'text' | 'segments';
  className?: string;
}

/**
 * Season progress as text or segments.
 *
 * @example
 * <SeasonProgress season={2} current={4} total={8} />
 * // "Вийшло: S2 • 4 з 8"
 *
 * <SeasonProgress season={2} current={4} total={8} variant="segments" />
 * // ●●●●○○○○
 */
export function SeasonProgress({
  season,
  current,
  total,
  variant = 'text',
  className,
}: SeasonProgressProps) {
  const { t } = useTranslation();

  if (variant === 'segments') {
    // Segment dots: ●●●●○○○○
    const maxDots = Math.min(total, 12); // Cap at 12 for UI
    const filledDots = Math.round((current / total) * maxDots);

    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        {Array.from({ length: maxDots }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              i < filledDots ? 'bg-blue-400' : 'bg-zinc-700'
            )}
          />
        ))}
      </div>
    );
  }

  // Text variant: "Вийшло: S2 • 4 з 8"
  return (
    <div className={cn('text-xs text-zinc-400', className)}>
      <span className="text-zinc-500">{t('card.season.released')}:</span>
      <span className="ml-1">S{season}</span>
      <span className="mx-1">•</span>
      <span>
        {current} {t('card.season.ofEpisodes')} {total}
      </span>
    </div>
  );
}

// Keep old name for backwards compatibility, but deprecated
export const CardProgress = SeasonProgress;
