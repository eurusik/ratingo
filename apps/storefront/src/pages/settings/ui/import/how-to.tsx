'use client';

import { interpolate, interpolateNodes, useTranslation } from '@/shared/i18n';
import type { ImportSource } from '@/pages/settings/model/import/import-sources';
import { CardDisclosure } from './card-disclosure';

export function HowTo({ source, isDesktop }: { source: ImportSource; isDesktop: boolean }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const guide = copy.sources[source];

  return (
    <CardDisclosure title={interpolate(copy.files.howTo, { source: guide.name })} isInitiallyOpen>
      <div className="flex flex-col gap-2.5">
        <p className="rounded-xl bg-default px-3 py-2.5 text-sm leading-snug md:bg-transparent md:p-0 md:text-[15px] md:text-muted">
          {isDesktop ? copy.files.websiteOnly : copy.files.computerOnly}
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm leading-snug text-muted md:text-[15px]">
          {guide.steps.map((step) => (
            <li key={step}>
              {interpolateNodes(step, {
                link: (
                  <a
                    href={guide.url}
                    target="_blank"
                    rel="noreferrer"
                    translate="no"
                    className="text-accent underline underline-offset-2"
                  >
                    {guide.urlLabel}
                    <span className="sr-only"> {copy.files.newTab}</span>
                  </a>
                ),
              })}
            </li>
          ))}
        </ol>
      </div>
    </CardDisclosure>
  );
}
