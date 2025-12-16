/**
 * Hero backdrop with poster fallback.
 * Handles backdrop image with error fallback to blurred poster.
 */

'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ImageSet } from '../types';

interface HeroBackdropProps {
  backdrop?: ImageSet | null;
  poster: ImageSet;
}

export function HeroBackdrop({ backdrop, poster }: HeroBackdropProps) {
  const [backdropError, setBackdropError] = useState(false);

  // Use poster as fallback if backdrop fails or doesn't exist
  const useBackdrop = backdrop && !backdropError;

  return (
    <div className="absolute inset-0 -z-10">
      {useBackdrop ? (
        <>
          <Image
            src={backdrop.large}
            alt=""
            fill
            className="object-cover"
            priority
            onError={() => setBackdropError(true)}
          />
          {/* Balanced gradients for readability while showing backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 via-zinc-950/30 to-transparent" />
        </>
      ) : (
        <>
          <Image
            src={poster.large}
            alt=""
            fill
            className="object-cover scale-110 blur-xl"
            priority
          />
          {/* Darker gradients for blurred poster */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/30 to-transparent" />
        </>
      )}
    </div>
  );
}
