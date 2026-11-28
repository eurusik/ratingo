'use client';

import { Button } from '@heroui/react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

export function RowHint({ onDismiss }: { onDismiss: () => void }) {
  const { dict } = useTranslation();
  const hint = dict.episodes.detail.hint;

  return (
    <div
      role="status"
      className="mb-2 flex min-h-14 items-center gap-2.5 rounded-2xl bg-surface-tertiary ps-3.5 pe-1.5 text-surface-tertiary-foreground shadow-overlay"
    >
      <Info aria-hidden className="size-5 shrink-0 text-muted" />
      <p className="flex-1 py-2 text-sm leading-snug">
        <span className="pointer-fine:hidden">{hint.touch}</span>
        <span className="hidden pointer-fine:inline">{hint.pointer}</span>
      </p>
      <Button
        variant="ghost"
        onPress={onDismiss}
        className="min-h-tap shrink-0 rounded-full px-3 font-bold text-accent"
      >
        {hint.dismiss}
      </Button>
    </div>
  );
}
