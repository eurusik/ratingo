import { Suspense } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AllReviewsSection, ReviewsBoardSkeleton, parseReviewSort } from '@/widgets/media-reviews';
import type { MediaType } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { getDictionary, interpolate, type Locale } from '@/shared/i18n';
import { BackLink } from '@/shared/ui';
import { loadReviewsSubject } from '../api/load-reviews-subject';
import { ReviewsTopBar } from './reviews-top-bar';

interface MediaReviewsPageProps {
  type: MediaType;
  slug: string;
  sort?: string;
  locale: Locale;
}

export async function MediaReviewsPage({ type, slug, sort, locale }: MediaReviewsPageProps) {
  const { media, community } = await loadReviewsSubject(type, slug);
  const dict = getDictionary(locale).reviews;
  const titleHref = mediaRoute(type, media.slug);

  return (
    <article className="flex flex-col gap-3 pb-10 md:gap-4">
      <ReviewsTopBar title={media.title} backHref={titleHref} />
      <BackLink
        fallbackHref={titleHref}
        aria-label={interpolate(dict.backToTitle, { title: media.title })}
        className="-ms-1 hidden min-h-tap items-center gap-1 self-start text-[15px] font-semibold text-muted no-underline hover:text-foreground md:inline-flex"
      >
        <ChevronLeft aria-hidden className="size-5" />
        {media.title}
      </BackLink>
      <div className="px-4 md:px-0">
        <Suspense
          fallback={<ReviewsBoardSkeleton label={getDictionary(locale).common.loading} withSort />}
        >
          <AllReviewsSection media={media} community={community} sort={parseReviewSort(sort)} />
        </Suspense>
      </div>
    </article>
  );
}
