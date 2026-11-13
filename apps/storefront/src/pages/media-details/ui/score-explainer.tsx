'use client';

import { Button, Popover } from '@heroui/react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

export function ScoreExplainer() {
  const { dict } = useTranslation();

  return (
    <Popover>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        aria-label={dict.details.ratings.howItWorks}
        className="size-7 min-w-7 rounded-full text-muted"
      >
        <Info aria-hidden className="size-4" />
      </Button>
      <Popover.Content placement="bottom" className="max-w-80">
        <Popover.Dialog className="flex flex-col gap-2">
          <Popover.Heading className="text-base font-bold">
            {dict.details.ratings.explainTitle}
          </Popover.Heading>
          <p className="text-sm text-muted">{dict.details.ratings.explain}</p>
          <p className="text-sm text-muted">{dict.details.ratings.explainVerdict}</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
