'use client';

import { useId, useRef, useState, type ComponentType, type RefObject } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useSaveToggle } from '../model/save-toggle';
import {
  SaveIcon,
  saveButtonClass,
  saveButtonLabel,
  type SaveButtonProps,
} from './save-button-parts';
import type { SaveMenuButtonProps } from './save-menu-button';
import { useMenuIntent, type MenuIntent } from './use-menu-intent';

const HEROUI_ICON_TOGGLE_BUTTON =
  'toggle-button toggle-button--icon-only toggle-button--md toggle-button--default';

type Handoff = Pick<SaveMenuButtonProps, 'autoFocus' | 'defaultOpen'>;

const HANDOFF_BY_INTENT: Record<MenuIntent, Handoff> = {
  hover: { autoFocus: false, defaultOpen: false },
  focus: { autoFocus: true, defaultOpen: false },
  longPress: { autoFocus: false, defaultOpen: true },
  shortcut: { autoFocus: true, defaultOpen: true },
};

interface LoadedMenuButton {
  MenuButton: ComponentType<SaveMenuButtonProps>;
  handoff: Handoff;
}

export const preloadSaveMenuButton = () =>
  import('./save-menu-button').then((module) => module.SaveMenuButton);

export function SaveButton({ media, tone = 'surface' }: SaveButtonProps) {
  const [loaded, setLoaded] = useState<LoadedMenuButton | null>(null);
  const instantButtonRef = useRef<HTMLButtonElement>(null);
  const latestIntent = useRef<MenuIntent | null>(null);

  if (loaded) {
    const { MenuButton, handoff } = loaded;
    return <MenuButton media={media} tone={tone} {...handoff} />;
  }

  const swapToMenuButton = (intent: MenuIntent) => {
    const isLoading = latestIntent.current !== null;
    latestIntent.current = intent;
    if (isLoading) return;
    void preloadSaveMenuButton().then(
      (MenuButton) => {
        const handoff = HANDOFF_BY_INTENT[latestIntent.current ?? intent];
        const stillFocused = document.activeElement === instantButtonRef.current;
        setLoaded({
          MenuButton,
          handoff: { ...handoff, autoFocus: handoff.autoFocus && stillFocused },
        });
      },
      () => {
        latestIntent.current = null;
      },
    );
  };

  return (
    <InstantSaveButton
      buttonRef={instantButtonRef}
      media={media}
      tone={tone}
      onMenuIntent={swapToMenuButton}
    />
  );
}

interface InstantSaveButtonProps extends Required<SaveButtonProps> {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onMenuIntent: (intent: MenuIntent) => void;
}

function InstantSaveButton({ buttonRef, media, tone, onMenuIntent }: InstantSaveButtonProps) {
  const { dict } = useTranslation();
  const hintId = useId();
  const { saved, toggle } = useSaveToggle(media);
  const intentHandlers = useMenuIntent({ onIntent: onMenuIntent, onActivate: toggle });

  return (
    <button
      ref={buttonRef}
      type="button"
      data-slot="toggle-button"
      data-selected={saved || undefined}
      aria-pressed={saved}
      aria-label={saveButtonLabel(dict, media.title)}
      aria-describedby={hintId}
      className={`${HEROUI_ICON_TOGGLE_BUTTON} ${saveButtonClass(tone)}`}
      {...intentHandlers}
    >
      <SaveIcon saved={saved} />
      <span id={hintId} hidden>
        {dict.saveToLibrary.menu.hint}
      </span>
    </button>
  );
}
