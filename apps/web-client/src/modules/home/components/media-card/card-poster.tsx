/**
 * Card poster component with image and badge overlays.
 *
 * Displays TMDB poster with proper aspect ratio and fallback.
 * Supports overlay badges for rank and trending status.
 */

import Image from 'next/image';
import { Film, Tv } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';

interface CardPosterProps {
  /** TMDB poster URL. */
  src: string | null;
  /** Alt text for image. */
  alt: string;
  /** Media type for fallback icon. */
  type?: 'movie' | 'show';
  /** Badge overlays. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Poster image with 2:3 aspect ratio and fallback.
 *
 * @example
 * <CardPoster src={posterUrl} alt={title} type="show">
 *   <Badge variant="rank" position="top-left">№1</Badge>
 * </CardPoster>
 */
export function CardPoster({ src, alt, type = 'movie', children, className }: CardPosterProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('aspect-[2/3] relative bg-zinc-800 overflow-hidden', className)}>
      {src ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-600">
          <div className="text-center">
            {type === 'movie' ? (
              <Film className="w-12 h-12 mx-auto mb-2" />
            ) : (
              <Tv className="w-12 h-12 mx-auto mb-2" />
            )}
            <div className="text-sm">{t('card.noPoster')}</div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
