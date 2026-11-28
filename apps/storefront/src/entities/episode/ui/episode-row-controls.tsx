'use client';

import { useRef, type MouseEvent } from 'react';
import { mergeProps, useButton, useLongPress } from 'react-aria';
import { ToggleButton } from '@heroui/react';
import { Check, ChevronRight, Info } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';

const ROW_OVERLAY = 'absolute inset-0 flex items-center rounded-2xl';

function CheckMark({
  isOn,
  previewsOnHover = false,
}: {
  isOn: boolean;
  previewsOnHover?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
        isOn ? 'border-accent bg-accent text-accent-foreground' : 'border-muted/40',
        !isOn && previewsOnHover && 'group-hover/row:border-accent',
      )}
    >
      {isOn ? <Check className="size-5" strokeWidth={2.8} /> : null}
      {!isOn && previewsOnHover ? (
        <Check
          className="size-5 text-accent opacity-0 transition-opacity group-hover/row:opacity-60"
          strokeWidth={2.8}
        />
      ) : null}
    </span>
  );
}

const PICK_OVERLAY =
  'absolute inset-0 h-auto w-auto justify-end rounded-2xl px-0 pe-2 transform-none active:transform-none data-[pressed=true]:transform-none [--toggle-button-bg-hover:transparent] [--toggle-button-bg-pressed:transparent] [--toggle-button-bg-selected-hover:transparent] [--toggle-button-bg-selected-pressed:transparent] [--toggle-button-bg-selected:transparent] [--toggle-button-fg-selected:currentColor] [&_svg]:size-5';

interface PickToggleProps {
  label: string;
  isMarked: boolean;
  isDisabled: boolean;
  onPick: () => void;
}

export function PickToggle({ label, isMarked, isDisabled, onPick }: PickToggleProps) {
  return (
    <ToggleButton
      variant="ghost"
      aria-label={label}
      isSelected={isMarked}
      isDisabled={isDisabled}
      onChange={onPick}
      className={PICK_OVERLAY}
    >
      <CheckMark isOn={isMarked} />
    </ToggleButton>
  );
}

interface WatchedButtonProps {
  label: string;
  isWatched: boolean;
  onWatchedChange: (watched: boolean) => void;
  onMenu?: (anchor: Element) => void;
}

export function WatchedButton({ label, isWatched, onWatchedChange, onMenu }: WatchedButtonProps) {
  const { dict } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ onPress: () => onWatchedChange(!isWatched) }, ref);
  const { longPressProps } = useLongPress({
    isDisabled: onMenu === undefined,
    pointerType: 'touch',
    accessibilityDescription: dict.episodes.detail.menuHint,
    onLongPress: (event) => onMenu?.(event.target),
  });
  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onMenu) return;
    event.preventDefault();
    onMenu(event.currentTarget);
  };

  return (
    <button
      {...mergeProps(buttonProps, longPressProps)}
      ref={ref}
      aria-label={label}
      aria-pressed={isWatched}
      onContextMenu={openMenu}
      className={cn(
        ROW_OVERLAY,
        'group/row cursor-pointer justify-end pe-2 transition-colors select-none [-webkit-touch-callout:none] hover:bg-default/40',
      )}
    >
      <CheckMark isOn={isWatched} previewsOnHover />
    </button>
  );
}

interface StillDetailButtonProps {
  label: string;
  onOpen: () => void;
  onIntent?: () => void;
}

export function StillDetailButton({ label, onOpen, onIntent }: StillDetailButtonProps) {
  const { dict } = useTranslation();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onOpen}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      className="group/still absolute top-[3px] left-[81px] z-10 flex size-11 cursor-pointer items-start justify-end rounded-[10px] p-[9px] pointer-fine:top-2 pointer-fine:left-2 pointer-fine:h-[63px] pointer-fine:w-28 pointer-fine:p-1"
    >
      <span
        aria-hidden
        className="absolute inset-0 hidden items-center justify-center rounded-[10px] bg-black/60 opacity-0 transition-opacity pointer-fine:flex group-hover/still:opacity-100 group-focus-visible/still:opacity-100"
      >
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/15 ps-1.5 pe-2.5 text-[13px] font-bold text-white">
          <Info className="size-4" />
          {dict.episodes.detail.describe}
        </span>
      </span>
      <span
        aria-hidden
        className="relative flex size-6.5 items-center justify-center rounded-full bg-black/70 text-white transition-opacity group-hover/still:opacity-0"
      >
        <Info className="size-4" strokeWidth={2.2} />
      </span>
    </button>
  );
}

interface OpenRowButtonProps {
  label: string;
  onOpen: () => void;
  onIntent?: () => void;
}

export function OpenRowButton({ label, onOpen, onIntent }: OpenRowButtonProps) {
  const { dict } = useTranslation();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onOpen}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      className={cn(
        ROW_OVERLAY,
        'cursor-pointer justify-end pe-2 transition-colors hover:bg-default/40',
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-8 items-center gap-0.5 ps-2.5 pe-1 text-[13px] font-semibold text-muted"
      >
        {dict.episodes.detail.describe}
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}
