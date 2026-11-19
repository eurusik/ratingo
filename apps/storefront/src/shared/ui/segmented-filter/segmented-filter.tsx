'use client';

import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { FadingScrollRow } from '../edge-fade/fading-scroll-row';

const SELECTED_OPTION = '[aria-checked="true"]';

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
  isScrollable?: boolean;
  isFullWidth?: boolean;
  className?: string;
}

export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  descriptionId,
  isDisabled,
  isScrollable,
  isFullWidth,
  className,
}: SegmentedFilterProps<T>) {
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys;
    const option = options.find((candidate) => candidate.id === selected);
    if (option && option.id !== value) onChange(option.id);
  };

  const group = (
    <ToggleButtonGroup
      aria-label={label}
      aria-describedby={descriptionId}
      selectionMode="single"
      disallowEmptySelection
      isDetached={!isFullWidth}
      fullWidth={isFullWidth}
      isDisabled={isDisabled}
      size="sm"
      selectedKeys={[value]}
      onSelectionChange={onSelectionChange}
      className={cn(isScrollable ? 'w-max' : 'px-4', className)}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className={cn(
            'min-h-tap shrink-0 gap-1.5 px-4',
            isFullWidth ? 'flex-1 font-semibold' : 'rounded-full',
          )}
        >
          {option.label}
          {option.count === undefined ? null : (
            <span className="tabular-nums opacity-70">{option.count}</span>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  if (!isScrollable) return group;
  return (
    <FadingScrollRow
      activeKey={value}
      contentKey={options.map((option) => `${option.id}${option.count ?? ''}`).join()}
      activeSelector={SELECTED_OPTION}
    >
      {group}
    </FadingScrollRow>
  );
}
