'use client';

import { Spinner } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';

export function AuthDialogLoading() {
  const { dict } = useTranslation();

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+1.5rem)] z-50 flex justify-center px-4 md:bottom-6"
    >
      <span className="flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-2 text-sm font-medium shadow-overlay backdrop-blur-xl motion-safe:animate-rise-in">
        <Spinner size="sm" aria-hidden />
        {dict.auth.opening}
      </span>
    </div>
  );
}
