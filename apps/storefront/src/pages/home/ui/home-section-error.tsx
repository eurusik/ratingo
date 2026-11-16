'use client';

import { useTranslation, type Dictionary } from '@/shared/i18n';
import { useRefreshRetry } from '@/shared/lib';
import { SectionError, SectionHeader } from '@/shared/ui';

export type HomeSection = 'picks' | 'topTen' | 'newEpisodes' | 'newReleases';

interface FailedSectionCopy {
  title: string;
  caption?: string;
}

function sectionCopy(section: HomeSection, home: Dictionary['home']): FailedSectionCopy {
  const copies: Record<HomeSection, FailedSectionCopy> = {
    picks: { title: home.picks },
    topTen: { title: home.topTen, caption: home.topTenCaption },
    newEpisodes: { title: home.newEpisodes, caption: home.newEpisodesCaption },
    newReleases: { title: home.newReleases, caption: home.newReleasesCaption },
  };
  return copies[section];
}

const SKELETON_HEIGHTS: Record<HomeSection, string> = {
  picks: 'min-h-94 md:min-h-30',
  topTen: 'min-h-55 md:min-h-65',
  newEpisodes: 'min-h-55 md:min-h-65',
  newReleases: 'min-h-85',
};

export function HomeSectionError({ section }: { section: HomeSection }) {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRefreshRetry();
  const copy = sectionCopy(section, dict.home);
  const headingId = `${section}-failed`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <SectionHeader id={headingId} title={copy.title} caption={copy.caption} />
      <div className="px-4 md:px-0">
        <SectionError
          title={dict.home.failed[section]}
          onRetry={retry}
          isRetrying={isRetrying}
          className={SKELETON_HEIGHTS[section]}
        />
      </div>
    </section>
  );
}
