import { act, renderHook } from '@testing-library/react';
import { useVisibleDay } from './use-visible-day';

const BAR_BOTTOM = 125;

function rectAt(top: number): DOMRect {
  return {
    top,
    bottom: top + 100,
    left: 0,
    right: 0,
    width: 0,
    height: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

function setup(sectionTops: Record<string, number>) {
  const root = document.createElement('div');
  for (const [day, top] of Object.entries(sectionTops)) {
    const section = document.createElement('section');
    section.dataset.day = day;
    section.getBoundingClientRect = () => rectAt(top);
    root.append(section);
  }
  const bar = document.createElement('div');
  bar.getBoundingClientRect = () => rectAt(BAR_BOTTOM - 100);
  document.body.append(root, bar);
  return { container: { current: root }, sticky: { current: bar } };
}

describe('useVisibleDay', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('picks the last day whose heading passed under the week bar', async () => {
    const refs = setup({ '2026-11-14': -300, '2026-11-15': 144 });
    const { result } = renderHook(() => useVisibleDay(refs.container, refs.sticky));
    await act(async () => {});

    expect(result.current).toBe('2026-11-15');
  });

  it('keeps the previous day while the next one is still below the reading line', async () => {
    const refs = setup({ '2026-11-14': -40, '2026-11-15': 400 });
    const { result } = renderHook(() => useVisibleDay(refs.container, refs.sticky));
    await act(async () => {});

    expect(result.current).toBe('2026-11-14');
  });
});
