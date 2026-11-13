'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { BackLink } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { ShareButton } from './share-button';
import { WatchingNowBadge } from './watching-now-badge';

const TITLE_SHOWN_FROM_PX = 260;

const GLASS_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors';

function useIsScrolledPast(offset: number): boolean {
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setIsPast(window.scrollY > offset);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [offset]);

  return isPast;
}

interface DetailsTopBarProps {
  title: string;
  shareHref: string;
  backHref: string;
  watchingNow?: number;
}

export function DetailsTopBar({ title, shareHref, backHref, watchingNow }: DetailsTopBarProps) {
  const { dict } = useTranslation();
  const isScrolled = useIsScrolledPast(TITLE_SHOWN_FROM_PX);
  const buttonTone = isScrolled ? 'bg-transparent' : 'bg-surface/60 backdrop-blur-xl';

  return (
    <div
      className={`fixed inset-x-0 top-0 z-30 border-b pt-safe-top pr-safe-right pl-safe-left transition-colors md:hidden ${
        isScrolled
          ? 'border-separator bg-background/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="flex h-15 items-center gap-2.5 px-4">
        <BackLink
          fallbackHref={backHref}
          aria-label={dict.details.back}
          className={`${GLASS_BUTTON} ${buttonTone}`}
        >
          <ChevronLeft aria-hidden className="size-6" />
        </BackLink>
        <div className="flex min-w-0 flex-1 justify-center">
          {isScrolled ? (
            <span className="truncate text-base font-bold">{title}</span>
          ) : watchingNow === undefined ? null : (
            <WatchingNowBadge count={watchingNow} />
          )}
        </div>
        <ShareButton href={shareHref} title={title} className={`${GLASS_BUTTON} ${buttonTone}`} />
      </div>
    </div>
  );
}
