import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PERSON_CREDITS_MAX_LIMIT } from '../../domain/constants/person.constants';

import { PersonCreditsQueryDto } from './person-credits-query.dto';

function validate(input: Record<string, unknown>) {
  const dto = plainToInstance(PersonCreditsQueryDto, input, {
    enableImplicitConversion: true,
  });
  return { dto, errors: validateSync(dto, { whitelist: true }) };
}

describe('PersonCreditsQueryDto', () => {
  it('accepts an empty query and applies defaults', () => {
    const { dto, errors } = validate({});
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBeGreaterThan(0);
    expect(dto.offset).toBe(0);
  });

  it('coerces numeric strings', () => {
    const { dto, errors } = validate({ limit: '10', offset: '5' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
    expect(dto.offset).toBe(5);
  });

  it('rejects a limit above the max', () => {
    const { errors } = validate({ limit: PERSON_CREDITS_MAX_LIMIT + 1 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a negative offset', () => {
    const { errors } = validate({ offset: -1 });
    expect(errors.some((e) => e.property === 'offset')).toBe(true);
  });

  it('accepts valid creditType values', () => {
    expect(validate({ creditType: 'cast' }).errors).toHaveLength(0);
    expect(validate({ creditType: 'crew' }).errors).toHaveLength(0);
  });

  it('rejects an unknown creditType', () => {
    const { errors } = validate({ creditType: 'producer' });
    expect(errors.some((e) => e.property === 'creditType')).toBe(true);
  });
});
