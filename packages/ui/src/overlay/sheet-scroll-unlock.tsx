'use client';

import { useContext, useEffect, useRef } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';
import { blurFocusedInputWithin } from './blur-focused-input';
import { startManualScrollHandoff, type ManualScrollHandoff } from './manual-scroll-handoff';
import { startSheetPullDown, type SheetPullDown } from './sheet-pull-down';
import { startSheetTopGesture, type SheetTopGesture } from './sheet-top-gesture';

const FULLY_OPEN_ATTRIBUTE = 'data-fully-open';
const FULLY_OPEN_TOP_RATIO = 0.15;
const SETTLED_TOP_PX = 1;
const HANDLE_SELECTOR = '.sheet__handle';
const NO_SWIPE_SELECTOR = '[data-noswipe]';
const HEADER_SELECTOR = '.sheet__header';
const SETTLING_WINDOW_MS = 120;
const KEYBOARD_DISMISS_TRAVEL_PX = 8;

interface SheetParts {
  dialog: HTMLElement;
  content: HTMLElement;
  scroller: HTMLElement;
}

function findSheetParts(marker: HTMLElement | null): SheetParts | null {
  const dialog = marker?.closest<HTMLElement>('.sheet__dialog');
  const content = dialog?.closest<HTMLElement>('.sheet__content');
  const scroller = content?.closest<HTMLElement>('[data-sheet-scroll]');
  return dialog && content && scroller ? { dialog, content, scroller } : null;
}

function dialogTop(parts: SheetParts): number {
  return parts.dialog.getBoundingClientRect().top;
}

function restingTop(parts: SheetParts): number {
  return Math.max(0, window.innerHeight - parts.dialog.offsetHeight);
}

function distanceToOpen(parts: SheetParts): number {
  return dialogTop(parts) - restingTop(parts);
}

function isFullyOpen(parts: SheetParts): boolean {
  return distanceToOpen(parts) <= window.innerHeight * FULLY_OPEN_TOP_RATIO;
}

function settleAtTop(parts: SheetParts) {
  parts.scroller.scrollTop += distanceToOpen(parts);
}

export function SheetScrollUnlock() {
  const markerRef = useRef<HTMLSpanElement>(null);
  const overlay = useContext(OverlayTriggerStateContext);
  const isOpen = overlay?.isOpen ?? true;
  const close = overlay?.close;

  useEffect(() => {
    const parts = () => findSheetParts(markerRef.current);
    let handoff: ManualScrollHandoff | null = null;
    let pullDown: SheetPullDown | null = null;
    let topGesture: SheetTopGesture | null = null;
    let releasing: Array<{ cancel(): void }> = [];
    let lastSheetScrollAt = 0;
    let touchStartY: number | null = null;

    const update = (event?: Event) => {
      const sheet = parts();
      if (!sheet) return;

      const distance = distanceToOpen(sheet);
      if (event?.target === sheet.scroller && Math.abs(distance) > SETTLED_TOP_PX) {
        lastSheetScrollAt = performance.now();
      }
      if (isOpen && distance < -SETTLED_TOP_PX) sheet.scroller.scrollTop += distance;
      const fullyOpen = isOpen && isFullyOpen(sheet);
      sheet.content.toggleAttribute(FULLY_OPEN_ATTRIBUTE, fullyOpen);
    };

    const stopActiveGestures = () => {
      topGesture?.cancel();
      topGesture = null;
      pullDown?.cancel();
      pullDown = null;
      handoff?.cancel();
      handoff = null;
    };

    const stopAllGestures = () => {
      stopActiveGestures();
      releasing.forEach((gesture) => gesture.cancel());
      releasing = [];
    };

    const onTouchStart = (event: TouchEvent) => {
      const sheet = parts();
      if (!sheet || !isOpen || !(event.target instanceof Element)) return;
      if (!sheet.dialog.contains(event.target)) return;
      stopAllGestures();
      const touch = event.touches[0];
      const startsOnFocusedField = document.activeElement?.contains(event.target) ?? false;
      touchStartY = touch && !startsOnFocusedField ? touch.clientY : null;
      if (event.target.closest(NO_SWIPE_SELECTOR) || event.target.closest(HANDLE_SELECTOR)) return;
      if (!touch) return;
      if (!isFullyOpen(sheet)) {
        pullDown = startSheetPullDown(sheet.scroller, touch.clientY, () => close?.(), true);
        return;
      }
      const body = sheet.dialog.querySelector<HTMLElement>('.sheet__body');
      const isSettling =
        distanceToOpen(sheet) > SETTLED_TOP_PX ||
        performance.now() - lastSheetScrollAt < SETTLING_WINDOW_MS;
      const onHeader = !!event.target.closest(HEADER_SELECTOR);
      if (isSettling) {
        settleAtTop(sheet);
        if (!onHeader && body) handoff = startManualScrollHandoff(body, touch.clientY);
        return;
      }
      if (!onHeader && (body?.scrollTop ?? 0) > 0) return;
      settleAtTop(sheet);
      topGesture = startSheetTopGesture(
        sheet.scroller,
        onHeader ? null : body,
        touch.clientY,
        () => close?.(),
      );
    };

    const dismissKeyboardOnDrag = (touch: Touch | undefined) => {
      if (touchStartY === null || !touch) return;
      if (Math.abs(touch.clientY - touchStartY) < KEYBOARD_DISMISS_TRAVEL_PX) return;
      touchStartY = null;
      const sheet = parts();
      if (sheet) blurFocusedInputWithin(sheet.dialog);
    };

    const onTouchMove = (event: TouchEvent) => {
      dismissKeyboardOnDrag(event.touches[0]);
      topGesture?.move(event);
      pullDown?.move(event);
      const touch = event.touches[0];
      if (handoff && touch) {
        if (event.cancelable) event.preventDefault();
        handoff.move(touch.clientY);
      }
    };

    const onTouchEnd = () => {
      touchStartY = null;
      topGesture?.end();
      pullDown?.end();
      handoff?.end();
      releasing = [topGesture, pullDown, handoff].filter((gesture) => gesture !== null);
      topGesture = null;
      pullDown = null;
      handoff = null;
    };

    update();
    document.addEventListener('scroll', update, { capture: true, passive: true });
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('scroll', update, { capture: true });
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
      document.removeEventListener('touchend', onTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      stopActiveGestures();
      window.removeEventListener('resize', update);
      const sheet = parts();
      if (!sheet) return;
      sheet.content.removeAttribute(FULLY_OPEN_ATTRIBUTE);
    };
  }, [isOpen, close]);

  return <span ref={markerRef} hidden />;
}
