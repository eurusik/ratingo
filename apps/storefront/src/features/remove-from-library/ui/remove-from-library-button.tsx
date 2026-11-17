'use client';

import { Button } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useMediaState } from '@/entities/library';
import { useTranslation } from '@/shared/i18n';
import { useRemoveFromLibrary, type RemovableMedia } from '../model/remove-from-library';

export function RemoveFromLibraryButton({ media }: { media: RemovableMedia }) {
  const { dict } = useTranslation();
  const { mediaState } = useMediaState(media.mediaItemId);
  const remove = useRemoveFromLibrary();

  if (!mediaState) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => remove(media)}
      className="-ms-2 min-h-tap gap-1.5 self-start px-2 text-sm font-semibold text-muted"
    >
      <Trash2 aria-hidden className="size-4" />
      {dict.library.remove}
    </Button>
  );
}
