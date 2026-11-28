'use client';

import { Button } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';

interface SpoilerCoverProps {
  text: string;
  revealLabel: string;
  onReveal: () => void;
}

export function SpoilerCover({ text, revealLabel, onReveal }: SpoilerCoverProps) {
  return (
    <div className="relative min-h-19 overflow-hidden rounded-2xl bg-default">
      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-3 inset-y-2.5 line-clamp-3 text-[15px] leading-normal break-words blur-sm select-none"
      >
        {text}
      </p>
      <div className="relative flex min-h-19 items-center justify-center">
        <Button
          variant="tertiary"
          onPress={onReveal}
          className="min-h-tap rounded-full bg-background/85 px-4 font-bold"
        >
          <TriangleAlert aria-hidden className="size-4 text-warning" />
          {revealLabel}
        </Button>
      </div>
    </div>
  );
}
