import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CATALOG_MAX_CALENDAR_DAYS, MAX_PAGE_SIZE } from '../../../../common/constants';

import { NewEpisodesQueryDto } from './new-episodes-query.dto';

const validate = (input: Record<string, unknown>) =>
  validateSync(plainToInstance(NewEpisodesQueryDto, input));

describe('NewEpisodesQueryDto', () => {
  it('applies defaults when not provided', () => {
    const dto = plainToInstance(NewEpisodesQueryDto, {});

    expect(dto.days).toBe(7);
    expect(dto.limit).toBe(20);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('accepts values at the upper bounds', () => {
    expect(validate({ days: CATALOG_MAX_CALENDAR_DAYS, limit: MAX_PAGE_SIZE })).toHaveLength(0);
  });

  it.each([
    ['negative limit', { limit: -1 }],
    ['zero limit', { limit: 0 }],
    ['huge limit', { limit: 1_000_000 }],
    ['negative days', { days: -5 }],
    ['zero days', { days: 0 }],
    ['days above max', { days: CATALOG_MAX_CALENDAR_DAYS + 1 }],
    ['huge days (Invalid Date)', { days: 1e12 }],
  ])('rejects %s', (_label, input) => {
    expect(validate(input).length).toBeGreaterThan(0);
  });
});
