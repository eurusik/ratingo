import Image from 'next/image';
import { Film, Tv } from 'lucide-react';

interface CardPosterProps {
  src: string | null;
  alt: string;
  type?: 'movie' | 'show';
  children?: React.ReactNode;
  className?: string;
}

export function CardPoster({
  src,
  alt,
  type = 'movie',
  children,
  className = '',
}: CardPosterProps) {
  return (
    <div className={`aspect-[2/3] relative bg-zinc-800 overflow-hidden ${className}`}>
      {src ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-600">
          <div className="text-center">
            {type === 'movie' ? (
              <Film className="w-12 h-12 mx-auto mb-2" />
            ) : (
              <Tv className="w-12 h-12 mx-auto mb-2" />
            )}
            <div className="text-sm">Без постера</div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
