import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BackfillRequestDto } from './backfill.dto';
import { PrepareOptionsDto } from './run-actions.dto';

describe('catalog-policy batchSize validation', () => {
  const cases = [
    {
      name: 'PrepareOptionsDto',
      build: (batchSize: number) => plainToInstance(PrepareOptionsDto, { batchSize }),
    },
    {
      name: 'BackfillRequestDto',
      build: (batchSize: number) =>
        plainToInstance(BackfillRequestDto, { context: 'catalog', batchSize }),
    },
  ];

  describe.each(cases)('$name', ({ build }) => {
    it.each([1, 500, 1000])('accepts batchSize %d', async (batchSize) => {
      const errors = await validate(build(batchSize));
      expect(errors).toHaveLength(0);
    });

    it.each([0, -1, 1001, 1.5])('rejects batchSize %d', async (batchSize) => {
      const errors = await validate(build(batchSize));
      expect(errors.map((e) => e.property)).toEqual(['batchSize']);
    });
  });
});
