'use client';

/**
 * Circular progress ring showing season watch completion.
 */

import { cn } from '@/shared/utils';

export interface SeasonProgressRingProps {
  watched: number;
  total: number;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = {
  sm: { outer: 32, inner: 24, stroke: 3, text: 'text-[9px]' },
  md: { outer: 40, inner: 32, stroke: 4, text: 'text-[10px]' },
} as const;

export function SeasonProgressRing({
  watched,
  total,
  size = 'sm',
  className,
}: SeasonProgressRingProps) {
  const config = SIZES[size];
  const radius = (config.inner - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? watched / total : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Don't show if no episodes
  if (total === 0) return null;

  // Show checkmark if complete
  const isComplete = watched === total && total > 0;

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: config.outer, height: config.outer }}
      title={`${watched} / ${total}`}
    >
      <svg
        width={config.outer}
        height={config.outer}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.outer / 2}
          cy={config.outer / 2}
          r={radius}
          fill="none"
          stroke="hsl(220 16% 17%)"
          strokeWidth={config.stroke}
        />
        {/* Progress circle */}
        <circle
          cx={config.outer / 2}
          cy={config.outer / 2}
          r={radius}
          fill="none"
          stroke={isComplete ? 'hsl(142 76% 36%)' : 'hsl(217 91% 60%)'}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <svg
            className="w-3 h-3 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className={cn('font-medium text-cinema-text-secondary', config.text)}>
            {watched}/{total}
          </span>
        )}
      </div>
    </div>
  );
}
