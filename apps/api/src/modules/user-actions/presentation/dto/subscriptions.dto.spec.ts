import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SUBSCRIPTION_CONTEXT } from '@/modules/user-actions/domain/constants/subscription.constants';

import { SubscribeDto, UnsubscribeDto } from './subscriptions.dto';

describe.each([
  ['SubscribeDto', SubscribeDto],
  ['UnsubscribeDto', UnsubscribeDto],
])('%s context', (_name, Dto) => {
  const make = (context?: string) =>
    plainToInstance(Dto, { trigger: 'release', ...(context !== undefined && { context }) });

  it('accepts a context a client sends', async () => {
    expect(await validate(make('reminder'))).toHaveLength(0);
  });

  it('accepts a missing context', async () => {
    expect(await validate(make())).toHaveLength(0);
  });

  it.each(Object.values(SUBSCRIPTION_CONTEXT))('rejects the system context %s', async (context) => {
    const errors = await validate(make(context));
    expect(errors.map((error) => error.property)).toEqual(['context']);
  });
});
