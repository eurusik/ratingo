import { act, render } from '@testing-library/react';
import { BrowserBackScrollRestorer } from './browser-back-scroll';

let mockPathname = '/browse/shows-trending';

jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

function scrollWindowTo(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

function goBackTo(url: string): void {
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('BrowserBackScrollRestorer', () => {
  const scrollTo = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    scrollTo.mockClear();
    window.scrollTo = scrollTo;
    mockPathname = '/browse/shows-trending';
    window.history.replaceState(null, '', '/browse/shows-trending?genre=drama');
  });

  afterEach(() => jest.useRealTimers());

  it('returns to where the page was left when going back within the same page', async () => {
    render(<BrowserBackScrollRestorer />);
    scrollWindowTo(900);
    window.history.replaceState(null, '', '/browse/shows-trending?genre=comedy');
    scrollWindowTo(0);

    goBackTo('/browse/shows-trending?genre=drama');
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 900);
  });
});
