'use client';

/**
 * Episode card component for episode list.
 */

import Image from 'next/image';
import { Tv } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/utils/format';
import { cn, resolveMediaImageUrl, IMAGE_SIZES } from '@/shared/utils';
import { EpisodeCheckbox } from './episode-checkbox';

type EpisodeDto = components['schemas']['EpisodeDto'];

export interface EpisodeCardProps {
  episode: EpisodeDto;
  dict: ReturnType<typeof getDictionary>;
  /** Whether this episode is marked as watched */
  isWatched?: boolean;
  /** Called when user toggles watched status */
  onToggleWatched?: () => void;
  /** Whether the toggle is loading */
  isToggling?: boolean;
  /** Whether to show the checkbox (hidden when not authenticated) */
  showCheckbox?: boolean;
}

/**
 * Formats episode runtime.
 */
function formatRuntime(minutes: number | null | undefined, label: string): string | null {
  if (!minutes) return null;
  return `${minutes} ${label}`;
}

/**
 * Checks if episode is upcoming (air date in future).
 */
function isUpcoming(airDate: string | null | undefined): boolean {
  if (!airDate) return false;
  return new Date(airDate) > new Date();
}

export function EpisodeCard({
  episode,
  dict,
  isWatched = false,
  onToggleWatched,
  isToggling = false,
  showCheckbox = false,
}: EpisodeCardProps) {
  const upcoming = isUpcoming(episode.airDate);
  const title = episode.title || dict.details.showStatus.noTitle.replace('{number}', String(episode.number));
  const runtime = formatRuntime(episode.runtime, dict.details.showStatus.minutes);
  const isClickable = showCheckbox && onToggleWatched && !upcoming && !isToggling;

  const handleClick = () => {
    if (isClickable) {
      onToggleWatched();
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-4 py-3 pl-1 border-b border-cinema-borderSoft/30 last:border-b-0',
        upcoming && 'opacity-60',
      )}
    >
      {/* Checkbox - highlighted on row hover */}
      {showCheckbox && (
        <EpisodeCheckbox
          checked={isWatched}
          onToggle={onToggleWatched || (() => {})}
          disabled={upcoming || !onToggleWatched}
          isLoading={isToggling}
          title={isWatched ? dict.details.showStatus.markUnwatched : dict.details.showStatus.markWatched}
          highlightOnGroupHover={isClickable}
        />
      )}

      {/* Content area with hover */}
      <div
        onClick={handleClick}
        className={cn(
          'relative flex items-center gap-3 flex-1 min-w-0 py-1 -my-1 pl-1 pr-3 rounded-xl transition-colors',
          isClickable && [
            'cursor-pointer',
            'hover:bg-white/[0.03]',
            'active:bg-white/[0.05]',
          ],
        )}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleWatched();
                }
              }
            : undefined
        }
      >
        {/* Episode thumbnail */}
        <div className="relative flex-shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-cinema-elevated">
          {resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300) ? (
            <Image
              src={resolveMediaImageUrl(episode.stillPath, IMAGE_SIZES.W300)!}
              alt={title}
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-6 h-6 text-cinema-text-disabled" />
            </div>
          )}
          {upcoming && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-[10px] font-medium text-white uppercase tracking-wider">
                {dict.details.showStatus.upcoming}
              </span>
            </div>
          )}
        </div>

        {/* Episode info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-cinema-text-primary">
              {episode.number}. {title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-cinema-text-muted">
            {episode.airDate && <span>{formatDate(episode.airDate)}</span>}
            {episode.airDate && runtime && <span className="text-cinema-text-disabled">·</span>}
            {runtime && <span>{runtime}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
