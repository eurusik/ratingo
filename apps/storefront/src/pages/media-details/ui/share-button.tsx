'use client';

import { Button, toast } from '@heroui/react';
import { Share } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { shareLink, useBrowserOrigin } from '@/shared/lib';

interface ShareButtonProps {
  href: string;
  title: string;
  className?: string;
}

export function ShareButton({ href, title, className }: ShareButtonProps) {
  const { dict } = useTranslation();
  const origin = useBrowserOrigin();

  const share = async () => {
    if (!origin) return;
    const outcome = await shareLink({ url: new URL(href, origin).href, title });
    if (outcome === 'copied') toast(dict.saveToLibrary.toast.linkCopied);
    if (outcome === 'failed') toast.danger(dict.saveToLibrary.toast.shareFailed);
  };

  return (
    <Button
      isIconOnly
      variant="secondary"
      aria-label={dict.details.share}
      onPress={() => void share()}
      className={className}
    >
      <Share aria-hidden className="size-5" />
    </Button>
  );
}
