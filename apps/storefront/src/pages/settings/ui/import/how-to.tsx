'use client';

import { Disclosure } from '@heroui/react';
import { interpolate, interpolateNodes, useTranslation } from '@/shared/i18n';
import type { ImportSource } from '@/pages/settings/model/import/import-sources';

export function HowTo({ source, isDesktop }: { source: ImportSource; isDesktop: boolean }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const guide = copy.sources[source];

  return (
    <Disclosure
      defaultExpanded
      className="rounded-[20px] bg-surface px-4 py-1 md:px-5 [&_.disclosure\_\_body]:p-0"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex min-h-12 w-full items-center justify-between gap-3 text-start text-[15px] font-bold md:min-h-13 md:text-base">
          {interpolate(copy.files.howTo, { source: guide.name })}
          <Disclosure.Indicator className="text-muted" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-2.5 pb-3.5 md:pb-4">
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
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
