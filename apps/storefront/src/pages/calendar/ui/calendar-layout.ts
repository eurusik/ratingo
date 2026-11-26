import type { CalendarMediaType } from '@/shared/api';

export const CALENDAR_ROOT = 'flex flex-1 flex-col pt-(--safe-top) md:pt-0';

export const STATUS_BAR_BACKDROP =
  'pointer-events-none fixed inset-x-0 top-0 z-30 h-(--safe-top) bg-background md:hidden';

export const HEADER_ROW =
  'md:flex md:flex-wrap md:items-center md:gap-x-5 md:gap-y-3 md:border-b md:border-separator md:pb-4';

export const PHONE_TYPE_ROW = 'pt-1 pb-2 md:hidden';

export const MODE_PILL = 'min-h-tap shrink-0 rounded-full px-4 transition-none md:min-h-10';

const MODE_PILLS_SKELETON_WIDTH = {
  show: 'w-56',
  movie: 'w-32',
} as const satisfies Record<CalendarMediaType, string>;

export function modePillsSkeleton(type: CalendarMediaType): string {
  return `h-11 ${MODE_PILLS_SKELETON_WIDTH[type]} shrink-0 rounded-full md:h-10`;
}

export const INFO_BUTTON_SIZE = '-ms-3 size-11 shrink-0 rounded-full';

export const WEEK_BAR_FRAME =
  'flex flex-col gap-2.5 border-b border-separator px-4 pt-1 pb-3 md:px-0 md:pt-4';

export const WEEK_BAR_STICKY =
  'sticky top-(--safe-top) z-20 bg-background/90 backdrop-blur-xl md:top-16';

export const WEEK_BAR_STUCK_GAP = 'mb-5 md:mb-3';

export const WEEK_TITLE_TEXT = 'truncate text-[17px] leading-tight font-extrabold md:text-xl';

export const WEEK_SPAN_TEXT = 'truncate text-[13px] text-muted tabular-nums md:text-xs';

export const WEEK_HEADER_ROW = 'relative flex min-h-11 items-center gap-1.5';

export const WEEK_ARROW_SIZE = 'size-8 rounded-full pointer-coarse:size-11';

export const PHONE_ARROWS_OVERLAY =
  'flex items-center gap-1.5 max-md:absolute max-md:inset-y-0 max-md:end-11 max-md:has-focus-visible:bg-background';

export const PHONE_MONTH_LABEL = 'min-w-0 flex-1 text-end text-sm font-medium text-muted md:hidden';

export const TODAY_ICON_BUTTON = '-me-1.5 size-11 shrink-0 rounded-full md:hidden';

export const TODAY_ICON_FRAME =
  'relative flex size-7.5 flex-col items-center justify-center rounded-[9px] border pt-1 text-xs font-bold tabular-nums before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:rounded-t-[8px]';

export const DESKTOP_TODAY_BUTTON =
  'hidden h-8 rounded-full px-3 text-sm font-semibold text-accent md:inline-flex';

export const WEEK_STRIP_SCROLLER =
  'relative flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain px-6 [scrollbar-width:none] md:gap-0 md:px-0 [&::-webkit-scrollbar]:hidden';

export const WEEK_STRIP_PANE = 'relative shrink-0 basis-full snap-center snap-always';

const DAY_TILE_HEIGHT = { regular: 'h-17.5 md:h-14', compact: 'h-12.5 md:h-11' } as const;

export function dayTileHeight(isCompact: boolean): string {
  return DAY_TILE_HEIGHT[isCompact ? 'compact' : 'regular'];
}

export const DAY_STRIP = 'grid grid-cols-7 gap-0.5 md:gap-2';

export const DAY_SECTION =
  'px-4 pt-4.5 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 md:border-t md:border-separator md:px-0 md:py-4.5';

export const DAY_HEADING_TEXT = 'text-[17px] font-extrabold md:text-xl';

export const RELEASE_LIST = 'flex flex-col md:grid md:grid-cols-2 md:gap-3.5 xl:grid-cols-3';

export const MORE_MOVIES_TEXT = 'pt-2.5 text-sm text-muted md:pt-3';

export const RELEASE_ROW =
  'flex items-center gap-3 border-b border-separator py-2 md:rounded-2xl md:border-0 md:bg-surface md:p-2.5';

export const CALENDAR_LIST = 'flex flex-1 flex-col';

export const NOTICE_AREA = 'flex flex-1 flex-col justify-center px-4 py-8 md:items-center md:px-0';

export const PROMPT_CARD = 'gap-3 rounded-3xl p-4.5 md:w-full md:max-w-xl';

export const PROMPT_BUTTON = 'h-12 flex-1 rounded-full text-[15px] font-bold';

export const DASHED_NOTE =
  'flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-4 py-5 text-center md:w-full md:max-w-xl';
