'use client';

import type { ReactNode } from 'react';
import { Button, Sheet } from '@heroui/react';
import {
  DismissOnSystemBack,
  KeyboardInset,
  SheetScrollUnlock,
  ViewportBottomFill,
} from '@ratingo/ui/overlay';

type BottomSheetSize = 'content' | 'full';

interface BottomSheetProps {
  label: string;
  title: string;
  size?: BottomSheetSize;
  footer?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ label, title, size = 'content', footer, children }: BottomSheetProps) {
  return (
    <Sheet>
      <Sheet.Trigger>
        <Button variant="secondary">{label}</Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className={size === 'full' ? 'full-height-sheet' : undefined}>
          <Sheet.Dialog>
            <ViewportBottomFill tone="panel" />
            <DismissOnSystemBack />
            <SheetScrollUnlock />
            <Sheet.Handle />
            <Sheet.CloseTrigger aria-label="Закрити" />
            <Sheet.Header>
              <Sheet.Heading>{title}</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>{children}</Sheet.Body>
            {footer ? <Sheet.Footer>{footer}</Sheet.Footer> : null}
            <KeyboardInset />
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
