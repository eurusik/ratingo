'use client';

import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

export function PickBanner({ onCancel }: { onCancel: () => void }) {
  const { dict } = useTranslation();

  return (
    <div className="sticky top-0 z-20 h-0">
      <div className="absolute inset-x-0 top-0 flex min-h-14 items-center gap-2.5 rounded-2xl bg-accent px-4 py-2 text-accent-foreground shadow-overlay">
        <span role="status" className="flex-1 text-[15px] font-bold">
          {dict.episodes.pick.banner}
        </span>
        <Button
          size="sm"
          onPress={onCancel}
          className="min-h-tap rounded-full bg-white/20 font-bold text-accent-foreground"
        >
          {dict.episodes.pick.cancel}
        </Button>
      </div>
    </div>
  );
}
