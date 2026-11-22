import { ChatExchangeRetentionScheduler } from './chat-exchange-retention.scheduler';

describe('ChatExchangeRetentionScheduler', () => {
  it('registers one daily scheduler under a fixed id', async () => {
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined);
    await new ChatExchangeRetentionScheduler({ upsertJobScheduler } as never).onModuleInit();
    await new ChatExchangeRetentionScheduler({ upsertJobScheduler } as never).onModuleInit();
    expect(upsertJobScheduler).toHaveBeenCalledTimes(2);
    const [id, repeat, template] = upsertJobScheduler.mock.calls[0];
    expect(id).toBe('exchange-retention');
    expect(repeat).toEqual({ pattern: '17 3 * * *', tz: 'Europe/Kyiv' });
    expect(template.name).toBe('exchange-retention');
    expect(upsertJobScheduler.mock.calls[1][0]).toBe(id);
  });
});
