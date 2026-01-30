'use client';

/**
 * Link-based toggle group (vs shadcn's button-based ToggleGroup).
 * Uses Next.js Links for URL changes and browser navigation.
 */

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils';

const linkToggleGroupVariants = cva(
  'flex items-center border border-cinema-border p-0.5',
  {
    variants: {
      variant: {
        default: 'bg-cinema-elevated/50',
        ghost: 'bg-transparent border-transparent',
      },
      shape: {
        rounded: 'rounded-lg',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      shape: 'rounded',
    },
  }
);

const linkToggleItemVariants = cva(
  'px-3 py-1.5 text-sm transition-all',
  {
    variants: {
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
      },
      state: {
        active: 'bg-cinema-card text-cinema-text-primary shadow-sm',
        inactive: 'text-cinema-text-muted hover:text-cinema-text-secondary',
      },
    },
    defaultVariants: {
      shape: 'rounded',
      state: 'inactive',
    },
  }
);

export interface LinkToggleItem {
  value: string;
  label: string;
  href: Route;
}

export interface LinkToggleGroupProps
  extends VariantProps<typeof linkToggleGroupVariants> {
  items: LinkToggleItem[];
  value: string;
  className?: string;
}

export function LinkToggleGroup({
  items,
  value,
  variant,
  shape,
  className,
}: LinkToggleGroupProps) {
  return (
    <div className={cn(linkToggleGroupVariants({ variant, shape }), className)}>
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              linkToggleItemVariants({
                shape,
                state: isActive ? 'active' : 'inactive',
              })
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
