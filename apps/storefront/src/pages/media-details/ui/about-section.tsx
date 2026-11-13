'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';

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
  const headingId = useId();
  const textId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped(isExpanded);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5 md:gap-3">
      <h2 id={headingId} className="text-xl font-extrabold tracking-tight md:text-2xl">
        {dict.details.about[type]}
      </h2>
      <p
        ref={ref}
        id={textId}
        className={`text-[15px] leading-relaxed text-foreground/85 md:text-base ${isExpanded ? '' : 'line-clamp-4 md:line-clamp-none'}`}
      >
        {overview}
      </p>
      {isClamped || isExpanded ? (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isExpanded}
          aria-controls={textId}
          onPress={() => setIsExpanded((expanded) => !expanded)}
          className="-ms-2 self-start text-[15px] font-semibold text-accent md:hidden"
        >
          {isExpanded ? dict.details.about.less : dict.details.about.more}
        </Button>
      ) : null}
    </section>
  );
}
