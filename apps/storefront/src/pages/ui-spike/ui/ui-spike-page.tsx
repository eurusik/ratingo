import Link from 'next/link';
import { FEATURED_TITLE } from '../model/sample-titles';
import { DataSection } from './data-section';
import { FeedbackSection } from './feedback-section';
import { InputsSection } from './inputs-section';
import { OverlaysSection } from './overlays-section';
import { PageTransition } from './page-transition';
import { SpikePoster } from './spike-poster';

export function UiSpikePage() {
  return (
    <PageTransition>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[max(1.5rem,var(--safe-top))] pb-[max(2rem,var(--safe-bottom))]">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" translate="no">
            HeroUI v3 spike
          </h1>
          <p className="text-muted">Компоненти, теми й переходи для чекпойнта 1.</p>
        </header>

        <Link
          href="/spike/details"
          transitionTypes={['nav-forward']}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 no-underline text-foreground hover:bg-surface-secondary active:bg-surface-tertiary"
        >
          <SpikePoster title={FEATURED_TITLE.title} className="size-20 text-xs" />
          <span className="flex flex-col">
            <span className="font-semibold">View Transition</span>
            <span className="text-sm text-muted">Постер переходить у деталі</span>
          </span>
        </Link>

        <OverlaysSection />
        <InputsSection />
        <FeedbackSection />
        <DataSection />
      </main>
    </PageTransition>
  );
}
