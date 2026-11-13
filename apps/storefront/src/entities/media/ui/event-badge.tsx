import { Chip } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import type { MediaEvent } from '../model/media';

export function EventBadge({ event }: { event: MediaEvent }) {
  const { dict } = useTranslation();

  return (
    <Chip size="sm" variant="soft" color="accent" className="shrink-0 font-extrabold">
      {dict.media.badge[event]}
    </Chip>
  );
}
