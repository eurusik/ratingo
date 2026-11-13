import { Chip } from '@heroui/react';
import { Popcorn } from 'lucide-react';
import { useWatchingNowLabel } from './media-details';

export function WatchingNowChip({ count }: { count: number }) {
  const { shortCount, label } = useWatchingNowLabel(count);

  return (
    <Chip size="md" className="gap-1.5 poster-glass ps-2 text-xs font-extrabold tabular-nums">
      <Popcorn aria-hidden className="size-3.5" />
      <span aria-hidden>{shortCount}</span>
      <span className="sr-only">{label}</span>
    </Chip>
  );
}
