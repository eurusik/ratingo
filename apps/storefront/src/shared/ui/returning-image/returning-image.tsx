'use client';

import Image, { type ImageProps } from 'next/image';

const loadedSources = new Set<string>();

type ReturningImageProps = Omit<ImageProps, 'src'> & { src: string };

export function ReturningImage({ src, loading, onLoad, ...props }: ReturningImageProps) {
  const wasLoadedBefore = loadedSources.has(src);

  return (
    <Image
      {...props}
      src={src}
      loading={wasLoadedBefore ? 'eager' : loading}
      onLoad={(event) => {
        loadedSources.add(src);
        onLoad?.(event);
      }}
    />
  );
}
