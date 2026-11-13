import { CardGlow, VerdictChip } from '@/entities/media';
import { getDictionary, type Dictionary, type Locale } from '@/shared/i18n';
import type { MediaDetailsView } from '../model/details-view';
import { CommunityLine } from './community-line';
import { ExternalRatingChips } from './external-rating-chips';
import { ScoreExplainer } from './score-explainer';
import { ScoreRing } from './score-ring';

type VerdictMessages = Dictionary['details']['verdict'];

function isMessageKey<T extends object>(messages: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(messages, key);
}

function verdictMessage(view: MediaDetailsView, messages: VerdictMessages): string | undefined {
  const key = view.verdictMessageKey;
  if (!key) return undefined;
  const byType = messages[view.type];
  return isMessageKey(byType, key) ? byType[key] : undefined;
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

const RATINGS_HEADING_ID = 'details-ratings';

const PANEL_ROWS = {
  withExternal: {
    glow: 'row-end-3 md:row-end-3',
    verdict: 'md:row-end-3',
    community: 'md:row-start-2',
  },
  withoutExternal: {
    glow: 'row-end-2 md:row-end-2',
    verdict: 'md:row-end-2',
    community: 'md:row-start-1',
  },
} as const;

export function RatingsPanel({ view, locale }: { view: MediaDetailsView; locale: Locale }) {
  const dict = getDictionary(locale);
  const hasExternal = view.externalRatings.length > 0;
  const rows = PANEL_ROWS[hasExternal ? 'withExternal' : 'withoutExternal'];

  return (
    <section
      aria-labelledby={RATINGS_HEADING_ID}
      className="grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-x-7 md:gap-y-3.5 md:px-6 md:py-5.5"
    >
      <h2 id={RATINGS_HEADING_ID} className="sr-only">
        {dict.details.ratings.label}
      </h2>
      <div
        aria-hidden
        className={`relative isolate col-start-1 row-start-1 self-stretch overflow-hidden rounded-3xl bg-surface md:col-end-3 md:-mx-6 md:-my-5.5 ${rows.glow}`}
      >
        <CardGlow imageUrl={view.posterPlaceholderUrl} />
      </div>
      <div
        className={`relative col-start-1 row-start-1 px-4 pt-4.5 pb-4 md:border-e md:border-separator md:p-0 md:pe-7 ${rows.verdict}`}
      >
        <VerdictBlock view={view} dict={dict} />
      </div>
      {hasExternal ? (
        <div className="relative col-start-1 row-start-2 px-4 pb-4 md:col-start-2 md:row-start-1 md:p-0">
          <div className="border-t border-separator pt-3.5 md:border-t-0 md:pt-0">
            <ExternalRatingChips ratings={view.externalRatings} locale={locale} />
          </div>
        </div>
      ) : null}
      <div className={`relative mt-3 md:col-start-2 md:mt-0 ${rows.community}`}>
        <CommunityLine community={view.community} />
      </div>
    </section>
  );
}
