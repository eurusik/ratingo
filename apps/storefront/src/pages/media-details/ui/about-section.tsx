'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { DetailsSection } from './details-section';

const OVERVIEW_ID = 'details-overview';

function useIsClamped(isExpanded: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || isExpanded) return;
    const measure = () => setIsClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isExpanded]);

  return { ref, isClamped };
}

export function AboutSection({ type, overview }: { type: MediaType; overview: string }) {
  const { dict } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped(isExpanded);

  return (
    <DetailsSection id="details-about" title={dict.details.about[type]}>
      <p
        ref={ref}
        id={OVERVIEW_ID}
        className={`text-[15px] leading-relaxed text-foreground/85 md:text-base ${isExpanded ? '' : 'line-clamp-4 md:line-clamp-none'}`}
      >
        {overview}
      </p>
      {isClamped || isExpanded ? (
        <Button
          variant="ghost"
          aria-expanded={isExpanded}
          aria-controls={OVERVIEW_ID}
          onPress={() => setIsExpanded((expanded) => !expanded)}
          className="-my-2 -ms-3 min-h-11 self-start px-3 text-[15px] font-semibold text-accent md:hidden"
        >
          {isExpanded ? dict.details.about.less : dict.details.about.more}
        </Button>
      ) : null}
    </DetailsSection>
  );
}
