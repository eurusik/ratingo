/**
 * Single tab item for the mobile bottom dock.
 * Uses cva for variant-based styling (same pattern as shadcn ui primitives).
 * Renders as <Link> for navigation or <button> for actions (e.g. search).
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/utils';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-cinema-card';

const dockItemVariants = cva(
  `flex flex-col items-center justify-center h-full flex-1 min-w-0 transition-colors duration-150 ${FOCUS_RING}`,
  {
    variants: {
      state: {
        active: 'text-cinema-text-primary',
        inactive: 'text-cinema-text-muted active:bg-cinema-elevated/50',
      },
    },
    defaultVariants: {
      state: 'inactive',
    },
  },
);

interface MobileDockItemProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  isActive: boolean;
  /** Fires instead of navigation. Used for actions like opening search dialog. */
  onClick?: () => void;
  /** Fires before navigation. Return false to prevent navigation (e.g. auth guard). */
  onBeforeNavigate?: () => boolean;
}

export function MobileDockItem({
  icon: Icon,
  label,
  href,
  isActive,
  onClick,
  onBeforeNavigate,
}: MobileDockItemProps) {
  const state = isActive ? 'active' : 'inactive';

  const content = (
    <>
      <Icon className="h-5 w-5" />
      <span className={cn('text-[11px] mt-0.5 leading-tight', isActive && 'font-medium')}>
        {label}
      </span>
    </>
  );

  // Action-only items (e.g. search) — always a button
  if (onClick && !href) {
    return (
      <button type="button" className={dockItemVariants({ state })} onClick={onClick}>
        {content}
      </button>
    );
  }

  // Navigation items (with optional guard)
  if (href) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!onBeforeNavigate) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (!onBeforeNavigate()) {
        e.preventDefault();
      }
    };

    return (
      <Link
        href={href as Route}
        className={dockItemVariants({ state })}
        onClick={handleClick}
        aria-current={isActive ? 'page' : undefined}
      >
        {content}
      </Link>
    );
  }

  return null;
}
