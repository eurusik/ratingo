'use client';

import { SearchField } from '@heroui/react';

interface ListSearchProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function ListSearch({ label, placeholder, value, onChange }: ListSearchProps) {
  return (
    <SearchField aria-label={label} value={value} onChange={onChange} variant="secondary" fullWidth>
      <SearchField.Group className="h-12">
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <SearchField.ClearButton className="phone-tap-target" />
      </SearchField.Group>
    </SearchField>
  );
}
