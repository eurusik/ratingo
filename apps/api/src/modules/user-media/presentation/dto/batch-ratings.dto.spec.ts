/**
 * BatchRatingsQueryDto Validation Tests
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { MAX_PAGE_SIZE } from '../../../../common/constants';

import { BatchRatingsQueryDto } from './batch-ratings.dto';

describe('BatchRatingsQueryDto', () => {
  const transform = (data: unknown) => plainToInstance(BatchRatingsQueryDto, data);

  const validate = (data: unknown) => {
    const instance = transform(data);
    return validateSync(instance);
  };

  describe('@Transform (comma-separated string to array)', () => {
    it('should split comma-separated UUIDs into an array', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
      const instance = transform({ ids: `${uuid1},${uuid2}` });

      expect(instance.ids).toEqual([uuid1, uuid2]);
    });

    it('should trim whitespace around UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const instance = transform({ ids: `  ${uuid}  ` });

      expect(instance.ids).toEqual([uuid]);
    });

    it('should filter out empty segments', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const instance = transform({ ids: `${uuid},,` });

      expect(instance.ids).toEqual([uuid]);
    });

    it('should limit to MAX_PAGE_SIZE entries', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const ids = Array(MAX_PAGE_SIZE + 10)
        .fill(uuid)
        .join(',');
      const instance = transform({ ids });

      expect(instance.ids).toHaveLength(MAX_PAGE_SIZE);
    });
  });

  describe('UUID validation', () => {
    it('should accept valid UUIDv4 values', () => {
      const errors = validate({ ids: '550e8400-e29b-41d4-a716-446655440000' });

      expect(errors).toHaveLength(0);
    });

    it('should accept multiple valid UUIDs', () => {
      const errors = validate({
        ids: '550e8400-e29b-41d4-a716-446655440000,7c9e6679-7425-40de-944b-e07fc1f90ae7',
      });

      expect(errors).toHaveLength(0);
    });

    it('should reject non-UUID strings', () => {
      const errors = validate({ ids: 'not-a-uuid' });
      const idErrors = errors.filter((e) => e.property === 'ids');

      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('should reject when any ID in the list is not a valid UUID', () => {
      const errors = validate({
        ids: '550e8400-e29b-41d4-a716-446655440000,invalid',
      });
      const idErrors = errors.filter((e) => e.property === 'ids');

      expect(idErrors.length).toBeGreaterThan(0);
    });
  });

  describe('array size validation', () => {
    it('should reject an empty ids string', () => {
      const errors = validate({ ids: '' });
      const idErrors = errors.filter((e) => e.property === 'ids');

      expect(idErrors.length).toBeGreaterThan(0);
    });
  });
});
