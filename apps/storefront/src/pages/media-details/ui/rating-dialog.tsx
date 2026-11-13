'use client';

import { useState, type ReactElement } from 'react';
import dynamic from 'next/dynamic';
import { Popover, Skeleton } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '@/shared/lib';
import { Sheet } from '@/shared/ui';
import type { MediaRating } from '../model/use-rate-media';

const loadRatingPanel = () => import('./rating-panel').then((module) => module.RatingPanel);

const RatingPanel = dynamic(loadRatingPanel, {
  ssr: false,
  loading: () => <Skeleton className="h-90 w-full rounded-3xl" />,
});

interface RatingDialogProps {
  type: MediaType;
  title: string;
  rating: MediaRating;
  trigger: ReactElement<{ onPress?: () => void }>;
}

export function RatingDialog({ type, title, rating, trigger }: RatingDialogProps) {
  const { dict } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const runSignedIn = useSignedInAction();
  const [isOpen, setIsOpen] = useState(false);
  const heading = dict.details.rate.title[type];
  const close = () => setIsOpen(false);
  const changeOpen = (next: boolean) => {
    if (next) runSignedIn(() => setIsOpen(true));
    else close();
  };
  const panel = <RatingPanel type={type} title={title} rating={rating} onDone={close} />;

  if (!isDesktop) {
    return (
      <Sheet trigger={trigger} isOpen={isOpen} onOpenChange={changeOpen} title={heading}>
        {panel}
      </Sheet>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={changeOpen}>
      {trigger}
      <Popover.Content placement="bottom start" className="w-104">
        <Popover.Dialog className="flex flex-col gap-1">
          <Popover.Heading className="text-lg font-extrabold">{heading}</Popover.Heading>
          {panel}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
