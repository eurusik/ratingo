import { getDictionary, type Locale } from '@/shared/i18n';
import { formatDate, formatMoney } from '../model/details-format';
import type { MediaDetailsView } from '../model/details-view';

const FACTS_HEADING_ID = 'details-facts';

interface Fact {
  label: string;
  value?: string;
}

function factsOf(view: MediaDetailsView, locale: Locale): Fact[] {
  const dict = getDictionary(locale).details;
  const date = (iso?: string) => (iso ? formatDate(iso, locale) : undefined);
  const money = (amount?: number) =>
    amount === undefined ? undefined : formatMoney(amount, locale, dict);

  if (view.type === 'movie') {
    return [
      { label: dict.facts.status, value: view.status && dict.movieStatus[view.status] },
      { label: dict.facts.premiere, value: date(view.releaseDate) },
      { label: dict.facts.budget, value: money(view.budget) },
      { label: dict.facts.revenue, value: money(view.revenue) },
    ];
  }
  return [
    { label: dict.facts.premiere, value: date(view.releaseDate) },
    { label: dict.facts.lastEpisode, value: date(view.lastAirDate) },
  ];
}

export function FactsCard({ view, locale }: { view: MediaDetailsView; locale: Locale }) {
  const title = getDictionary(locale).details.facts.title;
  const facts = factsOf(view, locale).filter((fact): fact is Required<Fact> => Boolean(fact.value));

  if (facts.length === 0) return null;

  return (
    <section
      aria-labelledby={FACTS_HEADING_ID}
      className="flex flex-col gap-2.5 md:gap-1 md:rounded-3xl md:bg-surface md:px-4.5 md:py-2"
    >
      <h2
        id={FACTS_HEADING_ID}
        className="text-xl font-extrabold tracking-tight md:mt-2.5 md:text-lg"
      >
        {title}
      </h2>
      <dl className="rounded-3xl bg-surface px-3.5 py-1 md:rounded-none md:bg-transparent md:p-0">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex min-h-12 items-center gap-3 border-t border-separator first:border-t-0 md:min-h-11"
          >
            <dt className="flex-1 text-sm text-muted">{fact.label}</dt>
            <dd className="text-end text-sm font-semibold tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
