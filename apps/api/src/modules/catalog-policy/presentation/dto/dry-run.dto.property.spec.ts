/**
 * Dry-Run DTO Property Tests
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DryRunOptionsDto } from './dry-run.dto';

describe('DryRunOptionsDto - Property-Based Tests', () => {
  const validate = (data: unknown) => {
    const instance = plainToInstance(DryRunOptionsDto, data);
    return validateSync(instance);
  };

  describe('mode validation', () => {
    it('should accept valid modes', () => {
      fc.assert(
        fc.property(fc.constantFrom('sample', 'top', 'byType', 'byCountry'), (mode) => {
          const errors = validate({ mode });
          const modeErrors = errors.filter((e) => e.property === 'mode');
          return modeErrors.length === 0;
        }),
      );
    });

    it('should reject invalid modes', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['sample', 'top', 'byType', 'byCountry'].includes(s)),
          (mode) => {
            const errors = validate({ mode });
            const modeErrors = errors.filter((e) => e.property === 'mode');
            return modeErrors.length > 0;
          },
        ),
      );
    });
  });

  describe('limit validation', () => {
    it('should accept limits between 1 and 10000', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (limit) => {
          const errors = validate({ mode: 'top', limit });
          const limitErrors = errors.filter((e) => e.property === 'limit');
          return limitErrors.length === 0;
        }),
      );
    });

    it('should reject limits below 1', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1000, max: 0 }), (limit) => {
          const errors = validate({ mode: 'top', limit });
          const limitErrors = errors.filter((e) => e.property === 'limit');
          return limitErrors.length > 0;
        }),
      );
    });

    it('should reject limits above 10000', () => {
      fc.assert(
        fc.property(fc.integer({ min: 10001, max: 100000 }), (limit) => {
          const errors = validate({ mode: 'top', limit });
          const limitErrors = errors.filter((e) => e.property === 'limit');
          return limitErrors.length > 0;
        }),
      );
    });
  });

  describe('samplePercent validation', () => {
    it('should accept samplePercent between 1 and 100', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (samplePercent) => {
          const errors = validate({ mode: 'sample', samplePercent });
          const percentErrors = errors.filter((e) => e.property === 'samplePercent');
          return percentErrors.length === 0;
        }),
      );
    });

    it('should reject samplePercent below 1', () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: 0 }), (samplePercent) => {
          const errors = validate({ mode: 'sample', samplePercent });
          const percentErrors = errors.filter((e) => e.property === 'samplePercent');
          return percentErrors.length > 0;
        }),
      );
    });

    it('should reject samplePercent above 100', () => {
      fc.assert(
        fc.property(fc.integer({ min: 101, max: 1000 }), (samplePercent) => {
          const errors = validate({ mode: 'sample', samplePercent });
          const percentErrors = errors.filter((e) => e.property === 'samplePercent');
          return percentErrors.length > 0;
        }),
      );
    });
  });

  describe('country validation', () => {
    it('should accept valid ISO 3166-1 alpha-2 codes', () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[A-Z]{2}$/), (country) => {
          const errors = validate({ mode: 'byCountry', country });
          const countryErrors = errors.filter((e) => e.property === 'country');
          return countryErrors.length === 0;
        }),
      );
    });

    it('should reject lowercase country codes', () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z]{2}$/), (country) => {
          const errors = validate({ mode: 'byCountry', country });
          const countryErrors = errors.filter((e) => e.property === 'country');
          return countryErrors.length > 0;
        }),
      );
    });

    it('should reject country codes with wrong length', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z]+$/).filter((s) => s.length !== 2),
          (country) => {
            const errors = validate({ mode: 'byCountry', country });
            const countryErrors = errors.filter((e) => e.property === 'country');
            return countryErrors.length > 0;
          },
        ),
      );
    });
  });

  describe('mediaType validation', () => {
    it('should accept valid media types', () => {
      fc.assert(
        fc.property(fc.constantFrom('movie', 'show'), (mediaType) => {
          const errors = validate({ mode: 'byType', mediaType });
          const typeErrors = errors.filter((e) => e.property === 'mediaType');
          return typeErrors.length === 0;
        }),
      );
    });

    it('should reject invalid media types', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['movie', 'show'].includes(s) && s.length > 0),
          (mediaType) => {
            const errors = validate({ mode: 'byType', mediaType });
            const typeErrors = errors.filter((e) => e.property === 'mediaType');
            return typeErrors.length > 0;
          },
        ),
      );
    });
  });
});
