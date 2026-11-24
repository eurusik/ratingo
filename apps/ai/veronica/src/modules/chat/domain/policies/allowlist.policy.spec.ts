import fc from 'fast-check';

import { PRIVATE_CHAT_TYPE } from '../constants/chat.constants';

import { isAllowed } from './allowlist.policy';

const allowlist = { userIds: ['10', '20'], chatId: '10' };
const sender = { userId: '10', chatId: '10', chatType: PRIVATE_CHAT_TYPE };

describe('isAllowed', () => {
  it('allows the owner in the private chat', () => {
    expect(isAllowed(sender, allowlist)).toBe(true);
  });

  it('requires the user and the chat to match, and the chat to be private', () => {
    expect(isAllowed({ ...sender, userId: '99' }, allowlist)).toBe(false);
    expect(isAllowed({ ...sender, userId: '20' }, allowlist)).toBe(true);
    expect(isAllowed({ ...sender, userId: '20', chatId: '20' }, allowlist)).toBe(false);
    expect(isAllowed({ ...sender, chatType: 'group' }, allowlist)).toBe(false);
    expect(isAllowed({ ...sender, chatType: 'supergroup' }, allowlist)).toBe(false);
  });

  it('allows exactly when all three conditions hold', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('10', '20', '30'),
        fc.constantFrom('10', '20', '-10'),
        fc.constantFrom('private', 'group', 'channel'),
        (userId, chatId, chatType) => {
          expect(isAllowed({ userId, chatId, chatType }, allowlist)).toBe(
            allowlist.userIds.includes(userId) && chatId === '10' && chatType === 'private',
          );
        },
      ),
    );
  });
});
