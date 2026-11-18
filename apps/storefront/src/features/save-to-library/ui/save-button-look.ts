import type { MediaSummary } from '@/entities/media';

export type SaveButtonTone = 'surface' | 'overlay';

export interface SaveButtonProps {
  media: Pick<MediaSummary, 'mediaItemId' | 'title' | 'type' | 'slug'>;
  tone?: SaveButtonTone;
}

export const TONE_CLASSES: Record<SaveButtonTone, string> = {
  surface: '',
  overlay: 'poster-glass',
};

export const SAVE_BUTTON_CLASS =
  'size-11 shrink-0 touch-manipulation rounded-full select-none [-webkit-touch-callout:none] data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';
