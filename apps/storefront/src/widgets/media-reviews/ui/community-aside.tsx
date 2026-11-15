'use client';

import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount, formatScore } from '@/shared/lib';
import type { CommunityScore } from '../model/reviewed-media';

const ASIDE_HEADING_ID = 'reviews-community';

interface CommunityAsideProps {
  community: CommunityScore;
  headingLevel: 'h2' | 'h3';
}

export function CommunityAside({ community, headingLevel }: CommunityAsideProps) {
  const Heading = headingLevel;
  const { dict, locale } = useTranslation();
  const copy = dict.reviews.community;

  return (
    <aside
      aria-labelledby={ASIDE_HEADING_ID}
      className="hidden flex-col gap-2 self-start rounded-3xl bg-surface p-4.5 md:flex"
    >
      <Heading id={ASIDE_HEADING_ID} className="text-base font-extrabold">
        {copy.title}
      </Heading>
      {community.averageScore === undefined ? (
        <p className="text-sm text-muted">{copy.none}</p>
      ) : (
        <p className="text-4xl font-extrabold tabular-nums">
          {formatScore(locale, community.averageScore)}{' '}
          <span className="text-sm font-semibold text-muted">
            ·{' '}
            {interpolate(pluralize(community.ratingCount, copy.count, locale), {
              count: formatCompactCount(locale, community.ratingCount),
            })}
          </span>
        </p>
      )}
    </aside>
  );
}
