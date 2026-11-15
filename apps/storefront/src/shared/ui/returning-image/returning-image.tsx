'use client';

import Image, { type ImageProps } from 'next/image';

const REMEMBERED_SOURCES = 200;

const loadedSources = new Set<string>();

function rememberLoaded(src: string): void {
  loadedSources.delete(src);
  loadedSources.add(src);
  if (loadedSources.size <= REMEMBERED_SOURCES) return;
  const oldest = loadedSources.values().next().value;
  if (oldest !== undefined) loadedSources.delete(oldest);
}

type ReturningImageProps = Omit<ImageProps, 'src'> & { src: string };

export function ReturningImage({ src, loading, decoding, onLoad, ...props }: ReturningImageProps) {
  const wasLoadedBefore = loadedSources.has(src);

  return (
    <Image
      {...props}
      src={src}
      loading={wasLoadedBefore ? 'eager' : loading}
      decoding={wasLoadedBefore ? 'sync' : decoding}
      onLoad={(event) => {
        rememberLoaded(src);
        onLoad?.(event);
      }}
    />
  );
}
