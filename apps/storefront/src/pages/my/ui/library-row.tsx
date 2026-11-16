import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Meter } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { EventBadge, type MediaEvent } from '@/entities/media';
import { mediaRoute } from '@/shared/config';
import type { LibraryTitle } from '../model/library-title';

export const ROW_FRAME = 'h-[54px] w-24 min-[360px]:h-[63px] min-[360px]:w-28 md:h-[81px] md:w-36';

const HOVER_REVEAL =
  'transition-opacity motion-reduce:transition-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:has-[[aria-expanded=true]]:opacity-100';

interface RowProgress {
  value: number;
  max: number;
  label: string;
}

interface LibraryRowProps {
  title: LibraryTitle;
  meta: ReactNode;
  href?: string;
  event?: MediaEvent;
  code?: string;
  progress?: RowProgress;
  action?: ReactNode;
  menu?: ReactNode;
  isEager?: boolean;
}

function RowFrame({
  title,
  event,
  code,
  isEager,
}: Pick<LibraryRowProps, 'title' | 'event' | 'code' | 'isEager'>) {
  return (
    <span
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden rounded-[10px] bg-default', ROW_FRAME)}
    >
      {title.imageUrl ? (
        <Image
          unoptimized
          src={title.imageUrl}
          alt=""
          width={288}
          height={162}
          loading={isEager ? 'eager' : 'lazy'}
          className="size-full object-cover object-[center_20%]"
        />
      ) : null}
      {event ? (
        <span className="absolute start-1.5 top-1.5">
          <EventBadge event={event} />
        </span>
      ) : null}
      {code ? (
        <span className="absolute start-1.5 bottom-1.5 inline-flex h-5 items-center rounded-md bg-black/80 px-1.5 text-xs font-extrabold text-white tabular-nums">
          {code}
        </span>
      ) : null}
    </span>
  );
}

export function LibraryRow({
  title,
  meta,
  href = mediaRoute(title.type, title.slug),
  event,
  code,
  progress,
  action,
  menu,
  isEager = false,
}: LibraryRowProps) {
  return (
    <div className="group/row flex min-h-[79px] items-center gap-3 py-2 md:min-h-[97px] md:gap-4">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:gap-4"
      >
        <RowFrame title={title} event={event} code={code} isEager={isEager} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-[15px] leading-tight font-bold md:text-base">
            {title.title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-muted tabular-nums md:text-sm">
            {typeof meta === 'string' ? <span className="truncate">{meta}</span> : meta}
          </span>
          {progress ? (
            <Meter
              aria-label={progress.label}
              value={progress.value}
              maxValue={Math.max(progress.max, 1)}
              size="sm"
              className="mt-0.5 max-w-48"
            >
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
          ) : null}
        </div>
      </Link>
      {action}
      {menu ? <span className={cn('flex', HOVER_REVEAL)}>{menu}</span> : null}
    </div>
  );
}
