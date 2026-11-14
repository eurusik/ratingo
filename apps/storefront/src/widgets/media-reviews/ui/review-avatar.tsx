import { Avatar } from '@heroui/react';
import { initialOf } from '@/shared/lib';

const SIZES = {
  md: { pixels: 36, className: 'size-9' },
  sm: { pixels: 28, className: 'size-7 text-xs' },
} as const;

interface ReviewAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
}

export function ReviewAvatar({ username, avatarUrl, size = 'md' }: ReviewAvatarProps) {
  const { pixels, className } = SIZES[size];
  return (
    <Avatar size="sm" aria-hidden className={`shrink-0 ${className}`}>
      {avatarUrl ? (
        <Avatar.Image
          src={avatarUrl}
          alt=""
          width={pixels}
          height={pixels}
          loading="lazy"
          className="object-cover"
        />
      ) : null}
      <Avatar.Fallback>{initialOf(username)}</Avatar.Fallback>
    </Avatar>
  );
}
