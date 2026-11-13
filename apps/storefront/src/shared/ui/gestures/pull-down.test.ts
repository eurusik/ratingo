import { attachPullDown } from './pull-down';

const STEP_MS = 100;
let clock = 0;

function touch(target: Element, type: string, clientY: number, clientX = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  clock += STEP_MS;
  Object.defineProperty(event, 'timeStamp', { value: clock });
  Object.assign(event, { touches: type === 'touchend' ? [] : [{ clientX, clientY }] });
  target.dispatchEvent(event);
  return event;
}

function pull(target: Element, distance: number, dx = 0) {
  touch(target, 'touchstart', 0);
  touch(target, 'touchmove', distance / 2, dx / 2);
  const move = touch(target, 'touchmove', distance, dx);
  touch(target, 'touchend', distance);
  return move;
}

function mount(onRelease: () => Promise<void>) {
  const root = document.createElement('div');
  const content = document.createElement('div');
  const indicator = document.createElement('div');
  root.append(indicator, content);
  document.body.append(root);
  const detach = attachPullDown({ root, content, indicator, onRelease });
  return { root, content, detach };
}

describe('attachPullDown', () => {
  beforeEach(() => {
    jest.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('refreshes after a pull past the threshold and settles back when done', async () => {
    let finish = () => {};
    const onRelease = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { root, content, detach } = mount(onRelease);

    const move = pull(root, 300);

    expect(move.defaultPrevented).toBe(true);
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(content.style.transform).toBe('translate3d(0, 72px, 0)');
    expect(root).toHaveAttribute('data-armed');

    finish();
    await Promise.resolve();
    await Promise.resolve();

    expect(content.style.transform).toBe('');
    expect(root).not.toHaveAttribute('data-armed');
    detach();
  });

  it('springs back without refreshing after a short pull', () => {
    const onRelease = jest.fn(() => Promise.resolve());
    const { root, content, detach } = mount(onRelease);

    pull(root, 60);

    expect(onRelease).not.toHaveBeenCalled();
    expect(content.style.transform).toBe('');
    detach();
  });

  it('ignores pulls while the page is scrolled', () => {
    const onRelease = jest.fn(() => Promise.resolve());
    const { root, detach } = mount(onRelease);
    window.scrollY = 120;

    const move = pull(root, 300);
    window.scrollY = 0;

    expect(move.defaultPrevented).toBe(false);
    expect(onRelease).not.toHaveBeenCalled();
    detach();
  });

  it('ignores upward and sideways drags', () => {
    const onRelease = jest.fn(() => Promise.resolve());
    const { root, detach } = mount(onRelease);

    pull(root, -200);
    pull(root, 40, 200);

    expect(onRelease).not.toHaveBeenCalled();
    detach();
  });

  it('reports a failed refresh and settles back', async () => {
    const failure = new Error('offline');
    const reportError = jest.fn();
    Object.assign(window, { reportError });
    const { root, content, detach } = mount(() => Promise.reject(failure));

    pull(root, 300);
    await Promise.resolve();
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledWith(failure);
    expect(content.style.transform).toBe('');
    detach();
  });
});
