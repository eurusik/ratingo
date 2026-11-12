'use client';

import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import type { SearchTitle } from '@/features/search';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';

interface GuestSaveButtonProps {
  title: SearchTitle;
  onSave: (title: SearchTitle) => void;
}

export function GuestSaveButton({ title, onSave }: GuestSaveButtonProps) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const runSignedIn = useSignedInAction();

  if (isAuthenticated || !title.isInCatalog) return null;

  return (
    <Button
      isIconOnly
      variant="tertiary"
      className="size-11 shrink-0 rounded-full"
      aria-label={interpolate(dict.search.save, { title: title.title })}
      onPress={() => runSignedIn(() => onSave(title), { kind: 'save', title: title.title })}
    >
      <Plus aria-hidden className="size-5" />
    </Button>
  );
}
