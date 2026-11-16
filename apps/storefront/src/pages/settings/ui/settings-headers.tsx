'use client';

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { MY_ROUTE, SETTINGS_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { BackLink, SECTION_TITLE_DESKTOP } from '@/shared/ui';
import { useGuardedLink } from '../model/leave-guard';

interface PhoneBarProps {
  title: string;
  backTo?: 'settings' | 'my';
}

export function PhoneBar({ title, backTo = 'settings' }: PhoneBarProps) {
  const { dict } = useTranslation();
  const copy = dict.settings;
  const isBackToMy = backTo === 'my';
  const backHref = isBackToMy ? MY_ROUTE : SETTINGS_ROUTE;
  const guardedLink = useGuardedLink();

  return (
    <div className="sticky top-0 z-20 flex min-h-14 items-center gap-1 border-b border-separator bg-background/90 px-1.5 pt-(--safe-top) backdrop-blur-xl md:hidden">
      <BackLink
        fallbackHref={backHref}
        returnsOnlyToFallback
        aria-label={isBackToMy ? copy.backToMyLabel : copy.backLabel}
        onNavigate={guardedLink(backHref)}
        className="flex h-11 max-w-[45%] shrink-0 items-center gap-0.5 rounded-full pe-1.5 text-base font-semibold text-accent no-underline outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ChevronLeft aria-hidden className="size-5.5 shrink-0" />
        <span className="truncate">{isBackToMy ? copy.backToMy : copy.back}</span>
      </BackLink>
      <h1 className="min-w-0 flex-1 truncate pe-16 text-center text-[17px] font-bold">{title}</h1>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="sticky top-16 z-20 box-content flex min-h-11 items-center gap-3 border-b border-separator bg-background pb-4 max-md:hidden">
      <h1 className={cn('font-extrabold', SECTION_TITLE_DESKTOP)}>{title}</h1>
      {subtitle ? (
        <>
          <span aria-hidden className="h-6 w-px shrink-0 bg-separator" />
          <span className="min-w-0 truncate text-sm text-muted tabular-nums">{subtitle}</span>
        </>
      ) : null}
    </div>
  );
}
