import { Check, Plus } from 'lucide-react';
import type { MediaSummary } from '@/entities/media';
import { interpolate, type Dictionary } from '@/shared/i18n';

export type SaveButtonTone = 'surface' | 'overlay';

export interface SaveButtonProps {
  media: Pick<MediaSummary, 'mediaItemId' | 'title' | 'type' | 'slug'>;
  tone?: SaveButtonTone;
}

const TONE_CLASSES: Record<SaveButtonTone, string> = {
  surface: '',
  overlay: 'poster-glass',
};

const ROUND_TOUCH_TARGET = 'size-11 shrink-0 touch-manipulation rounded-full';
const NO_TOUCH_CALLOUT = 'select-none [-webkit-touch-callout:none]';
const SAVED_COLORS = 'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';

export function saveButtonClass(tone: SaveButtonTone): string {
  return `${ROUND_TOUCH_TARGET} ${NO_TOUCH_CALLOUT} ${SAVED_COLORS} ${TONE_CLASSES[tone]}`;
}

export function saveButtonLabel(dict: Dictionary, title: string): string {
  return interpolate(dict.saveToLibrary.save, { title });
}

export function SaveIcon({ saved }: { saved: boolean }) {
  return saved ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />;
}
