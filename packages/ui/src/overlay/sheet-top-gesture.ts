import { startManualScrollHandoff, type ManualScrollHandoff } from './manual-scroll-handoff';
import { startSheetPullDown, type SheetPullDown } from './sheet-pull-down';

const DIRECTION_THRESHOLD_PX = 3;

export interface SheetTopGesture {
  move(event: TouchEvent): void;
  end(): void;
  cancel(): void;
}

export function startSheetTopGesture(
  scroller: HTMLElement,
  body: HTMLElement | null,
  startY: number,
  onDismiss: () => void,
): SheetTopGesture {
  let pullDown: SheetPullDown | null = null;
  let scroll: ManualScrollHandoff | null = null;

  return {
    move(event) {
      const touch = event.touches[0];
      if (!touch) return;
      if (!pullDown && !scroll) {
        const travel = touch.clientY - startY;
        if (Math.abs(travel) < DIRECTION_THRESHOLD_PX) {
          if (event.cancelable) event.preventDefault();
          return;
        }
        if (travel > 0) pullDown = startSheetPullDown(scroller, startY, onDismiss);
        else if (body) scroll = startManualScrollHandoff(body, startY);
      }
      if (pullDown) {
        pullDown.move(event);
        return;
      }
      if (scroll) {
        if (event.cancelable) event.preventDefault();
        scroll.move(touch.clientY);
      }
    },
    end() {
      pullDown?.end();
      scroll?.end();
    },
    cancel() {
      pullDown?.cancel();
      scroll?.cancel();
    },
  };
}
