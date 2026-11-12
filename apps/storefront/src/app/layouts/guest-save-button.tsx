'use client';

import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import type { SearchTitle } from '@/features/search';
import { openAuth } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';

export function GuestSaveButton({ title }: { title: SearchTitle }) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated || !title.isInCatalog) return null;

  return (
    <Button
      isIconOnly
      variant="tertiary"
      className="size-11 shrink-0 rounded-full"
      aria-label={interpolate(dict.search.save, { title: title.title })}
      onPress={() => openAuth({ intent: { kind: 'save', title: title.title } })}
    >
      <Plus aria-hidden className="size-5" />
    </Button>
  );
}
