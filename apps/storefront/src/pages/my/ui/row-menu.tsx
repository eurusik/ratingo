'use client';

import { Dropdown, Label, type Key } from '@heroui/react';
import { Ellipsis } from 'lucide-react';

export interface RowMenuItem {
  id: string;
  label: string;
  href?: string;
  isDanger?: boolean;
  onAction?: () => void;
}

export function RowMenu({ label, items }: { label: string; items: readonly RowMenuItem[] }) {
  const onAction = (key: Key) => items.find((item) => item.id === key)?.onAction?.();

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={label}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted outline-none hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Ellipsis aria-hidden className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu aria-label={label} onAction={onAction}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              href={item.href}
              textValue={item.label}
              variant={item.isDanger ? 'danger' : 'default'}
            >
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
