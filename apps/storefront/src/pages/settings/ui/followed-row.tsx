import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@heroui/react';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { FollowedTitle } from '../model/followed-titles';

const ROW_FRAME = 'h-[54px] w-24 min-[360px]:h-[63px] min-[360px]:w-28 md:h-[81px] md:w-36';

interface FollowedRowProps {
  title: FollowedTitle;
  onUnfollow: () => void;
}

export function FollowedRow({ title, onUnfollow }: FollowedRowProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.notifications;
  const meta = [copy.types[title.type], ...title.triggers.map((trigger) => copy.triggers[trigger])];

  return (
    <div className="flex min-h-[79px] items-center gap-3 py-2 md:min-h-[97px] md:gap-4">
      <Link
        href={mediaRoute(title.type, title.slug)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:gap-4"
      >
        <span
          aria-hidden
          className={`relative shrink-0 overflow-hidden rounded-[10px] bg-default ${ROW_FRAME}`}
        >
          {title.imageUrl ? (
            <Image
              unoptimized
              src={title.imageUrl}
              alt=""
              width={288}
              height={162}
              loading="lazy"
              className="size-full object-cover object-[center_20%]"
            />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-[15px] leading-tight font-bold md:text-base">
            {title.title}
          </span>
          <span className="truncate text-[13px] text-muted md:text-sm">{meta.join(' · ')}</span>
        </span>
      </Link>
      <Button
        variant="outline"
        size="sm"
        className="h-8.5 shrink-0 rounded-full px-3 text-[13px] md:h-9 md:px-3.5 md:text-sm"
        aria-label={interpolate(copy.unfollowLabel, { title: title.title })}
        onPress={onUnfollow}
      >
        {copy.unfollow}
      </Button>
    </div>
  );
}
