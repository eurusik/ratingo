'use client';

import type { ReactNode } from 'react';
import { Disclosure } from '@heroui/react';

interface CardDisclosureProps {
  title: string;
  isInitiallyOpen: boolean;
  children: ReactNode;
}

export function CardDisclosure({ title, isInitiallyOpen, children }: CardDisclosureProps) {
  return (
    <Disclosure
      defaultExpanded={isInitiallyOpen}
      className="rounded-[20px] bg-surface px-4 py-1 md:px-5 [&_.disclosure\_\_body]:p-0"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex min-h-12 w-full items-center justify-between gap-3 text-start text-[15px] font-bold md:min-h-13 md:text-base">
          {title}
          <Disclosure.Indicator className="text-muted" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="pb-3.5 md:pb-4">{children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
