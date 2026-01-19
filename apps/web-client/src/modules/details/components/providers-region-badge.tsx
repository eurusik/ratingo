/**
 * Region badge showing current region and fallback status.
 */

import { cn } from '@/shared/utils';

interface ProvidersRegionBadgeProps {
  region: 'UA' | 'US';
  isFallback: boolean;
}

export function ProvidersRegionBadge({ region, isFallback }: ProvidersRegionBadgeProps) {
  return (
    <div
      className={cn(
        'text-xs px-3 py-2 rounded-lg inline-flex items-center gap-2',
        isFallback
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-cinema-elevated/50 text-cinema-text-muted border border-cinema-border/50',
      )}
    >
      {isFallback && <span className="text-amber-400">⚠️</span>}
      <span>
        {isFallback
          ? `Для України даних немає, показані сервіси для ${region}`
          : `Сервіси для ${region}`}
      </span>
    </div>
  );
}
