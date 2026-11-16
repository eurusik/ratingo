import { attachSwipeReveal } from './swipe-reveal';

const REVEAL_WIDTH = 80;

const STEP_MS = 100;
let clock = 0;

const RELEASE_EVENTS = new Set(['pointerup', 'pointercancel', 'lostpointercapture']);

interface PointerOptions {
  pointerType?: string;
  buttons?: number;
}

function pointer(
  target: Element,
  type: string,
  clientX: number,
  clientY = 0,
  { pointerType = 'touch', buttons = RELEASE_EVENTS.has(type) ? 0 : 1 }: PointerOptions = {},
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, buttons });
  clock += STEP_MS;
  Object.assign(event, { pointerId: 1, isPrimary: true, pointerType });
  Object.defineProperty(event, 'timeStamp', { value: clock });
  target.dispatchEvent(event);
}

function tap(target: Element) {
  pointer(target, 'pointerdown', 0);
  pointer(target, 'pointerup', 0);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function swipe(target: Element, fromX: number, toX: number, toY = 0, pointerType = 'touch') {
  pointer(target, 'pointerdown', fromX, 0, { pointerType });
  pointer(target, 'pointermove', (fromX + toX) / 2, toY / 2, { pointerType });
  pointer(target, 'pointermove', toX, toY, { pointerType });
  pointer(target, 'pointerup', toX, toY, { pointerType });
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

  it('leaves mouse drags alone', () => {
    const { row, content, detach } = mountRow();

    swipe(content, 200, 100, 0, 'mouse');

    expect(content.style.transform).toBe('');
    expect(row).not.toHaveAttribute('data-open');
    detach();
  });

  it('does not follow the mouse once a menu opened from the row has closed', () => {
    const { row, content, detach } = mountRow();

    pointer(content, 'pointerdown', 200, 0, { pointerType: 'mouse' });
    pointer(content, 'pointermove', 150, 0, { pointerType: 'mouse', buttons: 0 });
    pointer(content, 'pointermove', 100, 0, { pointerType: 'mouse', buttons: 0 });

    expect(content.style.transform).toBe('');
    expect(row).not.toHaveAttribute('data-dragging');
    detach();
  });

  it('drops a press whose release landed outside the row', () => {
    const { row, content, detach } = mountRow();

    pointer(content, 'pointerdown', 200, 0, { pointerType: 'pen' });
    pointer(content, 'pointermove', 150, 0, { pointerType: 'pen', buttons: 0 });
    pointer(content, 'pointermove', 100, 0, { pointerType: 'pen', buttons: 0 });

    expect(content.style.transform).toBe('');
    expect(row).not.toHaveAttribute('data-dragging');
    detach();
  });

  it('settles the row when it loses pointer capture mid-drag', () => {
    const { row, content, detach } = mountRow();

    pointer(content, 'pointerdown', 200);
    pointer(content, 'pointermove', 170);
    pointer(content, 'pointermove', 160);
    pointer(content, 'lostpointercapture', 160);
    pointer(content, 'pointermove', 100);

    expect(row).not.toHaveAttribute('data-dragging');
    expect(content.style.transform).toBe('');
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
