'use client';

import { useState } from 'react';
import { Button, SearchField, useFilter } from '@heroui/react';
import { KIND_LABELS, SAMPLE_TITLES } from '../model/sample-titles';
import { BottomSheet } from './bottom-sheet';

export function SearchSheet() {
  const [query, setQuery] = useState('');
  const { contains } = useFilter({ sensitivity: 'base' });
  const matches = SAMPLE_TITLES.filter((title) => contains(title.title, query));

  return (
    <BottomSheet
      label="Пошук у шторці"
      title="Пошук"
      size="full"
      footer={
        <Button slot="close" fullWidth>
          Показати {matches.length}
        </Button>
      }
    >
      <SearchField aria-label="Назва" value={query} onChange={setQuery}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Наприклад, Дюна…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <p role="status" className="sr-only">
        Знайдено: {matches.length}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {matches.map((title) => (
          <li key={title.id} className="rounded-xl bg-surface-tertiary p-3">
            {title.title} · {KIND_LABELS[title.kind]}, {title.year}
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
