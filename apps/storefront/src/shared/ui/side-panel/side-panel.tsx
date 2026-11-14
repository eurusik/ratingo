'use client';

import { Drawer } from '@heroui/react';
import { DismissOnSystemBack } from '@ratingo/ui/overlay';
import { useTranslation } from '@/shared/i18n';
import type { DialogSurfaceProps } from '../sheet';

export function SidePanel({
  isOpen,
  onOpenChange,
  title,
  isHeaderless = false,
  footer,
  children,
}: DialogSurfaceProps) {
  const { dict } = useTranslation();

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className="w-[35rem] max-w-full px-0">
          <DismissOnSystemBack />
          {isHeaderless ? null : <Drawer.CloseTrigger aria-label={dict.common.close} />}
          <Drawer.Header className={isHeaderless ? 'sr-only' : 'px-5'}>
            <Drawer.Heading>{title}</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="overflow-x-hidden px-5">{children}</Drawer.Body>
          {footer ? <Drawer.Footer className="px-5">{footer}</Drawer.Footer> : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
