import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { isRawQueryTrue, TransformRawQueryBoolean } from './raw-boolean-query.transform';

class FlagQuery {
  @TransformRawQueryBoolean()
  flag?: boolean;
}

describe('isRawQueryTrue', () => {
  it.each([
    ['true', true],
    [true, true],
    ['false', false],
    [false, false],
    ['1', false],
    [undefined, false],
  ])('reads %p as %p', (raw, expected) => {
    expect(isRawQueryTrue({ flag: raw }, 'flag')).toBe(expected);
  });

  it('returns false for a non-object source', () => {
    expect(isRawQueryTrue(null, 'flag')).toBe(false);
    expect(isRawQueryTrue('flag', 'flag')).toBe(false);
  });
});

describe('TransformRawQueryBoolean', () => {
  it('keeps "false" false even with implicit conversion enabled', () => {
    const query = plainToInstance(FlagQuery, { flag: 'false' }, { enableImplicitConversion: true });
    expect(query.flag).toBe(false);
  });

  it('turns "true" into true', () => {
    const query = plainToInstance(FlagQuery, { flag: 'true' }, { enableImplicitConversion: true });
    expect(query.flag).toBe(true);
  });
});
