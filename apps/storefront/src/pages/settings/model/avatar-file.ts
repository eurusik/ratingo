import type { AvatarContentType } from '@/shared/api';

const AVATAR_TYPES: readonly AvatarContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

export const AVATAR_ACCEPT = AVATAR_TYPES.join(',');

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarProblem = 'type' | 'size';

export function isAvatarType(type: string): type is AvatarContentType {
  return (AVATAR_TYPES as readonly string[]).includes(type);
}

export function avatarProblem(file: Pick<File, 'type' | 'size'>): AvatarProblem | null {
  if (!isAvatarType(file.type)) return 'type';
  return file.size > MAX_AVATAR_BYTES ? 'size' : null;
}
