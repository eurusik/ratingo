'use client';

/**
 * Circular checkbox for marking episodes as watched.
 */

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface EpisodeCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  title?: string;
  /** Show ring highlight when parent group is hovered */
  highlightOnGroupHover?: boolean;
  /** Trigger animation from parent (for bulk marking) */
  shouldAnimate?: boolean;
}

export function EpisodeCheckbox({
  checked,
  onToggle,
  disabled = false,
  isLoading = false,
  className,
  title,
  highlightOnGroupHover = false,
  shouldAnimate = false,
}: EpisodeCheckboxProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation when shouldAnimate becomes true (parent-controlled for bulk marking)
  useEffect(() => {
    if (shouldAnimate && checked) {
      // Small random delay to stagger animations when multiple checkboxes are checked at once
      const delay = Math.random() * 100;
      const timeout = setTimeout(() => {
        setIsAnimating(true);
        // Increment key to force animation element remount (restarts CSS animation)
        setAnimationKey((k) => k + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [shouldAnimate, checked]);

  // Clear animation after it completes
  useEffect(() => {
    if (isAnimating) {
      const timeout = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isAnimating]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLoading) {
      onToggle();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isLoading) {
      e.preventDefault();
      e.stopPropagation();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || isLoading}
      title={title}
      className={cn(
        'relative flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cinema-page',
        checked
          ? 'bg-green-500 border-green-500 text-white hover:bg-green-400 hover:border-green-400'
          : 'border-cinema-text-disabled bg-transparent hover:border-cinema-text-secondary hover:bg-white/5',
        // Group hover - subtle ring to indicate "this is the control"
        highlightOnGroupHover && !checked && 'group-hover:border-cinema-text-muted group-hover:ring-2 group-hover:ring-cinema-accent/20',
        highlightOnGroupHover && checked && 'group-hover:ring-2 group-hover:ring-green-500/30',
        disabled && 'opacity-40 cursor-not-allowed',
        isLoading && 'animate-pulse',
        isAnimating && 'animate-vote-pop',
        className,
      )}
    >
      {checked && !isLoading && <Check className="w-3 h-3 stroke-[3]" />}
      {isLoading && (
        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      {/* Burst animation on check */}
      {isAnimating && checked && (
        <span
          key={animationKey}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span className="absolute w-5 h-5 rounded-full border-2 border-green-500 animate-vote-burst" />
        </span>
      )}
    </button>
  );
}
