'use client';

import { Button } from '@heroui/react';
import { Share } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useShareLink } from '@/shared/lib';
import { mediaRoute } from '@/shared/config';
import type { ActionMedia } from '../model/action-media';
import { HERO_GLASS_BUTTON } from './hero-glass';

interface ShareButtonProps {
  href: string;
  title: string;
  className?: string;
}

export function ShareButton({ href, title, className }: ShareButtonProps) {
  const { dict } = useTranslation();
  const share = useShareLink();

  return (
    <Button
      isIconOnly
      variant="secondary"
      aria-label={dict.details.share}
      onPress={() => void share({ href, title })}
      className={className}
    >
      <Share aria-hidden className="size-5" />
    </Button>
  );
}

export function DesktopShare({ media }: { media: ActionMedia }) {
  return (
    <ShareButton
      href={mediaRoute(media.type, media.slug)}
      title={media.title}
      className={`hidden size-13 rounded-full md:flex ${HERO_GLASS_BUTTON}`}
    />
  );
}
