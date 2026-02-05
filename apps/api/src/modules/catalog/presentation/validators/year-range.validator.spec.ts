import { type ValidationArguments } from 'class-validator';

import { YearRangeConstraint, YearExclusiveConstraint } from './year-range.validator';

const makeArgs = (obj: Record<string, unknown>): ValidationArguments =>
  ({ object: obj }) as ValidationArguments;

describe('YearRangeConstraint', () => {
  const constraint = new YearRangeConstraint();

  it('should pass when yearFrom <= yearTo', () => {
    expect(constraint.validate(2024, makeArgs({ yearFrom: 2020, yearTo: 2024 }))).toBe(true);
  });

  it('should pass when yearFrom === yearTo', () => {
    expect(constraint.validate(2020, makeArgs({ yearFrom: 2020, yearTo: 2020 }))).toBe(true);
  });

  it('should fail when yearFrom > yearTo', () => {
    expect(constraint.validate(2019, makeArgs({ yearFrom: 2020, yearTo: 2019 }))).toBe(false);
  });

  it('should pass when yearFrom is undefined', () => {
    expect(constraint.validate(2024, makeArgs({ yearTo: 2024 }))).toBe(true);
  });

  it('should pass when yearTo is undefined', () => {
    expect(constraint.validate(undefined, makeArgs({ yearFrom: 2020 }))).toBe(true);
  });

  it('should return correct default message', () => {
    expect(constraint.defaultMessage()).toBe('yearFrom must be less than or equal to yearTo');
  });
});

describe('YearExclusiveConstraint', () => {
  const constraint = new YearExclusiveConstraint();

  it('should pass when year is set without yearFrom/yearTo', () => {
    expect(constraint.validate(2024, makeArgs({}))).toBe(true);
  });

  it('should fail when year is set with yearFrom', () => {
    expect(constraint.validate(2024, makeArgs({ yearFrom: 2020 }))).toBe(false);
  });

  it('should fail when year is set with yearTo', () => {
    expect(constraint.validate(2024, makeArgs({ yearTo: 2025 }))).toBe(false);
  });

  it('should fail when year is set with both yearFrom and yearTo', () => {
    expect(constraint.validate(2024, makeArgs({ yearFrom: 2020, yearTo: 2025 }))).toBe(false);
  });

  it('should pass when year is undefined (range mode)', () => {
    expect(constraint.validate(undefined, makeArgs({ yearFrom: 2020, yearTo: 2025 }))).toBe(true);
  });

  it('should return correct default message', () => {
    expect(constraint.defaultMessage()).toBe('year cannot be used with yearFrom/yearTo');
  });
});
