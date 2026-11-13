import { VerdictChip } from '@/entities/media';
import { getDictionary, type Dictionary, type Locale } from '@/shared/i18n';
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

function VerdictBlock({ view, dict }: { view: MediaDetailsView; dict: Dictionary }) {
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

export function RatingsPanel({ view, locale }: { view: MediaDetailsView; locale: Locale }) {
  const dict = getDictionary(locale);
  const hasExternal = view.externalRatings.length > 0;

  return (
    <section
      aria-label={dict.details.ratings.label}
      className="grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-x-7 md:gap-y-3.5 md:rounded-3xl md:bg-surface md:px-6 md:py-5.5"
    >
      <div
        className={`bg-surface px-4 pt-4.5 pb-4 md:row-span-2 md:rounded-none md:border-e md:border-separator md:bg-transparent md:p-0 md:pe-7 ${hasExternal ? 'rounded-t-3xl' : 'rounded-3xl'}`}
      >
        <VerdictBlock view={view} dict={dict} />
      </div>
      {hasExternal ? (
        <div className="rounded-b-3xl bg-surface px-4 pb-4 md:rounded-none md:bg-transparent md:p-0">
          <div className="border-t border-separator pt-3.5 md:border-t-0 md:pt-0">
            <ExternalRatingChips ratings={view.externalRatings} locale={locale} />
          </div>
        </div>
      ) : null}
      <div className="mt-3 md:col-start-2 md:mt-0">
        <CommunityLine community={view.community} />
      </div>
    </section>
  );
}
