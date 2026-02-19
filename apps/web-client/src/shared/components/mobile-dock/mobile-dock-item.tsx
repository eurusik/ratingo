/**
 * Single tab item for the mobile bottom dock.
 * Uses cva for variant-based styling (same pattern as shadcn ui primitives).
 * Renders as <Link> for navigation or <button> for actions (e.g. search).
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/utils';

const dockItemVariants = cva(
  'flex flex-col items-center justify-center h-full flex-1 min-w-0 transition-colors duration-150',
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
  const router = useRouter();
  const state = isActive ? 'active' : 'inactive';

  const content = (
    <>
      <Icon className="h-5 w-5" />
      <span className={cn('text-[10px] mt-0.5 leading-tight', isActive && 'font-medium')}>
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

  // Navigation items with optional guard (e.g. auth check)
  if (href && onBeforeNavigate) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (onBeforeNavigate()) {
        router.push(href as Route);
      }
    };
    return (
      <a href={href} className={dockItemVariants({ state })} onClick={handleClick}>
        {content}
      </a>
    );
  }

  // Plain navigation items
  if (href) {
    return (
      <Link href={href as Route} className={dockItemVariants({ state })}>
        {content}
      </Link>
    );
  }

  return null;
}
