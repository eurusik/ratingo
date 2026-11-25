'use client';

import { CalendarDays } from 'lucide-react';
import { ForwardLink } from '@/shared/ui';

interface CalendarTileProps {
  href: string;
  label: string;
  onOpen: () => void;
}

export function CalendarTile({ href, label, onOpen }: CalendarTileProps) {
  return (
    <ForwardLink
      href={href}
      onClick={onOpen}
      className="flex h-36 w-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-separator px-2 text-center text-[13px] leading-tight font-semibold break-words text-muted no-underline transition-colors outline-none hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:aspect-2/3 md:h-auto md:w-full md:text-sm"
    >
      <CalendarDays aria-hidden className="size-6" />
      {label}
    </ForwardLink>
  );
}
