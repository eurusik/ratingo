/**
 * Shared layout for movie/show details pages.
 * Provides consistent structure: hero, content sections.
 * Uses global header with context injection.
 */

'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Share2 } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { Separator } from '@/shared/ui';
import { useHeaderContext } from '@/shared/components';
import { DetailsHero, type DetailsHeroProps } from './details-hero';
import { TrailersCarousel } from './trailers-carousel';
import { CastCarousel, CrewCarousel } from './cast-carousel';
import { ProvidersList } from './providers-list';
import type { Video, CastMember, CrewMember } from '../types';

type Availability = components['schemas']['AvailabilityDto'];

export interface DetailsLayoutProps {
  /** Hero section props */
  hero: DetailsHeroProps;
  /** Overview text */
  overview?: string | null;
  /** Suitable for tags (genres) */
  suitableFor?: string[];
  /** Verdict section (rendered by parent) */
  verdictSlot?: ReactNode;
  /** Videos for trailers carousel */
  videos?: Video[] | null;
  /** Primary trailer key */
  primaryTrailerKey?: string;
  /** Type-specific section (MovieRelease or ShowStatus) */
  typeSpecificSlot?: ReactNode;
  /** Cast members */
  cast?: CastMember[] | null;
  /** Crew members */
  crew?: CrewMember[] | null;
  /** Streaming providers */
  availability?: Availability | null;
  /** Dictionary for i18n */
  dict: ReturnType<typeof getDictionary>;
  /** Breadcrumb text for header context (e.g., "Серіал • У тренді") */
  breadcrumb?: string;
}

export function DetailsLayout({
  hero,
  overview,
  suitableFor,
  verdictSlot,
  videos,
  primaryTrailerKey,
  typeSpecificSlot,
  cast,
  crew,
  availability,
  dict,
  breadcrumb,
}: DetailsLayoutProps) {
  const hasCast = cast && cast.length > 0;
  const hasCrew = crew && crew.length > 0;
  const hasVideos = videos && videos.length > 0;
  const { setContext, clearContext } = useHeaderContext();

  // Set header context on mount, clear on unmount
  useEffect(() => {
    if (breadcrumb) {
      setContext({ breadcrumb, backUrl: '/' });
    }
    return () => clearContext();
  }, [breadcrumb, setContext, clearContext]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <DetailsHero {...hero} />

      {/* Share button (floating) */}
      <button
        className="fixed top-20 right-4 z-30 p-3 rounded-full bg-cinema-elevated/80 backdrop-blur text-cinema-text-muted hover:text-white hover:bg-cinema-border/80 transition-all"
        aria-label="Share"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="bg-cinema-page">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Suitable for tags */}
          {suitableFor && suitableFor.length > 0 && (
            <section className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-cinema-text-muted uppercase tracking-wider">
                {dict.details.quickPitch.suitable}:
              </span>
              {suitableFor.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium text-cinema-text-secondary bg-cinema-elevated/60 rounded-full border border-cinema-border/50"
                >
                  {tag}
                </span>
              ))}
            </section>
          )}

          {/* Verdict (custom per type) */}
          {verdictSlot}

          {/* Overview */}
          {overview && (
            <section id="overview-section" className="space-y-2 scroll-mt-8">
              <h3 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">
                {dict.details.overview.title}
              </h3>
              <p className="text-base md:text-lg text-cinema-text-secondary leading-relaxed">{overview}</p>
            </section>
          )}

          <Separator className="my-12 bg-cinema-elevated/50" />

          {/* Trailers */}
          {hasVideos && (
            <>
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">
                  {dict.details.trailer.sectionTitle}
                </h2>
                <TrailersCarousel
                  videos={videos}
                  primaryTrailer={videos.find((v) => v.key === primaryTrailerKey)}
                />
              </section>
              <Separator className="my-12 bg-cinema-elevated/50" />
            </>
          )}

          {/* Type-specific section (MovieRelease or ShowStatus) */}
          {typeSpecificSlot && (
            <>
              {typeSpecificSlot}
              <Separator className="my-12 bg-cinema-elevated/50" />
            </>
          )}

          {/* Cast & Crew */}
          {(hasCast || hasCrew) && (
            <>
              <div className="space-y-8">
                {hasCast && <CastCarousel cast={cast} crew={crew || []} />}
                {hasCrew && <CrewCarousel crew={crew} />}
              </div>
              <Separator className="my-12 bg-cinema-elevated/50" />
            </>
          )}

          {/* Where to watch */}
          {availability && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">
                {dict.details.providers.title}
              </h2>
              <ProvidersList providers={availability} dict={dict} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
