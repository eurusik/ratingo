import { attachSwipeReveal } from './swipe-reveal';

const REVEAL_WIDTH = 80;

const STEP_MS = 100;
let clock = 0;

function pointer(target: Element, type: string, clientX: number, clientY = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  clock += STEP_MS;
  Object.assign(event, { pointerId: 1, isPrimary: true });
  Object.defineProperty(event, 'timeStamp', { value: clock });
  target.dispatchEvent(event);
}

function tap(target: Element) {
  pointer(target, 'pointerdown', 0);
  pointer(target, 'pointerup', 0);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function swipe(target: Element, fromX: number, toX: number, toY = 0) {
  pointer(target, 'pointerdown', fromX);
  pointer(target, 'pointermove', (fromX + toX) / 2, toY / 2);
  pointer(target, 'pointermove', toX, toY);
  pointer(target, 'pointerup', toX, toY);
}

function mountRow() {
  const row = document.createElement('div');
  const actions = document.createElement('div');
  const action = document.createElement('button');
  const content = document.createElement('div');
  actions.append(action);
  row.append(actions, content);
  document.body.append(row);
  Object.defineProperty(actions, 'offsetWidth', { value: REVEAL_WIDTH });
  const detach = attachSwipeReveal({ row, content, actions });
  return { row, content, action, detach };
}

describe('attachSwipeReveal', () => {
  beforeEach(() => {
    jest.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('reveals the actions after a horizontal swipe past half their width', () => {
    const { row, content, detach } = mountRow();

    swipe(content, 200, 140);

    expect(content.style.transform).toBe(`translate3d(${-REVEAL_WIDTH}px, 0, 0)`);
    expect(row).toHaveAttribute('data-open');
    detach();
  });

  it('springs back after a short swipe', () => {
    const { row, content, detach } = mountRow();

    swipe(content, 200, 180);

    expect(content.style.transform).toBe('');
    expect(row).not.toHaveAttribute('data-open');
    detach();
  });

  it('leaves vertical drags to the page scroll', () => {
    const { content, detach } = mountRow();

    swipe(content, 200, 190, 80);

    expect(content.style.transform).toBe('');
    detach();
  });

  it('closes on a tap of the open row without activating it', () => {
    const { row, content, detach } = mountRow();
    const onClick = jest.fn();
    row.addEventListener('click', onClick);
    swipe(content, 200, 100);

    content.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(row).toHaveAttribute('data-open');

    tap(content);

    expect(onClick).not.toHaveBeenCalled();
    expect(row).not.toHaveAttribute('data-open');
    detach();
  });

  it('keeps only one row open', () => {
    const first = mountRow();
    const second = mountRow();

    swipe(first.content, 200, 100);
    swipe(second.content, 200, 100);

    expect(first.row).not.toHaveAttribute('data-open');
    expect(second.row).toHaveAttribute('data-open');
    first.detach();
    second.detach();
  });

  it('reveals the actions when keyboard focus reaches them', () => {
    const { row, action, detach } = mountRow();

    action.focus();

    expect(row).toHaveAttribute('data-open');
    detach();
  });

  it('settles a row that a tap caught in the middle of its spring', () => {
    jest.useFakeTimers();
    jest.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const { content, detach } = mountRow();

    swipe(content, 200, 100);
    jest.advanceTimersByTime(32);
    tap(content);
    jest.runAllTimers();

    expect(['', `translate3d(${-REVEAL_WIDTH}px, 0, 0)`]).toContain(content.style.transform);
    detach();
    jest.useRealTimers();
  });
});
