'use client';

import { useTranslation, type Dictionary } from '@/shared/i18n';
import { useRefreshRetry } from '@/shared/lib';
import { SectionError, SectionHeader } from '@/shared/ui';

export type HomeSection = 'picks' | 'topTen' | 'newEpisodes' | 'newReleases';

type HomeCopy = Dictionary['home'];

interface FailedSectionLayout {
  title: (home: HomeCopy) => string;
  caption?: (home: HomeCopy) => string;
  skeletonHeight: string;
}

const FAILED_SECTIONS: Record<HomeSection, FailedSectionLayout> = {
  picks: { title: (home) => home.picks, skeletonHeight: 'min-h-94 md:min-h-30' },
  topTen: {
    title: (home) => home.topTen,
    caption: (home) => home.topTenCaption,
    skeletonHeight: 'min-h-55 md:min-h-65',
  },
  newEpisodes: {
    title: (home) => home.newEpisodes,
    caption: (home) => home.newEpisodesCaption,
    skeletonHeight: 'min-h-55 md:min-h-65',
  },
  newReleases: {
    title: (home) => home.newReleases,
    caption: (home) => home.newReleasesCaption,
    skeletonHeight: 'min-h-85',
  },
};

export function HomeSectionError({ section }: { section: HomeSection }) {
  const { dict } = useTranslation();
  const { retry, isRetrying } = useRefreshRetry();
  const layout = FAILED_SECTIONS[section];
  const headingId = `${section}-failed`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <SectionHeader
        id={headingId}
        title={layout.title(dict.home)}
        caption={layout.caption?.(dict.home)}
      />
      <div className="px-4 md:px-0">
        <SectionError
          title={dict.home.failed[section]}
          onRetry={retry}
          isRetrying={isRetrying}
          className={layout.skeletonHeight}
        />
      </div>
    </section>
  );
}
