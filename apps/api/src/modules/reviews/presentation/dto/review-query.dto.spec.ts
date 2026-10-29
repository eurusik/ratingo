import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ReviewQueryDto } from './review-query.dto';

// Mirrors the global ValidationPipe transform options (see main.ts)
const transform = (plain: Record<string, unknown>) =>
  plainToInstance(ReviewQueryDto, plain, { enableImplicitConversion: true });

describe('ReviewQueryDto.hideSpoilers', () => {
  it.each([
    ['true', true],
    [true, true],
    ['false', false],
    [false, false],
    ['0', false],
    ['garbage', false],
  ])('maps %p to %p (with implicit conversion)', (input, expected) => {
    const dto = transform({ hideSpoilers: input });
    expect(dto.hideSpoilers).toBe(expected);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('leaves hideSpoilers undefined when omitted', () => {
    expect(transform({}).hideSpoilers).toBeUndefined();
  });
});
