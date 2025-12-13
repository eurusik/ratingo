import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TrendingShowsQueryDto } from './trending.dto';

describe('TrendingShowsQueryDto', () => {
  it('should apply defaults for limit/offset when not provided', () => {
    const dto = plainToInstance(TrendingShowsQueryDto, {});
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
  });

  it('should fail validation for invalid numbers and uuid', () => {
    const dto = plainToInstance(TrendingShowsQueryDto, {
      limit: -1,
      offset: -1,
      minRatingo: 200,
      genres: 123, // invalid type
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const constraints = errors.flatMap((e) => Object.values(e.constraints || {}));
    const message = constraints.join(' ');
    expect(message).toContain('limit must not be less than 1');
    expect(message).toContain('offset must not be less than 0');
    expect(message).toContain('minRatingo must not be greater than 100');
    expect(message).toContain('genres must be a string');
  });
});
