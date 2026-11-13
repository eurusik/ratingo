'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
import { CalendarDays, Compass, Library, Search, Star, type LucideIcon } from 'lucide-react';
import { openSearch } from '@/features/search';
import { NAV_ROUTES, isNavRouteActive, type NavSection } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

const SECTION_ICONS: Record<NavSection, LucideIcon> = {
  today: Star,
  browse: Compass,
  calendar: CalendarDays,
  my: Library,
};

const FLOATING_SURFACE =
  'border border-border bg-surface/90 shadow-overlay backdrop-blur-xl backdrop-saturate-150';

export function MobileDock() {
  const pathname = usePathname() ?? '';
  const { dict } = useTranslation();

  return (
    <div className="flex items-center gap-2.5 px-4 pr-[max(1rem,var(--safe-right))] pb-[calc(var(--safe-bottom)+0.75rem)] pl-[max(1rem,var(--safe-left))] select-none [-webkit-touch-callout:none]">
      <nav
        aria-label={dict.nav.label}
        className={`flex h-tab-bar flex-1 items-center rounded-full px-1.5 ${FLOATING_SURFACE}`}
      >
        {NAV_ROUTES.map((route) => {
          const Icon = SECTION_ICONS[route.section];
          return (
            <Link
              key={route.section}
              href={route.href}
              aria-current={isNavRouteActive(route, pathname) ? 'page' : undefined}
              className="flex h-[calc(var(--spacing-tab-bar)-0.75rem)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] leading-tight font-medium text-muted no-underline transition-colors active:bg-default aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-soft-foreground focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon aria-hidden className="size-[22px]" />
              <span className="max-w-full truncate">{dict.nav[route.section]}</span>
            </Link>
          );
        })}
      </nav>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={dict.nav.search}
        onPress={openSearch}
        className={`size-tab-bar shrink-0 rounded-full text-foreground ${FLOATING_SURFACE}`}
      >
        <Search aria-hidden className="size-6" />
      </Button>
    </div>
  );
}
