import { isOnLightConnection, whenIdle } from './when-idle';

describe('whenIdle', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    Reflect.deleteProperty(window, 'cancelIdleCallback');
    jest.useRealTimers();
  });

  it('runs the task once the browser is idle', () => {
    let idleTask: () => void = () => {};
    Object.assign(window, {
      requestIdleCallback: jest.fn((callback: () => void) => {
        idleTask = callback;
        return 7;
      }),
      cancelIdleCallback: jest.fn(),
    });
    const task = jest.fn();

    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    idleTask();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled before the browser is idle', () => {
    const cancelIdleCallback = jest.fn();
    Object.assign(window, { requestIdleCallback: jest.fn(() => 7), cancelIdleCallback });

    whenIdle(jest.fn())();

    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it('falls back to a short delay where idle callbacks are missing, as in Safari', () => {
    jest.useFakeTimers();
    const task = jest.fn();
    const cancelled = jest.fn();

    whenIdle(task);
    whenIdle(cancelled)();
    jest.advanceTimersByTime(1199);
    expect(task).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(task).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});

describe('isOnLightConnection', () => {
  afterEach(() => Reflect.deleteProperty(navigator, 'connection'));

  it.each([
    [{ saveData: true, effectiveType: '4g' }, true],
    [{ saveData: false, effectiveType: '2g' }, true],
    [{ saveData: false, effectiveType: 'slow-2g' }, true],
    [{ saveData: false, effectiveType: '4g' }, false],
  ])('treats %o as light: %s', (connection, expected) => {
    Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
    expect(isOnLightConnection()).toBe(expected);
  });

  it('assumes a normal connection where the browser does not say', () => {
    expect(isOnLightConnection()).toBe(false);
  });
});
