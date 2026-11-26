import { isLevelEnabled, toLogLevel } from './log-level';

describe('toLogLevel', () => {
  it.each([
    ['verbose', 'debug'],
    ['log', 'info'],
    ['INFO', 'info'],
    ['warning', 'warn'],
    ['fatal', 'error'],
  ])('maps %s to %s', (name, level) => {
    expect(toLogLevel(name)).toBe(level);
  });

  it.each(['loud', '', 'constructor', 'toString', '__proto__'])('rejects %j', (name) => {
    expect(toLogLevel(name)).toBeUndefined();
  });
});

describe('isLevelEnabled', () => {
  it('enables a level at or above the minimum', () => {
    expect(isLevelEnabled('warn', 'error')).toBe(true);
    expect(isLevelEnabled('warn', 'warn')).toBe(true);
    expect(isLevelEnabled('warn', 'info')).toBe(false);
  });
});
