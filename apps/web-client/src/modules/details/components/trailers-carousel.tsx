/**
 * Trailers carousel with YouTube previews.
 * Horizontal scroll with click to open modal.
 */

'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Carousel } from '@/shared/components/carousel';
import { Dialog, DialogContent } from '@/shared/ui';
import type { Video } from '../types';

export interface TrailersCarouselProps {
  videos: Video[];
  primaryTrailer?: Video;
}

export function TrailersCarousel({ videos, primaryTrailer }: TrailersCarouselProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Filter for trailers only and prioritize primary
  const trailers = videos.filter(v => v.type === 'Trailer');
  const sortedTrailers = primaryTrailer
    ? [primaryTrailer, ...trailers.filter(t => t.key !== primaryTrailer.key)]
    : trailers;

  if (sortedTrailers.length === 0) return null;

  const getYouTubeThumbnail = (key: string) => {
    return `https://img.youtube.com/vi/${key}/maxresdefault.jpg`;
  };

  return (
    <>
      {/* Carousel */}
      <Carousel gap="md">
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
      </Carousel>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black border-zinc-800 overflow-hidden">
          <div className="aspect-video">
            {selectedVideo && (
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.key}?autoplay=1`}
                title={selectedVideo.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
