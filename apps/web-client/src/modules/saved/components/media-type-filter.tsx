'use client';

import { Film, Tv } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { MediaTypeFilter as MediaTypeFilterValue } from '../hooks/use-me-lists';

export type { MediaTypeFilter as MediaTypeFilterValue } from '../hooks/use-me-lists';

const VALID_MEDIA_TYPES: MediaTypeFilterValue[] = ['all', 'movie', 'show'];

function isMediaTypeFilter(v: string): v is MediaTypeFilterValue {
  return (VALID_MEDIA_TYPES as string[]).includes(v);
}

const ITEM_CLASS =
  'h-auto min-w-0 gap-1.5 px-4 md:px-5 py-1 text-[13px] md:text-sm font-medium rounded-md data-[state=on]:bg-cinema-elevated data-[state=on]:text-cinema-text-primary text-cinema-text-muted hover:bg-transparent hover:text-cinema-text-secondary flex-1 sm:flex-none';

interface MediaTypeFilterProps {
  value: MediaTypeFilterValue;
  onChange: (value: MediaTypeFilterValue) => void;
}

export function MediaTypeFilter({ value, onChange }: MediaTypeFilterProps) {
  const { dict } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v && isMediaTypeFilter(v)) onChange(v);
      }}
      aria-label={dict.mediaType?.label ?? 'Фільтр за типом'}
      className="w-fit bg-cinema-card border border-cinema-border rounded-lg p-1 gap-0.5 md:gap-1"
    >
      <ToggleGroupItem value="all" className={ITEM_CLASS}>
        {dict.mediaType?.all ?? 'Всі'}
      </ToggleGroupItem>
      <ToggleGroupItem value="show" className={ITEM_CLASS}>
        <Tv className="!size-3.5" aria-hidden="true" />
        {dict.mediaType?.shows ?? 'Серіали'}
      </ToggleGroupItem>
      <ToggleGroupItem value="movie" className={ITEM_CLASS}>
        <Film className="!size-3.5" aria-hidden="true" />
        {dict.mediaType?.movies ?? 'Фільми'}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
