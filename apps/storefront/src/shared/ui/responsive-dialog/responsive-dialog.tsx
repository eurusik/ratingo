'use client';

import { cloneElement, useState } from 'react';
import { Modal } from '@heroui/react';
import { DismissOnSystemBack, ViewportBottomFill } from '@ratingo/ui/overlay';
import { useTranslation } from '@/shared/i18n';
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '@/shared/lib';
import { Sheet, type DialogSurfaceProps } from '../sheet';

function DesktopModal({
  isOpen,
  onOpenChange,
  title,
  isHeaderless = false,
  footer,
  children,
}: DialogSurfaceProps) {
  const { dict } = useTranslation();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside">
          <Modal.Dialog>
            <ViewportBottomFill tone="backdrop" />
            <DismissOnSystemBack />
            {isHeaderless ? null : <Modal.CloseTrigger aria-label={dict.common.close} />}
            <Modal.Header className={isHeaderless ? 'sr-only' : undefined}>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
            {footer ? <Modal.Footer>{footer}</Modal.Footer> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function ResponsiveDialog({
  trigger,
  isOpen,
  onOpenChange,
  ...surface
}: DialogSurfaceProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [isOpenUncontrolled, setIsOpenUncontrolled] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : isOpenUncontrolled;

  const changeOpen = (next: boolean) => {
    if (!isControlled) setIsOpenUncontrolled(next);
    onOpenChange?.(next);
  };

  const Surface = isDesktop ? DesktopModal : Sheet;
  return (
    <>
      {trigger ? cloneElement(trigger, { onPress: () => changeOpen(true) }) : null}
      <Surface {...surface} isOpen={open} onOpenChange={changeOpen} />
    </>
  );
}
