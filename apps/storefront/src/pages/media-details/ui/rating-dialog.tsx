'use client';

import { useEffect, useState, type ReactElement } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { preloadWhenIdle } from '@/shared/lib';
import { ResponsiveDialog } from '@/shared/ui';
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
  const runSignedIn = useSignedInAction();
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => preloadWhenIdle(loadRatingPanel), []);
  const heading = dict.details.rate.title[type];
  const close = () => setIsOpen(false);
  const changeOpen = (next: boolean) => {
    if (next) runSignedIn(() => setIsOpen(true));
    else close();
  };

  return (
    <ResponsiveDialog trigger={trigger} isOpen={isOpen} onOpenChange={changeOpen} title={heading}>
      <RatingPanel type={type} title={title} rating={rating} onDone={close} />
    </ResponsiveDialog>
  );
}
