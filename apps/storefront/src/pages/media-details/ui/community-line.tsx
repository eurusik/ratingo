import { Avatar, AvatarGroup } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount, formatScore } from '@/shared/lib';
import type { Community } from '../model/details-view';

const SHOWN_RATERS = 3;

function initialOf(username: string): string {
  return Array.from(username.trim())[0]?.toUpperCase() ?? '?';
}

export function CommunityLine({
  community,
  className,
}: {
  community: Community;
  className?: string;
}) {
  const { dict, locale } = useTranslation();
  const raters = community.raters.slice(0, SHOWN_RATERS);
  const [firstRater] = raters;
  if (!firstRater && community.averageScore === undefined) return null;

  const othersCount = Math.max(community.ratingCount, community.raters.length) - 1;
  const ratedBy = firstRater
    ? interpolate(
        othersCount > 0 ? dict.details.community.ratedByMany : dict.details.community.ratedByOne,
        {
          name: firstRater.username,
          count: formatCompactCount(locale, othersCount),
        },
      )
    : undefined;
  const audience =
    community.averageScore === undefined
      ? undefined
      : interpolate(dict.details.community.audience, {
          score: formatScore(locale, community.averageScore),
        });

  return (
    <div
      className={`flex items-center gap-2.5 text-sm text-foreground/85 md:text-[15px] ${className ?? ''}`}
    >
      {raters.length > 0 ? (
        <AvatarGroup size="sm" aria-hidden className="shrink-0">
          {raters.map((rater) => (
            <Avatar key={rater.userId}>
              {rater.avatarUrl ? <Avatar.Image src={rater.avatarUrl} alt="" /> : null}
              <Avatar.Fallback>{initialOf(rater.username)}</Avatar.Fallback>
            </Avatar>
          ))}
        </AvatarGroup>
      ) : null}
      <p className="min-w-0">
        <span className="sr-only">{dict.details.community.label}: </span>
        {[ratedBy, audience].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}
