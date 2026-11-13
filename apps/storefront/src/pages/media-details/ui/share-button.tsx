'use client';

import { Button } from '@heroui/react';
import { Share } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { useShareLink } from '@/shared/lib';

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
