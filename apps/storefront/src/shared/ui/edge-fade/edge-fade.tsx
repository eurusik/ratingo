import { cn } from '@ratingo/web-core/lib';

const SIDE = {
  start: 'start-0 bg-linear-to-r',
  end: 'end-0 bg-linear-to-l',
} as const;

const TONE = {
  page: 'from-background/90',
  overlay: 'from-overlay',
} as const;

interface EdgeFadeProps {
  side: keyof typeof SIDE;
  isVisible: boolean;
  tone?: keyof typeof TONE;
}

export function EdgeFade({ side, isVisible, tone = 'page' }: EdgeFadeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-10 to-transparent transition-opacity motion-reduce:transition-none',
        SIDE[side],
        TONE[tone],
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}
