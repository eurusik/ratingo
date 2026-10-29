import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SaveItemDto } from './saved-items.dto';

describe('SaveItemDto', () => {
  const make = (reasonKey?: string) =>
    plainToInstance(SaveItemDto, {
      list: 'for_later',
      ...(reasonKey !== undefined && { reasonKey }),
    });

  it('accepts a reasonKey of up to 64 characters', async () => {
    expect(await validate(make('a'.repeat(64)))).toHaveLength(0);
  });

  it('rejects a reasonKey longer than 64 characters', async () => {
    const errors = await validate(make('a'.repeat(65)));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('reasonKey');
  });

  it('accepts a missing reasonKey', async () => {
    expect(await validate(make())).toHaveLength(0);
  });
});
