'use client';

import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';

interface SegmentedFilterOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedFilterProps<T extends string> {
  label: string;
  options: readonly SegmentedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedFilterProps<T>) {
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys;
    const option = options.find((candidate) => candidate.id === selected);
    if (option && option.id !== value) onChange(option.id);
  };

  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      size="sm"
      selectedKeys={[value]}
      onSelectionChange={onSelectionChange}
      className="px-4"
    >
      {options.map((option) => (
        <ToggleButton key={option.id} id={option.id} className="min-h-tap rounded-full px-4">
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
