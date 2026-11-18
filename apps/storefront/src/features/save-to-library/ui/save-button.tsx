'use client';

import {
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { toggleButtonVariants } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useSaveToggle } from '../model/save-toggle';
import { SAVE_BUTTON_CLASS, TONE_CLASSES, type SaveButtonProps } from './save-button-look';
import type { SaveMenuButtonProps } from './save-menu-button';
import { useLongPress } from './use-long-press';

const MENU_SHORTCUT_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);
const LOOK = toggleButtonVariants({ isIconOnly: true });

type Handoff = Pick<SaveMenuButtonProps, 'autoFocus' | 'defaultOpen'>;

interface LoadedMenuButton {
  MenuButton: ComponentType<SaveMenuButtonProps>;
  handoff: Handoff;
}

export const preloadSaveMenuButton = () =>
  import('./save-menu-button').then((module) => module.SaveMenuButton);

export function SaveButton({ media, tone = 'surface' }: SaveButtonProps) {
  const [loaded, setLoaded] = useState<LoadedMenuButton | null>(null);

  if (loaded) {
    const { MenuButton, handoff } = loaded;
    return <MenuButton media={media} tone={tone} {...handoff} />;
  }

  const handOff = (handoff: Handoff) => {
    void preloadSaveMenuButton().then((MenuButton) => setLoaded({ MenuButton, handoff }));
  };

  return <InstantSaveButton media={media} tone={tone} onHandOff={handOff} />;
}

interface InstantSaveButtonProps extends SaveButtonProps {
  onHandOff: (handoff: Handoff) => void;
}

function InstantSaveButton({ media, tone = 'surface', onHandOff }: InstantSaveButtonProps) {
  const { dict } = useTranslation();
  const hintId = useId();
  const { saved, toggle } = useSaveToggle(media);
  const pointerIsDown = useRef(false);
  const longPress = useLongPress(() => onHandOff({ autoFocus: false, defaultOpen: true }));

  const onPointerDown = () => {
    pointerIsDown.current = true;
    longPress.start();
  };

  const onPointerEnd = () => {
    pointerIsDown.current = false;
    longPress.cancel();
  };

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') onHandOff({ autoFocus: false, defaultOpen: false });
  };

  const onFocus = () => {
    if (!pointerIsDown.current) onHandOff({ autoFocus: true, defaultOpen: false });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.altKey || !MENU_SHORTCUT_KEYS.has(event.key)) return;
    event.preventDefault();
    onHandOff({ autoFocus: true, defaultOpen: true });
  };

  const onClick = () => {
    if (!longPress.consumeLongPress()) toggle();
  };

  return (
    <button
      type="button"
      data-slot="toggle-button"
      data-selected={saved || undefined}
      aria-pressed={saved}
      aria-label={interpolate(dict.saveToLibrary.save, { title: media.title })}
      aria-describedby={hintId}
      className={`${LOOK} ${SAVE_BUTTON_CLASS} ${TONE_CLASSES[tone]}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onContextMenu={(event) => {
        if (longPress.isPressing()) event.preventDefault();
      }}
    >
      {saved ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
      <span id={hintId} hidden>
        {dict.saveToLibrary.menu.hint}
      </span>
    </button>
  );
}
