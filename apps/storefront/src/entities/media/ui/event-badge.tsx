import { Chip } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import type { EventBadge as EventBadgeKey } from '../model/media';

export function EventBadge({ event }: { event: EventBadgeKey }) {
  const { dict } = useTranslation();

  return (
    <Chip size="sm" variant="soft" color="accent" className="shrink-0 font-extrabold">
      {dict.media.badge[event]}
    </Chip>
  );
}
