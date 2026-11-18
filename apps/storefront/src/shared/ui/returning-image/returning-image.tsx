'use client';

import { useCallback } from 'react';
import { getImageProps, type ImageProps } from 'next/image';

const REMEMBERED_SOURCES = 200;

const loadedSources = new Set<string>();

function rememberLoaded(src: string): void {
  loadedSources.delete(src);
  loadedSources.add(src);
  if (loadedSources.size <= REMEMBERED_SOURCES) return;
  const oldest = loadedSources.values().next().value;
  if (oldest !== undefined) loadedSources.delete(oldest);
}

type ReturningImageProps = Omit<ImageProps, 'src' | 'onLoad'> & { src: string; srcSet?: string };

export function ReturningImage({
  src,
  srcSet,
  sizes,
  alt,
  loading,
  decoding,
  ...props
}: ReturningImageProps) {
  const wasLoadedBefore = loadedSources.has(src);
  const { props: imageProps } = getImageProps({
    ...props,
    src,
    alt,
    loading: wasLoadedBefore ? 'eager' : loading,
    decoding: wasLoadedBefore ? 'sync' : decoding,
  });
  const rememberIfLoadedBeforeHydration = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth > 0) rememberLoaded(src);
    },
    [src],
  );

  return (
    <picture className="contents">
      <img
        {...imageProps}
        alt={alt}
        srcSet={srcSet ?? imageProps.srcSet}
        sizes={sizes}
        ref={rememberIfLoadedBeforeHydration}
        onLoad={() => rememberLoaded(src)}
      />
    </picture>
  );
}
