import type { ReactNode } from 'react';
import Image from 'next/image';
import { MediaTypeIcon } from '@/entities/media';
import { BROWSE_ROUTE } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { SHARED_ART_TARGET } from '@/shared/lib';
import { BackdropPicture, DownscaledBlur } from '@/shared/ui';
import { watchingNowLabel } from '../model/details-format';
import { browseHrefFor } from '../model/details-routes';
import { DETAILS_REVEAL } from '../model/details-reveal';
import type { MediaDetailsView } from '../model/details-view';
import { ArrivingArt } from './arriving-art';
import { DetailsBreadcrumbs } from './details-breadcrumbs';
import { IdentityLine } from './identity-line';
import { WatchingNowBadge } from './watching-now-badge';

const DETAILS_BACKDROP_FOCUS = 'object-top md:object-[center_25%]';

function HeroBackdrop({ url, largeUrl }: { url?: string; largeUrl?: string }) {
  return (
    <div
      {...DETAILS_REVEAL}
      aria-hidden
      className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
    >
      {url ? (
        <>
          <div className="absolute inset-x-0 top-0 bottom-2">
            <BackdropPicture
              url={url}
              wideUrl={largeUrl}
              className={DETAILS_BACKDROP_FOCUS}
              isPriority
            />
          </div>
          <div className="absolute inset-x-0 top-0 bottom-2 overflow-hidden [mask-image:linear-gradient(to_top,black_40%,transparent_75%)] md:[mask-image:linear-gradient(to_top,black_15%,transparent_65%),linear-gradient(to_right,black_25%,transparent_60%)]">
            <DownscaledBlur>
              <BackdropPicture
                url={url}
                wideUrl={largeUrl}
                className={`scale-110 ${DETAILS_BACKDROP_FOCUS}`}
              />
            </DownscaledBlur>
          </div>
        </>
      ) : null}
      <div className="hero-fade absolute inset-0" />
      <div className="md:hero-fade-side absolute inset-0" />
    </div>
  );
}

function Poster({ view }: { view: MediaDetailsView }) {
  return (
    <span
      {...SHARED_ART_TARGET}
      style={
        view.posterPlaceholderUrl
          ? { backgroundImage: `url(${JSON.stringify(view.posterPlaceholderUrl)})` }
          : undefined
      }
      className="relative block aspect-2/3 w-full overflow-hidden rounded-[14px] bg-surface-secondary bg-cover bg-center shadow-[0_16px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/12 ring-inset md:rounded-[20px]"
    >
      {view.posterUrl ? (
        <>
          <ArrivingArt />
          <Image
            src={view.posterUrl}
            alt=""
            fill
            unoptimized
            loading="eager"
            sizes="(min-width: 48rem) 240px, 120px"
            className="object-cover"
          />
        </>
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
    <div className="relative -mt-(--page-top) pb-2 md:-mx-(--page-gutter) md:pb-14">
      <HeroBackdrop url={view.backdropUrl} largeUrl={view.backdropLargeUrl} />
      <div className="relative flex flex-col gap-7 px-4 pt-55 md:gap-16 md:px-(--page-gutter) md:pt-[calc(var(--page-top)+1.5rem)]">
        <DetailsBreadcrumbs label={dict.details.breadcrumb.label} crumbs={crumbs} />
        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-x-4 gap-y-7 [grid-template-areas:'poster_title'_'actions_actions'] md:grid-cols-[240px_minmax(0,1fr)] md:gap-x-10 md:gap-y-5 md:[grid-template-areas:'poster_badge'_'poster_title'_'poster_actions']">
          <div className="[grid-area:poster] md:self-end">
            <Poster view={view} />
          </div>
          {view.watchingNow === undefined ? null : (
            <div {...DETAILS_REVEAL} className="hidden [grid-area:badge] md:block">
              <WatchingNowBadge
                label={watchingNowLabel(dict, locale, view.watchingNow, view.totalWatchers)}
              />
            </div>
          )}
          <div
            {...DETAILS_REVEAL}
            className="flex min-w-0 flex-col gap-2 pb-0.5 [grid-area:title] md:max-w-180 md:gap-2.5 md:pb-0"
          >
            <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance break-words [text-shadow:0_1px_16px_color-mix(in_oklab,var(--background)_60%,transparent)] md:text-[52px]">
              {view.title}
            </h1>
            <IdentityLine view={view} locale={locale} />
          </div>
          <div {...DETAILS_REVEAL} className="min-w-0 [grid-area:actions] md:max-w-180 md:pb-2">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
