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

  it('should pass validation for valid payload', () => {
    const dto = plainToInstance(TrendingShowsQueryDto, {
      limit: 10,
      offset: 5,
      minRating: 50,
      genreId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation for invalid numbers and uuid', () => {
    const dto = plainToInstance(TrendingShowsQueryDto, {
      limit: -1,
      offset: -1,
      minRating: 200,
      genreId: 'not-uuid',
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const constraints = errors.flatMap((e) => Object.values(e.constraints || {}));
    const message = constraints.join(' ');
    expect(message).toContain('limit must not be less than 1');
    expect(message).toContain('offset must not be less than 0');
    expect(message).toContain('minRating must not be greater than 100');
    expect(message).toContain('must be a UUID');
  });
});
