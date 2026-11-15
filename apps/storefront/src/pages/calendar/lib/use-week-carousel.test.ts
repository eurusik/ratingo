import { act, renderHook } from '@testing-library/react';
import { useWeekCarousel } from './use-week-carousel';

const PANE_WIDTH = 300;

function scrollerWithPanes(): HTMLDivElement {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'clientWidth', { value: PANE_WIDTH });
  Object.defineProperty(scroller, 'scrollWidth', { value: PANE_WIDTH * 3 });
  for (let pane = 0; pane < 3; pane += 1) {
    const element = document.createElement('div');
    Object.defineProperty(element, 'offsetLeft', { value: pane * PANE_WIDTH });
    Object.defineProperty(element, 'offsetWidth', { value: PANE_WIDTH });
    scroller.append(element);
  }
  scroller.scrollTo = (options?: ScrollToOptions | number) => {
    if (typeof options === 'object' && options.left !== undefined)
      scroller.scrollLeft = options.left;
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scrollend'));
  };
  document.body.append(scroller);
  return scroller;
}

function renderCarousel(onStep: jest.Mock<boolean, [number]>) {
  const scroller = scrollerWithPanes();
  const hook = renderHook(
    ({ week }) => {
      const carousel = useWeekCarousel(week, onStep);
      carousel.scroller.current ??= scroller;
      return carousel;
    },
    { initialProps: { week: '2026-11-09' } },
  );
  return { ...hook, scroller };
}

describe('useWeekCarousel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('previews the week under the finger and commits it once scrolling settles', () => {
    const onStep = jest.fn((_step: number) => true);
    const { result, scroller } = renderCarousel(onStep);

    act(() => {
      scroller.scrollLeft = PANE_WIDTH * 2;
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.previewStep).toBe(1);
    expect(onStep).not.toHaveBeenCalled();

    act(() => {
      scroller.dispatchEvent(new Event('scrollend'));
    });
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('waits for the finger to lift before committing', () => {
    const onStep = jest.fn((_step: number) => true);
    const { scroller } = renderCarousel(onStep);

    act(() => {
      scroller.dispatchEvent(new Event('touchstart'));
      scroller.scrollLeft = 0;
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scrollend'));
    });
    expect(onStep).not.toHaveBeenCalled();

    jest.useFakeTimers();
    act(() => {
      scroller.dispatchEvent(new Event('touchend'));
      jest.runAllTimers();
    });
    jest.useRealTimers();
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it('slides to the neighbour week from the arrow buttons', () => {
    const onStep = jest.fn((_step: number) => true);
    const { result } = renderCarousel(onStep);

    act(() => result.current.slideTo(-1));

    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it('keeps committing swipes after returning to a week without the strip', () => {
    const onStep = jest.fn((_step: number) => true);
    const { scroller, rerender } = renderCarousel(onStep);
    const swipeNext = () =>
      act(() => {
        scroller.scrollLeft = PANE_WIDTH * 2;
        scroller.dispatchEvent(new Event('scroll'));
        scroller.dispatchEvent(new Event('scrollend'));
      });

    swipeNext();
    rerender({ week: '2026-11-16' });
    rerender({ week: '2026-11-09' });
    swipeNext();

    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('queues arrow presses made while the strip is still sliding', () => {
    jest.useFakeTimers();
    const onStep = jest.fn((_step: number) => true);
    const { result, rerender } = renderCarousel(onStep);

    act(() => {
      result.current.slideTo(1);
      result.current.slideTo(1);
    });
    expect(onStep).toHaveBeenCalledTimes(1);

    rerender({ week: '2026-11-16' });
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();

    expect(onStep).toHaveBeenCalledTimes(2);
  });
});
