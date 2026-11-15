import {
  railMemoryMarker,
  rememberScroll,
  restoreRememberedRailScroll,
  restoreRememberedScroll,
} from './scroll-memory';

function scrollWindowTo(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

describe('scroll memory', () => {
  const scrollTo = jest.fn();

  beforeEach(() => {
    scrollTo.mockClear();
    window.scrollTo = scrollTo;
    window.history.replaceState(null, '', '/browse/shows-trending?genre=drama');
  });

  it('restores the position remembered for the same page and filters', () => {
    scrollWindowTo(840);
    rememberScroll();

    restoreRememberedScroll();

    expect(scrollTo).toHaveBeenCalledWith(0, 840);
  });

  it('restores a remembered position only once', () => {
    scrollWindowTo(840);
    rememberScroll();

    restoreRememberedScroll();
    restoreRememberedScroll();

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('keeps positions apart for different filters', () => {
    scrollWindowTo(840);
    rememberScroll();
    window.history.replaceState(null, '', '/browse/shows-trending?genre=comedy');

    restoreRememberedScroll();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('rail scroll memory', () => {
  function railScrolledTo(railKey: string, x: number): HTMLElement {
    const rail = document.createElement('div');
    Object.entries(railMemoryMarker(railKey)).forEach(([name, value]) =>
      rail.setAttribute(name, value),
    );
    rail.scrollLeft = x;
    document.body.append(rail);
    return rail;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    window.scrollTo = jest.fn();
    window.history.replaceState(null, '', '/');
  });

  it('brings a rail back to where it was when the page was left', () => {
    railScrolledTo('new-releases:nowPlaying', 640);
    rememberScroll();
    const remounted = document.createElement('div');

    restoreRememberedRailScroll(remounted, 'new-releases:nowPlaying');

    expect(remounted.scrollLeft).toBe(640);
  });

  it('leaves a rail alone when another list of it was showing', () => {
    railScrolledTo('new-releases:nowPlaying', 640);
    rememberScroll();
    const remounted = document.createElement('div');

    restoreRememberedRailScroll(remounted, 'new-releases:newOnDigital');

    expect(remounted.scrollLeft).toBe(0);
  });
});
