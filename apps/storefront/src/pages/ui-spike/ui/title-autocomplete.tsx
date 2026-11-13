'use client';

import { Autocomplete, Label, ListBox, SearchField, useFilter } from '@heroui/react';
import { KIND_LABELS, SAMPLE_TITLES } from '../model/sample-titles';

export function TitleAutocomplete() {
  const { contains } = useFilter({ sensitivity: 'base' });

  return (
    <Autocomplete placeholder="Оберіть тайтл">
      <Label>Пошук тайтлу</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="Назва">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Наприклад, Дюна…" />
            </SearchField.Group>
          </SearchField>
          <ListBox items={SAMPLE_TITLES}>
            {(item) => (
              <ListBox.Item id={item.id} textValue={item.title}>
                {item.title} · {KIND_LABELS[item.kind]}, {item.year}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
