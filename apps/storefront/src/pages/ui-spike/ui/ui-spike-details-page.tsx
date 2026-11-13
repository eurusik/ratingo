import { BackLink } from '@/shared/ui';
import { FEATURED_TITLE, KIND_LABELS, formatRating } from '../model/sample-titles';
import { PageTransition } from './page-transition';
import { SpikePoster } from './spike-poster';

export function UiSpikeDetailsPage() {
  return (
    <PageTransition>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[max(1.5rem,var(--safe-top))] pb-[max(2rem,var(--safe-bottom))]">
        <BackLink
          fallbackHref="/spike"
          className="inline-flex min-h-tap items-center self-start text-accent"
        >
          ← Назад до spike
        </BackLink>
        <SpikePoster
          title={FEATURED_TITLE.title}
          className="aspect-[2/3] w-full max-w-xs text-2xl"
        />
        <h1 className="text-2xl font-bold">{FEATURED_TITLE.title}</h1>
        <p className="text-muted">
          {KIND_LABELS[FEATURED_TITLE.kind]}, {FEATURED_TITLE.year} ·{' '}
          {formatRating(FEATURED_TITLE.rating)}
        </p>
        <p>
          Системний свайп назад на iOS і Android має повертати на попередню сторінку без подвійної
          анімації.
        </p>
      </main>
    </PageTransition>
  );
}
