import { linkResultOf } from './link-result';

describe('linkResultOf', () => {
  it('reads a successful link', () => {
    expect(linkResultOf('?linked=google')).toEqual({ provider: 'google', outcome: 'linked' });
  });

  it('tells an account linked elsewhere apart from other failures', () => {
    expect(linkResultOf('?linkError=ALREADY_LINKED&provider=facebook')).toEqual({
      provider: 'facebook',
      outcome: 'alreadyLinked',
    });
    expect(linkResultOf('?linkError=LINK_FAILED&provider=google')).toEqual({
      provider: 'google',
      outcome: 'failed',
    });
  });

  it.each(['', '?linked=twitter', '?linkError=LINK_FAILED', '?provider=google'])(
    'ignores %p',
    (search) => expect(linkResultOf(search)).toBeNull(),
  );
});
