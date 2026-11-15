import { rememberTrackingState } from './tracking-hint-cookie';

function hintCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('ratingo_tracking='))
    ?.slice('ratingo_tracking='.length);
}

describe('rememberTrackingState', () => {
  beforeEach(() => {
    document.cookie = 'ratingo_tracking=; Path=/; Max-Age=0';
  });

  it('writes the latest show first into the cookie', () => {
    rememberTrackingState('pitt', 'watching');
    rememberTrackingState('simpsony', 'watching-next');
    rememberTrackingState('pitt', 'start');

    expect(hintCookie()).toBe('v1/pitt=s/simpsony=n');
  });

  it('skips slugs the cookie cannot keep unchanged', () => {
    rememberTrackingState('андор', 'watching');

    expect(hintCookie()).toBeUndefined();
  });
});
