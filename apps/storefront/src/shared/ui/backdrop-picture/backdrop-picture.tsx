import { DESKTOP_MEDIA_QUERY } from '@/shared/config';

const BACKDROP_WIDTH = 780;
const BACKDROP_HEIGHT = 439;

interface BackdropPictureProps {
  url: string;
  wideUrl?: string;
  className?: string;
  isPriority?: boolean;
}

export function BackdropPicture({
  url,
  wideUrl,
  className = '',
  isPriority = false,
}: BackdropPictureProps) {
  return (
    <picture>
      <source media={DESKTOP_MEDIA_QUERY} srcSet={wideUrl ?? url} />
      <img
        src={url}
        alt=""
        width={BACKDROP_WIDTH}
        height={BACKDROP_HEIGHT}
        fetchPriority={isPriority ? 'high' : 'auto'}
        className={`absolute inset-0 size-full object-cover ${className}`}
      />
    </picture>
  );
}
