'use client';

import { Avatar } from '@heroui/react';
import { initialOf } from '../model/initial';

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  className?: string;
}

export function PersonAvatar({ name, photoUrl, className }: PersonAvatarProps) {
  return (
    <Avatar aria-hidden className={className}>
      {photoUrl ? (
        <Avatar.Image src={photoUrl} alt="" className="object-cover object-[50%_20%]" />
      ) : null}
      <Avatar.Fallback>{initialOf(name)}</Avatar.Fallback>
    </Avatar>
  );
}
