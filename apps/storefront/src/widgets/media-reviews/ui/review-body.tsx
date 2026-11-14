'use client';

import { useId, useState } from 'react';
import { Button } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useIsClamped } from '@/shared/lib';

const CHARS_THAT_USUALLY_OVERFLOW_CLAMP = 160;

function SpoilerCover({ text, onReveal }: { text: string; onReveal: () => void }) {
  const { dict } = useTranslation();

  return (
    <div className="relative min-h-19 overflow-hidden rounded-2xl bg-default">
      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-3 inset-y-2.5 line-clamp-3 text-[15px] leading-normal break-words blur-sm select-none"
      >
        {text}
      </p>
      <div className="relative flex min-h-19 items-center justify-center">
        <Button
          variant="tertiary"
          onPress={onReveal}
          className="min-h-tap rounded-full bg-background/85 px-4 font-bold"
        >
          <TriangleAlert aria-hidden className="size-4 text-warning" />
          {dict.reviews.card.spoiler}
        </Button>
      </div>
    </div>
  );
}

function ClampedText({ text }: { text: string }) {
  const { dict } = useTranslation();
  const textId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped<HTMLParagraphElement>(
    isExpanded,
    text.length >= CHARS_THAT_USUALLY_OVERFLOW_CLAMP,
  );

  return (
    <>
      <p
        ref={ref}
        id={textId}
        className={`text-[15px] leading-normal break-words whitespace-pre-line text-foreground/90 md:max-w-[72ch] ${isExpanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </p>
      {isClamped && !isExpanded ? (
        <Button
          variant="ghost"
          aria-expanded={false}
          aria-controls={textId}
          onPress={() => setIsExpanded(true)}
          className="-my-2 -ms-3 min-h-tap self-start px-3 text-sm font-semibold text-accent"
        >
          {dict.reviews.card.readMore}
        </Button>
      ) : null}
    </>
  );
}

export function ReviewBody({ text, hasSpoiler }: { text: string; hasSpoiler: boolean }) {
  const [isRevealed, setIsRevealed] = useState(!hasSpoiler);
  if (!isRevealed) return <SpoilerCover text={text} onReveal={() => setIsRevealed(true)} />;
  return <ClampedText text={text} />;
}
