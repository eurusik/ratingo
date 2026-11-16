'use client';

import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';

interface SegmentedFilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface SegmentedFilterProps<T extends string> {
  label: string;
  options: readonly SegmentedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  descriptionId?: string;
  isDisabled?: boolean;
  className?: string;
}

export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  descriptionId,
  isDisabled,
  className,
}: SegmentedFilterProps<T>) {
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys;
    const option = options.find((candidate) => candidate.id === selected);
    if (option && option.id !== value) onChange(option.id);
  };

  return (
    <ToggleButtonGroup
      aria-label={label}
      aria-describedby={descriptionId}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      isDisabled={isDisabled}
      size="sm"
      selectedKeys={[value]}
      onSelectionChange={onSelectionChange}
      className={cn('px-4', className)}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="min-h-tap gap-1.5 rounded-full px-4"
        >
          {option.label}
          {option.count === undefined ? null : (
            <span className="tabular-nums opacity-70">{option.count}</span>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
