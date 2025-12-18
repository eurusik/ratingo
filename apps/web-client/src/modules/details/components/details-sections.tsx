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
    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
      {children}
    </h2>
  );
}

// ============================================
// Suitable For Tags
// ============================================

interface SuitableForTagsProps {
  tags: string[];
  label: string;
}

export function SuitableForTags({ tags, label }: SuitableForTagsProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">
        {label}:
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50"
        >
          {tag}
        </span>
      ))}
    </section>
  );
}

// ============================================
// Overview Section
// ============================================

interface OverviewSectionProps {
  title: string;
  overview?: string | null;
}

export function OverviewSection({ title, overview }: OverviewSectionProps) {
  if (!overview) return null;

  return (
    <section id="overview-section" className="space-y-2 scroll-mt-8">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-base md:text-lg text-zinc-300 leading-relaxed">
        {overview}
      </p>
    </section>
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
          primaryTrailer={videos.find(v => v.key === primaryTrailerKey)}
        />
      </section>
      <Separator className="my-12 bg-zinc-800/50" />
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
        {hasCast && (
          <CastCarousel cast={cast} crew={crew || []} />
        )}
        {hasCrew && (
          <CrewCarousel crew={crew} />
        )}
      </div>
      <Separator className="my-12 bg-zinc-800/50" />
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
    <div className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {children}
      </div>
    </div>
  );
}
