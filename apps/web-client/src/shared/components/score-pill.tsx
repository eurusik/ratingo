import { cn } from '@/shared/utils';

interface ScorePillProps {
  rating: number;
  source?: string;
  className?: string;
}

export function ScorePill({ rating, source = 'TVMaze', className }: ScorePillProps) {
  return (
    <span
      aria-label={`${source} rating: ${rating.toFixed(1)}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-cinema-text-secondary',
        className,
      )}
    >
      {rating.toFixed(1)}
      <span className="text-[9px] uppercase tracking-[0.12em] opacity-50">{source}</span>
    </span>
  );
}
