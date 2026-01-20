'use client';

/**
 * Dropdown menu for marking episodes as watched.
 * Shows options to mark just this episode or include previous ones.
 */

import { Check, ListChecks } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { EpisodeCheckbox } from './episode-checkbox';

export interface MarkWatchedPopoverProps {
  isWatched: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  /** Number of unwatched previous episodes */
  unwatchedPreviousCount: number;
  /** Called when user wants to mark only this episode */
  onMarkThis: () => void;
  /** Called when user wants to mark this + previous episodes */
  onMarkWithPrevious: () => void;
  /** Called when user wants to unmark this episode */
  onUnmark: () => void;
  /** Controlled open state */
  open?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Labels */
  labels: {
    markAsWatched: string;
    thisEpisodeOnly: string;
    previousEpisodesToo: string;
  };
  /** Whether to trigger animation (controlled from parent) */
  shouldAnimate?: boolean;
}

export function MarkWatchedPopover({
  isWatched,
  isLoading,
  disabled,
  unwatchedPreviousCount,
  onMarkThis,
  onMarkWithPrevious,
  onUnmark,
  open,
  onOpenChange,
  labels,
  shouldAnimate = false,
}: MarkWatchedPopoverProps) {
  const handleMarkThis = () => {
    onOpenChange?.(false);
    onMarkThis();
  };

  const handleMarkWithPrevious = () => {
    onOpenChange?.(false);
    onMarkWithPrevious();
  };

  // If already watched, just use simple checkbox for unmark
  if (isWatched) {
    return (
      <EpisodeCheckbox
        checked={isWatched}
        onToggle={onUnmark}
        isLoading={isLoading}
        disabled={disabled}
        highlightOnGroupHover
        shouldAnimate={shouldAnimate}
      />
    );
  }

  // If no unwatched previous episodes, use simple checkbox
  if (unwatchedPreviousCount === 0) {
    return (
      <EpisodeCheckbox
        checked={isWatched}
        onToggle={onMarkThis}
        isLoading={isLoading}
        disabled={disabled}
        highlightOnGroupHover
        shouldAnimate={shouldAnimate}
      />
    );
  }

  // Otherwise, show dropdown with options
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled || isLoading}>
        <div>
          <EpisodeCheckbox
            checked={isWatched}
            onToggle={() => {}}
            isLoading={isLoading}
            disabled={disabled}
            highlightOnGroupHover
            shouldAnimate={shouldAnimate}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="min-w-[200px] bg-cinema-elevated border-cinema-borderSoft"
      >
        <DropdownMenuLabel className="text-xs text-cinema-text-muted font-medium">
          {labels.markAsWatched}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-cinema-borderSoft/50" />
        <DropdownMenuItem
          onClick={handleMarkThis}
          className="gap-3 cursor-pointer text-cinema-text-primary hover:bg-white/5 focus:bg-white/5"
        >
          <Check className="w-4 h-4 text-cinema-text-muted" />
          <span>{labels.thisEpisodeOnly}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleMarkWithPrevious}
          className="gap-3 cursor-pointer text-cinema-text-primary hover:bg-white/5 focus:bg-white/5"
        >
          <ListChecks className="w-4 h-4 text-cinema-text-muted" />
          <span>{labels.previousEpisodesToo}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
