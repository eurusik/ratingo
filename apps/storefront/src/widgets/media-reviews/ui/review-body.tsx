'use client';

import { useEffect, useId, useState } from 'react';
import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { useIsClamped } from '@/shared/lib';
import { SpoilerCover } from '@/shared/ui';

const CHARS_THAT_USUALLY_OVERFLOW_CLAMP = 160;

function ClampedText({ text, takesFocus }: { text: string; takesFocus: boolean }) {
  const { dict } = useTranslation();
  const textId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped<HTMLParagraphElement>(
    isExpanded,
    text.length >= CHARS_THAT_USUALLY_OVERFLOW_CLAMP,
  );

  useEffect(() => {
    if (takesFocus) ref.current?.focus({ preventScroll: true });
  }, [takesFocus, ref]);

  return (
    <>
      <p
        ref={ref}
        id={textId}
        tabIndex={-1}
        className={`text-[15px] outline-none leading-normal break-words whitespace-pre-line text-foreground/90 md:max-w-[72ch] ${isExpanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </p>
      {isClamped && !isExpanded ? (
        <Button
          variant="ghost"
          aria-expanded={false}
          aria-controls={textId}
          onPress={() => {
            setIsExpanded(true);
            ref.current?.focus({ preventScroll: true });
          }}
          className="-my-2 -ms-3 min-h-tap self-start px-3 text-sm font-semibold text-accent"
        >
          {dict.reviews.card.readMore}
        </Button>
      ) : null}
    </>
  );
}

export function ReviewBody({ text, hasSpoiler }: { text: string; hasSpoiler: boolean }) {
  const { dict } = useTranslation();
  const [isRevealed, setIsRevealed] = useState(!hasSpoiler);
  if (!isRevealed) {
    return (
      <SpoilerCover
        text={text}
        revealLabel={dict.reviews.card.spoiler}
        onReveal={() => setIsRevealed(true)}
      />
    );
  }
  return <ClampedText text={text} takesFocus={hasSpoiler} />;
}
