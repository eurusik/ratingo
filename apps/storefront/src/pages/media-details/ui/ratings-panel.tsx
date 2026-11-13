import { VerdictChip } from '@/entities/media';
import { useTranslation, type Dictionary } from '@/shared/i18n';
import type { MediaDetailsView } from '../model/details-view';
import { CommunityLine } from './community-line';
import { ExternalRatingChips } from './external-rating-chips';
import { ScoreExplainer } from './score-explainer';
import { ScoreRing } from './score-ring';

type VerdictMessages = Dictionary['details']['verdict'];

function verdictMessage(view: MediaDetailsView, messages: VerdictMessages): string | undefined {
  const key = view.verdictMessageKey;
  if (!key) return undefined;
  const byType: Record<string, string> = messages[view.type];
  return byType[key];
}

function VerdictBlock({ view }: { view: MediaDetailsView }) {
  const { dict } = useTranslation();
  const message = verdictMessage(view, dict.details.verdict);

  if (view.score === undefined || !view.verdict) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold text-muted">{dict.details.ratings.noScore}</p>
        <ScoreExplainer />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ScoreRing score={view.score} verdict={view.verdict} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <VerdictChip verdict={view.verdict} />
          <ScoreExplainer />
        </div>
        {message ? (
          <p className="text-lg leading-tight font-bold md:text-[19px]">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

export function RatingsPanel({ view }: { view: MediaDetailsView }) {
  const { dict } = useTranslation();
  const hasExternal = view.externalRatings.length > 0;

  return (
    <section aria-label={dict.details.ratings.label} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 pt-4.5 md:flex-row md:items-center md:gap-7 md:px-6 md:py-5.5">
        <div className="md:shrink-0 md:border-e md:border-separator md:pe-7">
          <VerdictBlock view={view} />
        </div>
        {hasExternal ? (
          <div className="flex min-w-0 flex-col gap-3.5 border-t border-separator pt-3.5 md:flex-1 md:border-t-0 md:pt-0">
            <ExternalRatingChips ratings={view.externalRatings} />
            <CommunityLine community={view.community} className="hidden md:flex" />
          </div>
        ) : (
          <CommunityLine community={view.community} className="hidden md:flex md:flex-1" />
        )}
      </div>
      <CommunityLine community={view.community} className="-mt-1 md:hidden" />
    </section>
  );
}
