import { toIncomingMessage } from './telegram-update.schema';

const update = (message: Record<string, unknown> | undefined) => ({ update_id: 9, message });

describe('toIncomingMessage', () => {
  it('maps a private text message', () => {
    expect(
      toIncomingMessage(
        update({
          from: { id: 10, is_bot: false },
          chat: { id: 10, type: 'private' },
          text: '/help',
        }),
      ),
    ).toEqual({ updateId: 9, userId: '10', chatId: '10', chatType: 'private', text: '/help' });
  });

  it('keeps negative group chat ids', () => {
    expect(
      toIncomingMessage(
        update({ from: { id: 10 }, chat: { id: -100123, type: 'supergroup' }, text: 'hi' }),
      )?.chatId,
    ).toBe('-100123');
  });

  it.each([
    ['a non-object', 'text'],
    ['an update without a message', { update_id: 1 }],
    ['an edited message', { update_id: 1, edited_message: { text: 'x' } }],
    ['a message without text', update({ from: { id: 1 }, chat: { id: 1, type: 'private' } })],
    ['a message without a sender', update({ chat: { id: 1, type: 'private' }, text: 'x' })],
    ['a message without a chat', update({ from: { id: 1 }, text: 'x' })],
    ['a non-integer update id', { update_id: 'x', message: {} }],
  ])('ignores %s', (_name, body) => {
    expect(toIncomingMessage(body)).toBeNull();
  });

  it('caps the text length', () => {
    const text = 'a'.repeat(10_000);
    const mapped = toIncomingMessage(
      update({ from: { id: 1 }, chat: { id: 1, type: 'private' }, text }),
    );
    expect(mapped?.text.length).toBe(4096);
  });
});
