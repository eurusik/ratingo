import fc from 'fast-check';
import { OAUTH_PROVIDERS } from '@/shared/auth';
import {
  activeMethods,
  canUnlink,
  listedProviders,
  methodsLeftAfterUnlink,
} from './sign-in-methods';

const accounts = fc.record({
  linkedProviders: fc.subarray([...OAUTH_PROVIDERS]),
  hasPassword: fc.boolean(),
});

describe('sign-in methods', () => {
  it('lists linked providers first and the password last', () => {
    expect(activeMethods({ linkedProviders: ['facebook', 'google'], hasPassword: true })).toEqual([
      'google',
      'facebook',
      'email',
    ]);
  });

  it('never lets the last remaining method go', () => {
    fc.assert(
      fc.property(accounts, (account) => {
        for (const provider of account.linkedProviders) {
          if (canUnlink(account)) {
            expect(methodsLeftAfterUnlink(account, provider).length).toBeGreaterThan(0);
          }
        }
        expect(canUnlink(account)).toBe(activeMethods(account).length > 1);
      }),
    );
  });

  it('blocks unlinking Google when it is the only way in', () => {
    expect(canUnlink({ linkedProviders: ['google'], hasPassword: false })).toBe(false);
  });

  it('hides a disabled provider unless the account still has it linked', () => {
    const account = { linkedProviders: [], hasPassword: true };
    expect(listedProviders(account, ['google'])).toEqual(['google']);
    expect(listedProviders({ ...account, linkedProviders: ['facebook'] }, ['google'])).toEqual([
      'google',
      'facebook',
    ]);
  });
});
