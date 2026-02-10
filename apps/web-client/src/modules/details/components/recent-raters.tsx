'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/avatar';

interface Rater {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

interface RecentRatersProps {
  raters: Rater[];
}

export function RecentRaters({ raters }: RecentRatersProps) {
  if (!raters || raters.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {raters.map((rater, index) => (
        <Avatar
          key={rater.userId}
          className="w-6 h-6 border-2 border-cinema-bg"
          style={{ zIndex: raters.length - index }}
        >
          {rater.avatarUrl && <AvatarImage src={rater.avatarUrl} alt={rater.username} />}
          <AvatarFallback className="text-[10px] bg-cinema-elevated text-cinema-text-secondary">
            {rater.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
