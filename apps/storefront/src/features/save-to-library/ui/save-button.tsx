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

const OPENS_MENU: Record<MenuIntent, boolean> = {
  hover: false,
  focus: false,
  longPress: true,
  shortcut: true,
};

interface LoadedMenuButton {
  MenuButton: ComponentType<SaveMenuButtonProps>;
  handoff: Pick<SaveMenuButtonProps, 'autoFocus' | 'defaultOpen'>;
}

type MenuButtonComponent = LoadedMenuButton['MenuButton'];

export const preloadSaveMenuButton = () =>
  import('./save-menu-button').then((module) => module.SaveMenuButton);

export function SaveButton({ media, tone = 'surface' }: SaveButtonProps) {
  const [loaded, setLoaded] = useState<LoadedMenuButton | null>(null);
  const instantButtonRef = useRef<HTMLButtonElement>(null);
  const pointerGestureRef = useRef(false);
  const isLoadingMenuButton = useRef(false);
  const wantsOpenMenu = useRef(false);
  const deferredMenuButton = useRef<MenuButtonComponent | null>(null);

  if (loaded) {
    const { MenuButton, handoff } = loaded;
    return <MenuButton media={media} tone={tone} {...handoff} />;
  }

  const showMenuButton = (MenuButton: MenuButtonComponent) => {
    setLoaded({
      MenuButton,
      handoff: {
        autoFocus: document.activeElement === instantButtonRef.current,
        defaultOpen: wantsOpenMenu.current,
      },
    });
  };

  const showMenuButtonUnlessPressed = (MenuButton: MenuButtonComponent) => {
    if (pointerGestureRef.current && !wantsOpenMenu.current) {
      deferredMenuButton.current = MenuButton;
      return;
    }
    showMenuButton(MenuButton);
  };

  const showDeferredMenuButton = () => {
    const MenuButton = deferredMenuButton.current;
    deferredMenuButton.current = null;
    if (MenuButton) showMenuButton(MenuButton);
  };

  const swapToMenuButton = (intent: MenuIntent) => {
    wantsOpenMenu.current ||= OPENS_MENU[intent];
    if (isLoadingMenuButton.current) return;
    isLoadingMenuButton.current = true;
    void preloadSaveMenuButton().then(showMenuButtonUnlessPressed, () => {
      isLoadingMenuButton.current = false;
    });
  };

  return (
    <InstantSaveButton
      buttonRef={instantButtonRef}
      media={media}
      tone={tone}
      pointerGestureRef={pointerGestureRef}
      onMenuIntent={swapToMenuButton}
      onGestureEnd={showDeferredMenuButton}
    />
  );
}

interface InstantSaveButtonProps extends Required<SaveButtonProps> {
  buttonRef: RefObject<HTMLButtonElement | null>;
  pointerGestureRef: RefObject<boolean>;
  onMenuIntent: (intent: MenuIntent) => void;
  onGestureEnd: () => void;
}

function InstantSaveButton({
  buttonRef,
  media,
  tone,
  pointerGestureRef,
  onMenuIntent,
  onGestureEnd,
}: InstantSaveButtonProps) {
  const { dict } = useTranslation();
  const hintId = useId();
  const { saved, toggle } = useSaveToggle(media);
  const intentHandlers = useMenuIntent({
    onIntent: onMenuIntent,
    onActivate: toggle,
    onGestureEnd,
    pointerGestureRef,
  });

  return (
    <button
      ref={buttonRef}
      type="button"
      data-slot="toggle-button"
      data-selected={saved || undefined}
      aria-pressed={saved}
      aria-haspopup
      aria-expanded={false}
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
