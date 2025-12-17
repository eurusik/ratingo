/**
 * Reusable Carousel Wrapper
 * Horizontal scroll with navigation buttons using Embla
 */

'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

export interface CarouselProps {
  children: ReactNode;
  title?: string | ReactNode;
  titleTooltip?: string;
  subtitle?: string;
  actions?: ReactNode;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Carousel({ 
  children, 
  title, 
  titleTooltip,
  subtitle,
  actions,
  gap = 'md',
  className = '',
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  };

  return (
    <section className={`space-y-3 ${className}`}>
      {/* Header */}
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {title && (
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{title}</h2>
                {titleTooltip && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-zinc-500 hover:text-zinc-400 transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{titleTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Custom actions */}
            {actions}

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/10 to-zinc-800/60 hover:from-blue-500/20 hover:to-zinc-700/60 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:from-zinc-800/60 disabled:to-zinc-800/60"
                aria-label="Попередній"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/10 to-zinc-800/60 hover:from-blue-500/20 hover:to-zinc-700/60 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:from-zinc-800/60 disabled:to-zinc-800/60"
                aria-label="Наступний"
              >
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className={`flex ${gapClasses[gap]} pb-2`}>
          {children}
        </div>
      </div>
    </section>
  );
}
