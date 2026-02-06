'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@/shared/ui';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/shared/ui/drawer';
import type { MediaType } from '@/shared/types';
import { RatingSlider } from '@/modules/reviews/components/rating-slider';
import { DEFAULT_RATING } from '@/modules/reviews/schemas';
import { useSetRating } from '@/modules/saved/hooks/use-me-lists';

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaItemId: string;
  mediaType: MediaType;
  currentRating?: number | null;
}

export function RatingDialog({
  open,
  onOpenChange,
  mediaItemId,
  mediaType,
  currentRating,
}: RatingDialogProps) {
  const { dict } = useTranslation();
  const isMobile = useIsMobile();
  const { mutateAsync: setRating, isPending } = useSetRating(mediaItemId);

  const [value, setValue] = useState(currentRating ?? DEFAULT_RATING);

  useEffect(() => {
    if (open) {
      setValue(currentRating ?? DEFAULT_RATING);
    }
  }, [open, currentRating]);

  const handleSubmit = async (rating: number | null, successMessage: string) => {
    try {
      await setRating({ rating, mediaType });
      toast.success(successMessage);
      onOpenChange(false);
    } catch {
      toast.error(dict.rating.toast.error);
    }
  };

  const handleSave = () => handleSubmit(value, dict.rating.toast.saved);
  const handleClear = () => handleSubmit(null, dict.rating.toast.cleared);

  const content = (
    <>
      <RatingSlider value={value} onChange={setValue} disabled={isPending} className="py-4" />
      <div className="flex items-center justify-between gap-3 pt-2">
        {currentRating != null && (
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={isPending}
            className="text-cinema-text-muted"
          >
            {dict.rating.clear}
          </Button>
        )}
        <Button onClick={handleSave} disabled={isPending} className="ml-auto">
          {dict.rating.save}
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>{dict.rating.title}</DrawerTitle>
            <DrawerDescription className="sr-only">{dict.rating.description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-cinema-elevated border-cinema-border">
        <DialogHeader>
          <DialogTitle>{dict.rating.title}</DialogTitle>
          <DialogDescription className="sr-only">{dict.rating.description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
