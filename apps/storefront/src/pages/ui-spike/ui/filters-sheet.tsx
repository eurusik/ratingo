'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { BottomSheet } from './bottom-sheet';

const GENRES = ['Драма', 'Комедія', 'Трилер', 'Фантастика', 'Документальне', 'Аніме', 'Кримінал'];

export function FiltersSheet() {
  const [selectedGenres, setSelectedGenres] = useState<ReadonlySet<string>>(new Set());

  const toggleGenre = (genre: string) =>
    setSelectedGenres((current) => {
      const next = new Set(current);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });

  return (
    <BottomSheet
      label="Фільтри"
      title="Фільтри"
      footer={
        <Button slot="close" fullWidth>
          Застосувати
        </Button>
      }
    >
      <p>Свайп униз будь-де по шторці закриває її.</p>
      <div
        data-noswipe
        role="group"
        aria-label="Жанри"
        className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2"
      >
        {GENRES.map((genre) => (
          <button
            key={genre}
            type="button"
            aria-pressed={selectedGenres.has(genre)}
            onClick={() => toggleGenre(genre)}
            className="min-h-tap shrink-0 snap-start rounded-full bg-surface-tertiary px-4 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          >
            {genre}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
