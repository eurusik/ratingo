'use client';

import { Sheet as HeroSheet } from '@heroui/react';
import {
  DismissOnSystemBack,
  KeyboardInset,
  SheetScrollUnlock,
  ViewportBottomFill,
} from '@ratingo/ui/overlay';
import { useTranslation } from '@/shared/i18n';
import type { DialogSurfaceProps } from './dialog-surface-props';

export function Sheet({
  trigger,
  isOpen,
  onOpenChange,
  title,
  size = 'content',
  footer,
  children,
}: DialogSurfaceProps) {
  const { dict } = useTranslation();

  return (
    <HeroSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {trigger ? <HeroSheet.Trigger>{trigger}</HeroSheet.Trigger> : null}
      <HeroSheet.Backdrop>
        <HeroSheet.Content className={size === 'full' ? 'full-height-sheet' : undefined}>
          <HeroSheet.Dialog>
            <ViewportBottomFill tone="panel" />
            <DismissOnSystemBack />
            <SheetScrollUnlock />
            <HeroSheet.Handle />
            <HeroSheet.CloseTrigger aria-label={dict.common.close} />
            <HeroSheet.Header>
              <HeroSheet.Heading>{title}</HeroSheet.Heading>
            </HeroSheet.Header>
            <HeroSheet.Body>{children}</HeroSheet.Body>
            {footer ? <HeroSheet.Footer>{footer}</HeroSheet.Footer> : null}
            <KeyboardInset />
          </HeroSheet.Dialog>
        </HeroSheet.Content>
      </HeroSheet.Backdrop>
    </HeroSheet>
  );
}
