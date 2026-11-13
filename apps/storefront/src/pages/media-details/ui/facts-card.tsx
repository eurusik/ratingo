import { useId } from 'react';
import { useTranslation } from '@/shared/i18n';
import { formatDate, formatMoney } from '../model/details-format';
import type { MediaDetailsView } from '../model/details-view';

interface Fact {
  label: string;
  value?: string;
}

function useFacts(view: MediaDetailsView): Fact[] {
  const { dict, locale } = useTranslation();
  const facts = dict.details.facts;
  const date = (iso?: string) => (iso ? formatDate(iso, locale) : undefined);

  if (view.type === 'movie') {
    return [
      { label: facts.status, value: view.status && dict.details.movieStatus[view.status] },
      { label: facts.premiere, value: date(view.releaseDate) },
      {
        label: facts.budget,
        value:
          view.budget === undefined ? undefined : formatMoney(view.budget, locale, dict.details),
      },
      {
        label: facts.revenue,
        value:
          view.revenue === undefined ? undefined : formatMoney(view.revenue, locale, dict.details),
      },
    ];
  }
  return [
    { label: facts.premiere, value: date(view.releaseDate) },
    { label: facts.lastEpisode, value: date(view.lastAirDate) },
  ];
}

export function FactsCard({ view }: { view: MediaDetailsView }) {
  const { dict } = useTranslation();
  const headingId = useId();
  const facts = useFacts(view).filter((fact): fact is Required<Fact> => Boolean(fact.value));

  if (facts.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2.5 md:gap-1 md:rounded-[20px] md:bg-surface md:px-4.5 md:py-2"
    >
      <h2 id={headingId} className="text-xl font-extrabold tracking-tight md:mt-2.5 md:text-lg">
        {dict.details.facts.title}
      </h2>
      <dl className="rounded-[20px] bg-surface px-3.5 py-1 md:rounded-none md:bg-transparent md:p-0">
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
