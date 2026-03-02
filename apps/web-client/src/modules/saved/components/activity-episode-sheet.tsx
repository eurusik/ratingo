/**
 * Slide-out episode sheet for the Activity page.
 * Opens when a show card is clicked, allowing quick episode tracking
 * without navigating to the full details page.
 *
 * Mobile: Vaul Drawer (direction="right") with swipe-to-dismiss.
 * Desktop: Radix Sheet with X button + overlay click.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Drawer as DrawerPrimitive } from 'vaul';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/ui/sheet';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useShowDetails } from '@/core/query';
import { EpisodesSection } from '@/modules/details';
import type { MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import { useEpisodeSheetStore } from '../stores/episode-sheet.store';

const STALE_1_MIN = 60_000;

export function ActivityEpisodeSheet() {
  const { isOpen, item, close } = useEpisodeSheetStore();
  const isMobile = useIsMobile();

  // Reset store on unmount (e.g. navigating away from Activity page)
  useEffect(() => {
    return () => close();
  }, [close]);

  const handleOpenChange = (open: boolean) => {
    if (!open) close();
  };

  // Mobile: Vaul Drawer with swipe-right-to-dismiss
  if (isMobile) {
    return (
      <DrawerPrimitive.Root
        direction="right"
        open={isOpen}
        onOpenChange={handleOpenChange}
        shouldScaleBackground={false}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DrawerPrimitive.Content
            className="fixed inset-y-0 right-0 z-50 w-full flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] outline-none"
            aria-describedby={undefined}
          >
            <DrawerPrimitive.Title className="sr-only">Episodes</DrawerPrimitive.Title>
            {item && <SheetBody item={item} onClose={close} />}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    );
  }

  // Desktop: Radix Sheet with X button + overlay
  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg p-0 flex flex-col">
        {item && <SheetBody item={item} onClose={close} />}
      </SheetContent>
    </Sheet>
  );
}

interface SheetBodyProps {
  item: MeUserMediaListItemDto;
  onClose: () => void;
}

function SheetBody({ item, onClose }: SheetBodyProps) {
  const { dict } = useTranslation();
  const media = item.mediaSummary;

  const slug = media?.slug ?? '';
  const { data: show, isLoading, isError } = useShowDetails(slug, {
    enabled: !!slug,
    staleTime: STALE_1_MIN,
  });

  if (!media) return null;

  const posterUrl = (media.poster as Record<string, string> | null)?.small;
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null;
  const stateLabel = dict.saved?.states?.[item.state as keyof typeof dict.saved.states] ?? '';
  const typeLabel = dict.mediaType.show;
  const watched = item.progressSummary?.watched ?? 0;
  const total = item.progressSummary?.total ?? 0;
  const progressPercent = total > 0 ? (watched / total) * 100 : 0;

  return (
    <>
      {/* Mobile back bar — visible only on small screens */}
      <div className="sm:hidden flex items-center px-4 py-3 border-b border-cinema-borderSoft/30">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-cinema-text-secondary hover:text-cinema-text-primary transition-colors p-1 -ml-1 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{dict.common?.back ?? 'Назад'}</span>
        </button>
      </div>

      {/* Header */}
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-cinema-borderSoft/30">
        <div className="flex gap-4">
          {/* Poster */}
          <div className="shrink-0 relative w-16 h-24 rounded-lg overflow-hidden bg-cinema-elevated">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={media.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
                —
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-left text-base font-medium text-cinema-text-primary truncate">
              {media.title}
            </SheetTitle>
            <SheetDescription className="text-left text-sm text-cinema-text-muted mt-0.5">
              {typeLabel}
              {year && ` · ${year}`}
              {stateLabel && ` · ${stateLabel}`}
            </SheetDescription>

            {/* Progress bar */}
            {total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-cinema-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-cinema-text-muted tabular-nums">
                  {watched}/{total}
                </span>
              </div>
            )}

            {/* Details link */}
            <Link
              href={`/shows/${slug}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 mt-2 text-xs text-cinema-text-secondary hover:text-cinema-text-primary transition-colors"
            >
              {dict.common?.details ?? 'Детальніше'}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </SheetHeader>

      {/* Episodes content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading && <EpisodeSheetSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-cinema-text-muted">{dict.common?.error ?? 'Помилка'}</p>
          </div>
        )}

        {show && (
          <EpisodesSection
            seasons={show.seasons}
            nextEpisodeDate={show.nextAirDate}
            showId={show.showId}
            mediaItemId={show.id}
            dict={dict}
          />
        )}
      </div>
    </>
  );
}

function EpisodeSheetSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Section title placeholder */}
      <div className="h-3 w-16 bg-cinema-elevated rounded" />
      {/* Episode row placeholders */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-cinema-elevated shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 bg-cinema-elevated rounded" />
            <div className="h-3 w-28 bg-cinema-elevated rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
