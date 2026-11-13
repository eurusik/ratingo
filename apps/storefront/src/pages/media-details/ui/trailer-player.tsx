'use client';

import { Modal } from '@heroui/react';
import { DismissOnSystemBack } from '@ratingo/ui/overlay';
import { useTranslation } from '@/shared/i18n';
import { trailerEmbedUrl, type Trailer } from '../model/trailers';

interface TrailerPlayerProps {
  trailer: Trailer;
  isOpen: boolean;
  onClose: () => void;
}

export function TrailerPlayer({ trailer, isOpen, onClose }: TrailerPlayerProps) {
  const { dict } = useTranslation();

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog className="max-w-4xl p-0">
            <DismissOnSystemBack />
            <Modal.CloseTrigger aria-label={dict.common.close} className="z-10" />
            <Modal.Header className="sr-only">
              <Modal.Heading>{trailer.title}</Modal.Heading>
            </Modal.Header>
            <iframe
              src={trailerEmbedUrl(trailer.key)}
              title={trailer.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full rounded-[inherit] border-0"
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
