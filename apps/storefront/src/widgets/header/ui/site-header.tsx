'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { cn } from '@ratingo/web-core/lib';
import { openAuth } from '@/shared/auth';
import {
  HOME_ROUTE,
  MY_ROUTE,
  NAV_ROUTES,
  isBrowsePath,
  isMediaDetailsPath,
  isNavRouteActive,
} from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { BrandMark, Container } from '@/shared/ui';
import { NotificationBell } from './notification-bell';
import { ProfileMenu } from './profile-menu';
import { SearchTrigger } from './search-trigger';

const LINK_CLASS =
  'inline-flex min-h-tap items-center rounded-full px-3.5 text-muted no-underline transition-colors hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-soft-foreground focus-visible:outline-2 focus-visible:outline-focus';

const PHONE_ACCOUNT_ROUTES = new Set([HOME_ROUTE, MY_ROUTE]);

function AccountControls() {
  const { dict } = useTranslation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <span aria-hidden className="invisible">
        <Button size="sm" className="phone-tap-target">
          {dict.header.signIn}
        </Button>
      </span>
    );
  }
  if (!user) {
    return (
      <Button size="sm" className="phone-tap-target" onPress={() => openAuth()}>
        {dict.header.signIn}
      </Button>
    );
  }

  return (
    <>
      <NotificationBell />
      <ProfileMenu user={user} />
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const { dict } = useTranslation();
  const showsAccountOnPhone = PHONE_ACCOUNT_ROUTES.has(pathname);
  const hidesOnPhone = isMediaDetailsPath(pathname) || isBrowsePath(pathname);

  return (
    <header
      className={cn(
        'pt-safe-top pr-safe-right pl-safe-left md:sticky md:top-0 md:z-30 md:[view-transition-name:site-header] md:border-b md:border-separator md:bg-background/90 md:backdrop-blur-xl',
        hidesOnPhone && 'hidden md:block',
      )}
    >
      <Container className="flex h-16 items-center gap-4">
        <Link
          href={HOME_ROUTE}
          aria-label={dict.nav.home}
          translate="no"
          className="inline-flex min-h-tap items-center gap-2 text-lg font-extrabold tracking-tight text-foreground no-underline"
        >
          <BrandMark />
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
        <div className="flex-1 md:hidden" />
        <div className="hidden md:block">
          <SearchTrigger />
        </div>
        <div
          className={`items-center justify-end gap-1 md:min-w-23 ${showsAccountOnPhone ? 'flex' : 'hidden md:flex'}`}
        >
          <AccountControls />
        </div>
      </Container>
    </header>
  );
}
