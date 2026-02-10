import type { components } from '@ratingo/api-contract';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/avatar';

type RecentRaterDto = components['schemas']['RecentRaterDto'];

interface RecentRatersProps {
  raters: RecentRaterDto[];
}

export function RecentRaters({ raters }: RecentRatersProps) {
  if (!raters || raters.length === 0) return null;

  return (
    <div className="flex -space-x-2" role="group" aria-label="Recent raters">
      {raters.slice(0, 3).map((rater, index) => (
        <Avatar
          key={rater.userId}
          className="w-6 h-6 border-2 border-cinema-bg"
          style={{ zIndex: raters.length - index }}
        >
          {rater.avatarUrl ? <AvatarImage src={rater.avatarUrl} alt={rater.username} /> : null}
          <AvatarFallback className="text-[10px] bg-cinema-elevated text-cinema-text-secondary">
            {rater.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
