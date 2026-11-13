'use client';

import { Avatar } from '@heroui/react';

export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  className?: string;
}

export function PersonAvatar({ name, photoUrl, className }: PersonAvatarProps) {
  return (
    <Avatar aria-hidden className={className}>
      {photoUrl ? <Avatar.Image src={photoUrl} alt="" /> : null}
      <Avatar.Fallback>{initialOf(name)}</Avatar.Fallback>
    </Avatar>
  );
}
