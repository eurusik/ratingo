'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { Modal, ScrollShadow } from '@heroui/react';
import { Play } from 'lucide-react';
import { DismissOnSystemBack } from '@ratingo/ui/overlay';
import { interpolate, useTranslation } from '@/shared/i18n';
import { trailerEmbedUrl, trailerThumbnailUrl, type Trailer } from '../model/trailers';

function TrailerThumb({ trailer, onPlay }: { trailer: Trailer; onPlay: () => void }) {
  const { dict } = useTranslation();

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={interpolate(dict.details.trailers.watch, { title: trailer.title })}
      className="flex w-70 flex-col gap-2 rounded-2xl text-start text-foreground transition-opacity hover:opacity-85 active:opacity-70 md:w-full"
    >
      <span className="relative block aspect-video w-full overflow-hidden rounded-[14px] bg-surface-secondary md:rounded-2xl">
        <Image
          src={trailerThumbnailUrl(trailer.key)}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 48rem) 50vw, 280px"
          className="object-cover"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 flex size-13 -translate-1/2 items-center justify-center rounded-full bg-background/70 text-white md:size-15"
        >
          <Play className="size-5.5 fill-current" />
        </span>
      </span>
      <span className="line-clamp-2 text-sm font-semibold">{trailer.title}</span>
    </button>
  );
}

export function TrailersSection({ trailers }: { trailers: Trailer[] }) {
  const { dict } = useTranslation();
  const headingId = useId();
  const [playing, setPlaying] = useState<Trailer | null>(null);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5 md:gap-3">
      <h2 id={headingId} className="text-xl font-extrabold tracking-tight md:text-2xl">
        {dict.details.trailers.title}
      </h2>
      <ScrollShadow
        orientation="horizontal"
        hideScrollBar
        className="-mx-4 snap-x snap-mandatory scroll-px-4 overscroll-x-contain md:mx-0 md:overflow-visible"
      >
        <ul className="flex w-max gap-2.5 px-4 md:grid md:w-full md:grid-cols-2 md:gap-4 md:px-0 xl:grid-cols-3">
          {trailers.map((trailer) => (
            <li key={trailer.key} className="snap-start">
              <TrailerThumb trailer={trailer} onPlay={() => setPlaying(trailer)} />
            </li>
          ))}
        </ul>
      </ScrollShadow>
      <Modal isOpen={playing !== null} onOpenChange={(isOpen) => !isOpen && setPlaying(null)}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog className="max-w-4xl p-0">
              <DismissOnSystemBack />
              <Modal.CloseTrigger aria-label={dict.common.close} className="z-10" />
              <Modal.Header className="sr-only">
                <Modal.Heading>{playing?.title ?? dict.details.trailers.title}</Modal.Heading>
              </Modal.Header>
              {playing ? (
                <iframe
                  src={trailerEmbedUrl(playing.key)}
                  title={playing.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="aspect-video w-full rounded-[inherit] border-0"
                />
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
