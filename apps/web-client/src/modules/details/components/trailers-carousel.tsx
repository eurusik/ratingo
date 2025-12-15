/**
 * Trailers carousel with YouTube previews.
 * Horizontal scroll with click to open modal.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Play, X, ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/shared/utils';

export interface Video {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  language: string;
  country: string;
}

export interface TrailersCarouselProps {
  videos: Video[];
  primaryTrailer?: Video;
}

export function TrailersCarousel({ videos, primaryTrailer }: TrailersCarouselProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Filter for trailers only and prioritize primary
  const trailers = videos.filter(v => v.type === 'Trailer');
  const sortedTrailers = primaryTrailer
    ? [primaryTrailer, ...trailers.filter(t => t.key !== primaryTrailer.key)]
    : trailers;

  if (sortedTrailers.length === 0) return null;

  const getYouTubeThumbnail = (key: string) => {
    return `https://img.youtube.com/vi/${key}/maxresdefault.jpg`;
  };

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Update button states on init and scroll
  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  // Check if we need to show navigation buttons (more than 3 trailers)
  const showNavigation = sortedTrailers.length > 3;

  return (
    <>
      {/* Carousel */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400">Трейлери</h2>
          
          {/* Navigation buttons - only show if there are more than 3 trailers */}
          {showNavigation && (
            <div className="flex items-center gap-2">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800/60"
                aria-label="Попередній"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800/60"
                aria-label="Наступний"
              >
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          )}
        </div>
        
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {sortedTrailers.map((video, index) => (
              <button
                key={video.key}
                onClick={() => setSelectedVideo(video)}
                className="group relative flex-shrink-0 w-64 aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-blue-500 transition-all"
              >
                {/* Thumbnail */}
                <img
                  src={getYouTubeThumbnail(video.key)}
                  alt={video.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/90 flex items-center justify-center group-hover:bg-blue-400 group-hover:scale-110 transition-all">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>

                {/* Title */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs text-white font-medium line-clamp-2">
                    {video.name}
                  </p>
                  {index === 0 && video.official && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded">
                      Офіційний
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* YouTube iframe */}
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo.key}?autoplay=1`}
              title={selectedVideo.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
