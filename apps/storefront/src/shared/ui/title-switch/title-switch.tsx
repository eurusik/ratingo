'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { cn } from '@ratingo/web-core/lib';
import { isPlainClick } from '@/shared/lib';

interface TitleSwitchOption<T extends string> {
  id: T;
  label: string;
  href: string;
}

interface TitleSwitchProps<T extends string> {
  label: string;
  options: readonly TitleSwitchOption<T>[];
  value: T;
  onSelect: (id: T) => void;
  className?: string;
}

const TITLE_LINK =
  'flex min-h-tap items-center rounded-lg text-3xl font-extrabold tracking-tight text-muted no-underline transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:text-foreground md:text-4xl';

export function TitleSwitch<T extends string>({
  label,
  options,
  value,
  onSelect,
  className,
}: TitleSwitchProps<T>) {
  const selectInPlace = (id: T) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (id !== value) onSelect(id);
  };

  return (
    <nav aria-label={label} className={cn('flex items-baseline gap-5', className)}>
      {options.map((option) => (
        <Link
          key={option.id}
          href={option.href}
          onClick={selectInPlace(option.id)}
          aria-current={option.id === value ? 'page' : undefined}
          className={TITLE_LINK}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
