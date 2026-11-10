/**
 * Shared section components for details pages.
 * Reduces duplication between movies and shows pages.
 */

import type { ReactNode } from 'react';
import type { getDictionary } from '@/shared/i18n';
import { Separator } from '@/shared/ui';
import { TrailersCarousel } from './trailers-carousel';
import { CastCarousel, CrewCarousel } from './cast-carousel';
import { ProvidersList } from './providers-list';
import type { Video, CastMember, CrewMember } from '../types';
import type { components } from '@ratingo/api-contract';

type Availability = components['schemas']['AvailabilityDto'];

interface SectionTitleProps {
  children: ReactNode;
}

function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h2 className="text-sm font-semibold text-cinema-text-muted uppercase tracking-wider">{children}</h2>
  );
}

// ============================================
// Trailers Section
// ============================================

interface TrailersSectionProps {
  title: string;
  videos?: Video[] | null;
  primaryTrailerKey?: string;
}

export function TrailersSection({ title, videos, primaryTrailerKey }: TrailersSectionProps) {
  if (!videos || videos.length === 0) return null;

  return (
    <>
      <section className="space-y-4">
        <SectionTitle>{title}</SectionTitle>
        <TrailersCarousel
          videos={videos}
          primaryTrailer={videos.find((v) => v.key === primaryTrailerKey)}
        />
      </section>
      <Separator className="my-12 bg-cinema-elevated/50" />
    </>
  );
}

// ============================================
// Cast & Crew Section
// ============================================

interface CastCrewSectionProps {
  cast?: CastMember[] | null;
  crew?: CrewMember[] | null;
}

export function CastCrewSection({ cast, crew }: CastCrewSectionProps) {
  const hasCast = cast && cast.length > 0;
  const hasCrew = crew && crew.length > 0;

  if (!hasCast && !hasCrew) return null;

  return (
    <>
      <div className="space-y-8">
        {hasCast && <CastCarousel cast={cast} />}
        {hasCrew && <CrewCarousel crew={crew} />}
      </div>
      <Separator className="my-12 bg-cinema-elevated/50" />
    </>
  );
}

// ============================================
// Providers Section
// ============================================

interface ProvidersSectionProps {
  title: string;
  availability?: Availability | null;
  dict: ReturnType<typeof getDictionary>;
}

export function ProvidersSection({ title, availability, dict }: ProvidersSectionProps) {
  if (!availability) return null;

  return (
    <section className="space-y-4">
      <SectionTitle>{title}</SectionTitle>
      <ProvidersList providers={availability} dict={dict} />
    </section>
  );
}

// ============================================
// Details Content Wrapper
// ============================================

interface DetailsContentProps {
  children: ReactNode;
}

export function DetailsContent({ children }: DetailsContentProps) {
  return (
    <div className="bg-cinema-page">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">{children}</div>
    </div>
  );
}
