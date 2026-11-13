import type { ReactNode } from 'react';
import Image from 'next/image';
import { MediaTypeIcon } from '@/entities/media';
import { BROWSE_ROUTE } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { SHARED_ART_TARGET } from '@/shared/lib';
import { watchingNowLabel } from '../model/details-format';
import { browseHrefFor } from '../model/details-routes';
import type { MediaDetailsView } from '../model/details-view';
import { DetailsBreadcrumbs } from './details-breadcrumbs';
import { IdentityLine } from './identity-line';
import { WatchingNowBadge } from './watching-now-badge';

function Backdrop({ url, largeUrl }: { url?: string; largeUrl?: string }) {
  if (!url) return null;

  return (
    <>
      <Image
        src={url}
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="object-cover object-top md:hidden"
      />
      <Image
        src={largeUrl ?? url}
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="hidden object-cover object-top md:block"
      />
    </>
  );
}

function Poster({ view }: { view: MediaDetailsView }) {
  return (
    <span
      {...SHARED_ART_TARGET}
      className="relative block aspect-2/3 w-full overflow-hidden rounded-[14px] bg-surface-secondary shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/12 ring-inset md:rounded-[20px]"
    >
      {view.posterUrl ? (
        <Image
          src={view.posterUrl}
          alt=""
          fill
          unoptimized
          loading="eager"
          sizes="(min-width: 48rem) 240px, 120px"
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted">
          <MediaTypeIcon type={view.type} className="size-8" />
        </span>
      )}
    </span>
  );
}

interface DetailsHeroProps {
  view: MediaDetailsView;
  locale: Locale;
  actions: ReactNode;
}

export function DetailsHero({ view, locale, actions }: DetailsHeroProps) {
  const dict = getDictionary(locale);
  const crumbs = [
    { label: dict.details.breadcrumb.browse, href: BROWSE_ROUTE },
    { label: dict.details.breadcrumb[view.type], href: browseHrefFor(view.type) },
    { label: view.title },
  ];

  return (
    <div className="relative -mt-(--page-top) md:-mx-(--page-gutter) md:mt-0">
      <div aria-hidden className="absolute inset-x-0 top-0 h-95 overflow-hidden md:h-140">
        <Backdrop url={view.backdropUrl} largeUrl={view.backdropLargeUrl} />
        <div className="absolute inset-0 hidden bg-linear-to-r from-background via-background/85 via-35% to-transparent md:block" />
        <div className="absolute inset-x-0 bottom-0 h-60 bg-linear-to-b from-transparent via-background/75 to-background md:h-45 md:via-transparent" />
      </div>
      <div className="relative flex flex-col gap-7 px-4 pt-55 md:gap-16 md:px-(--page-gutter) md:pt-6">
        <DetailsBreadcrumbs label={dict.details.breadcrumb.label} crumbs={crumbs} />
        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-x-4 gap-y-7 [grid-template-areas:'poster_title'_'actions_actions'] md:grid-cols-[240px_minmax(0,1fr)] md:gap-x-10 md:gap-y-5 md:[grid-template-areas:'poster_badge'_'poster_title'_'poster_actions']">
          <div className="[grid-area:poster] md:self-end">
            <Poster view={view} />
          </div>
          {view.watchingNow === undefined ? null : (
            <div className="hidden [grid-area:badge] md:block">
              <WatchingNowBadge
                label={watchingNowLabel(dict, locale, view.watchingNow, view.totalWatchers)}
              />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-2 pb-0.5 [grid-area:title] md:max-w-180 md:gap-2.5 md:pb-0">
            <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance break-words md:text-[52px]">
              {view.title}
            </h1>
            <IdentityLine view={view} locale={locale} />
          </div>
          <div className="min-w-0 [grid-area:actions] md:max-w-180 md:pb-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}
