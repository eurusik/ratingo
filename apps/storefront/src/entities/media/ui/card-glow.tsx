import { DownscaledBlur, ReturningImage } from '@/shared/ui';

interface CardGlowProps {
  imageUrl?: string;
  loading?: 'eager' | 'lazy';
}

export function CardGlow({ imageUrl, loading = 'lazy' }: CardGlowProps) {
  if (!imageUrl) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <DownscaledBlur>
        <ReturningImage
          src={imageUrl}
          alt=""
          fill
          unoptimized
          loading={loading}
          className="scale-125 object-cover"
        />
      </DownscaledBlur>
      <span className="glow-veil absolute inset-0" />
    </span>
  );
}
