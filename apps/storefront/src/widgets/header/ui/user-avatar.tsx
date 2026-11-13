import { Avatar } from '@heroui/react';
import type { MeDto } from '@ratingo/web-core/auth';

interface UserAvatarProps {
  user: Pick<MeDto, 'username' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  return (
    <Avatar size={size}>
      {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} alt="" /> : null}
      <Avatar.Fallback>{user.username.slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
}
