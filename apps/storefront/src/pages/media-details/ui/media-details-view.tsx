import { HOME_ROUTE, mediaRoute } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { hasCredits } from '../model/credits';
import { watchingNowLabel } from '../model/details-format';
import type { MediaDetailsView as View } from '../model/details-view';
import { DETAILS_REVEAL } from '../model/details-reveal';
import { AboutSection } from './about-section';
import { CastSection } from './cast-section';
import { DetailsHero } from './details-hero';
import { DetailsTopBar } from './details-top-bar';
import { FactsCard } from './facts-card';
import { HeroActions, type ActionMedia } from './hero-actions';
import { RatingsPanel } from './ratings-panel';
import { RevealAfterSkeleton } from './reveal-after-skeleton';
import { TrailersSection } from './trailers-section';

function actionMediaOf(view: View): ActionMedia {
  const { mediaItemId, type, slug, title } = view;
  if (view.type === 'movie') return { mediaItemId, type, slug, title };
  return {
    mediaItemId,
    type,
    slug,
    title,
    seasonCount: view.seasonCount,
    episodeCount: view.episodeCount,
  };
}

export function MediaDetailsView({ view, locale }: { view: View; locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <article className="flex flex-col gap-7 pb-10 md:gap-10">
      <RevealAfterSkeleton />
      <DetailsTopBar
        title={view.title}
        shareHref={mediaRoute(view.type, view.slug)}
        backHref={HOME_ROUTE}
        watchingLabel={
          view.watchingNow === undefined
            ? undefined
            : watchingNowLabel(dict, locale, view.watchingNow)
        }
      />
      <DetailsHero
        view={view}
        locale={locale}
        actions={<HeroActions media={actionMediaOf(view)} />}
      />
      <div
        {...DETAILS_REVEAL}
        className="relative flex flex-col gap-7 px-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-x-12 md:gap-y-12 md:px-0"
      >
        <div className="md:col-span-2">
          <RatingsPanel view={view} locale={locale} />
        </div>
        <div className="flex min-w-0 flex-col gap-7 md:gap-11">
          {view.overview ? <AboutSection type={view.type} overview={view.overview} /> : null}
          {view.trailers.length > 0 ? <TrailersSection trailers={view.trailers} /> : null}
          {hasCredits(view.credits) ? (
            <CastSection type={view.type} credits={view.credits} locale={locale} />
          ) : null}
        </div>
        <aside className="md:self-start">
          <FactsCard view={view} locale={locale} />
        </aside>
      </div>
    </article>
  );
}
