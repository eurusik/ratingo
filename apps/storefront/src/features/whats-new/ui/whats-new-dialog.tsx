'use client';

import { useId } from 'react';
import { Button, Modal, Sheet } from '@heroui/react';
import { DismissOnSystemBack, SheetScrollUnlock, ViewportBottomFill } from '@ratingo/ui/overlay';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import { BrandIcon } from '@/shared/ui';
import { useIsInstalledIosApp } from '../model/installed-ios-app';
import { WhatsNewHighlights } from './whats-new-highlights';

const HEADING = 'text-[26px] font-extrabold leading-tight tracking-tight text-balance text-foreground';
const SUBTITLE = 'text-[15px] leading-snug text-pretty text-muted';

interface SurfaceProps {
  isOpen: boolean;
  onDismiss: () => void;
  subtitleId: string;
  hasIosIconHint: boolean;
}

function dismissWhenClosed(onDismiss: () => void) {
  return (isOpen: boolean) => {
    if (!isOpen) onDismiss();
  };
}

function GotItButton({ className }: { className?: string }) {
  const { dict } = useTranslation();

  return (
    <Button slot="close" size="lg" className={className} autoFocus>
      {dict.whatsNew.gotIt}
    </Button>
  );
}

function PhoneSheet({ isOpen, onDismiss, subtitleId, hasIosIconHint }: SurfaceProps) {
  const { dict } = useTranslation();

  return (
    <Sheet isOpen={isOpen} onOpenChange={dismissWhenClosed(onDismiss)}>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog aria-describedby={subtitleId}>
            <ViewportBottomFill tone="panel" />
            <DismissOnSystemBack />
            <SheetScrollUnlock />
            <Sheet.Handle />
            <Sheet.Header className="flex flex-col items-center gap-3 pt-1.5 text-center">
              <BrandIcon size={72} />
              <Sheet.Heading className={HEADING}>{dict.whatsNew.title}</Sheet.Heading>
              <p id={subtitleId} className={SUBTITLE}>
                {dict.whatsNew.subtitle}
              </p>
            </Sheet.Header>
            <Sheet.Body>
              <WhatsNewHighlights hasIosIconHint={hasIosIconHint} />
            </Sheet.Body>
            <Sheet.Footer>
              <GotItButton className="w-full" />
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function DesktopModal({ isOpen, onDismiss, subtitleId, hasIosIconHint }: SurfaceProps) {
  const { dict } = useTranslation();

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={dismissWhenClosed(onDismiss)}>
        <Modal.Container scroll="inside">
          <Modal.Dialog aria-describedby={subtitleId} className="max-w-[520px] p-8">
            <ViewportBottomFill tone="backdrop" />
            <DismissOnSystemBack />
            <Modal.CloseTrigger aria-label={dict.common.close} />
            <Modal.Header className="flex-row items-center gap-4 pe-10">
              <BrandIcon size={64} />
              <span className="flex min-w-0 flex-col gap-1">
                <Modal.Heading className={HEADING}>{dict.whatsNew.title}</Modal.Heading>
                <p id={subtitleId} className={SUBTITLE}>
                  {dict.whatsNew.subtitle}
                </p>
              </span>
            </Modal.Header>
            <Modal.Body className="mt-6">
              <WhatsNewHighlights hasIosIconHint={hasIosIconHint} />
            </Modal.Body>
            <Modal.Footer className="mt-6">
              <GotItButton />
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

interface WhatsNewDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export function WhatsNewDialog({ isOpen, onDismiss }: WhatsNewDialogProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const hasIosIconHint = useIsInstalledIosApp();
  const subtitleId = useId();
  const Surface = isDesktop ? DesktopModal : PhoneSheet;

  return (
    <Surface
      isOpen={isOpen}
      onDismiss={onDismiss}
      subtitleId={subtitleId}
      hasIosIconHint={hasIosIconHint}
    />
  );
}
