import { DUME_WHY_USAGE } from '../../domain/constants/dume-replies.constants';

import { DumeChatService } from './dume-chat.service';

const setup = () => {
  const delegate = jest
    .fn()
    .mockResolvedValue({ status: 'started', ownerNotice: 'DUM-E розбирає <це>' });
  return { delegate, service: new DumeChatService({ delegate } as never) };
};

describe('DumeChatService', () => {
  it('delegates the question of the message and replies with the notice, escaped', async () => {
    const { service, delegate } = setup();

    expect(await service.reply('10', 4711, '  чому падає?  ')).toBe('🔎 DUM-E розбирає &lt;це&gt;');
    expect(delegate).toHaveBeenCalledWith({
      chatId: '10',
      updateId: 4711,
      question: 'чому падає?',
    });
  });

  it('explains the command instead of starting an empty investigation', async () => {
    const { service, delegate } = setup();

    expect(await service.reply('10', 4711, '   ')).toBe(DUME_WHY_USAGE);
    expect(delegate).not.toHaveBeenCalled();
  });

  it('cuts a question that is longer than DUM-E accepts', async () => {
    const { service, delegate } = setup();

    await service.reply('10', 1, 'x'.repeat(5000));

    expect((delegate.mock.calls[0][0] as { question: string }).question).toHaveLength(1000);
  });
});
