import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@ratingo/web-core/lib';

const SIDE_NAV_ITEM =
  'flex items-center gap-2 rounded-xl px-3.5 text-foreground/85 no-underline outline-none transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-surface aria-[current=page]:font-bold aria-[current=page]:text-foreground';

interface SideNavItemProps {
  href: string;
  label: string;
  isCurrent: boolean;
  isMinor?: boolean;
  children?: ReactNode;
}

export function SideNavItem({
  href,
  label,
  isCurrent,
  isMinor = false,
  children,
}: SideNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(SIDE_NAV_ITEM, isMinor ? 'h-10 text-sm text-muted' : 'h-11 text-[15px]')}
    >
      <span className="flex-1 truncate">{label}</span>
      {children}
    </Link>
  );
}
