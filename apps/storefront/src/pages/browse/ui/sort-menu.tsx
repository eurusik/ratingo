'use client';

import { Button, Description, Dropdown, Label, type Selection } from '@heroui/react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import type { BrowseSort } from '../model/browse-state';

interface SortMenuProps {
  options: readonly BrowseSort[];
  value: BrowseSort;
  onChange: (next: BrowseSort) => void;
}

export function SortMenu({ options, value, onChange }: SortMenuProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.sort;

  const changeSort = (selection: Selection) => {
    if (selection === 'all') return;
    const next = options.find((option) => selection.has(option));
    if (next && next !== value) onChange(next);
  };

  return (
    <Dropdown>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${labels.label}: ${labels[value].label}`}
        className="min-h-tap shrink-0 gap-1.5 px-2 font-semibold"
      >
        <ArrowUpDown aria-hidden className="size-4 text-muted" />
        {labels[value].label}
        <ChevronDown aria-hidden className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-64">
        <Dropdown.Menu
          aria-label={labels.label}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value]}
          onSelectionChange={changeSort}
        >
          {options.map((option) => (
            <Dropdown.Item key={option} id={option} textValue={labels[option].label}>
              <div className="flex flex-col">
                <Label>{labels[option].label}</Label>
                <Description>{labels[option].hint}</Description>
              </div>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
