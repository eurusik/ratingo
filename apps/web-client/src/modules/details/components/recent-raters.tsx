import type { components } from '@ratingo/api-contract';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/avatar';

type RecentRaterDto = components['schemas']['RecentRaterDto'];

const MAX_VISIBLE = 3;

interface RecentRatersProps {
  raters: RecentRaterDto[];
  totalCount?: number;
}

export function RecentRaters({ raters, totalCount }: RecentRatersProps) {
  if (!raters || raters.length === 0) return null;

  const MAX_OVERFLOW_DISPLAY = 99;
  const overflow = (totalCount ?? raters.length) - MAX_VISIBLE;
  const overflowLabel = overflow > MAX_OVERFLOW_DISPLAY ? `+${MAX_OVERFLOW_DISPLAY}` : `+${overflow}`;

  return (
    <div className="flex -space-x-2" role="group" aria-label="Recent raters">
      {raters.slice(0, MAX_VISIBLE).map((rater, index) => (
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
      {overflow > 0 ? (
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-cinema-bg bg-cinema-elevated text-[9px] font-medium text-cinema-text-secondary"
          aria-label={`+${overflow} more`}
        >
          {overflowLabel}
        </div>
      ) : null}
    </div>
  );
}
