'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from 'react-aria-components';
import { Search } from 'lucide-react';
import { SearchDialog } from '@/features/search';
import { HOME_ROUTE, NAV_ROUTES, isNavRouteActive } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

const LINK_CLASS =
  'inline-flex min-h-tap items-center rounded-full px-3.5 text-muted no-underline transition-colors hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-soft-foreground focus-visible:outline-2 focus-visible:outline-focus';

export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const { dict } = useTranslation();

  return (
    <header className="pt-safe-top pr-safe-right pl-safe-left md:sticky md:bg-background/90 md:backdrop-blur-xl md:top-0 md:z-30 md:border-b md:border-separator">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href={HOME_ROUTE}
          aria-label={dict.nav.home}
          translate="no"
          className="inline-flex min-h-tap items-center gap-2 text-lg font-extrabold tracking-tight text-foreground no-underline"
        >
          <span
            aria-hidden
            className="relative flex size-8 items-center justify-center rounded-[10px] bg-surface-tertiary text-[19px] leading-none font-black text-foreground"
          >
            R
            <span className="absolute right-[5px] bottom-[6px] size-[5px] rounded-full bg-accent" />
          </span>
          Ratingo
        </Link>
        <nav aria-label={dict.nav.label} className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ROUTES.map((route) => (
            <Link
              key={route.section}
              href={route.href}
              className={LINK_CLASS}
              aria-current={isNavRouteActive(route, pathname) ? 'page' : undefined}
            >
              {dict.nav[route.section]}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <SearchDialog
            trigger={
              <Button className="inline-flex min-h-tap items-center gap-2 rounded-full border border-border px-4 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus">
                <Search aria-hidden className="size-4" />
                {dict.nav.search}
              </Button>
            }
          />
        </div>
      </div>
    </header>
  );
}
