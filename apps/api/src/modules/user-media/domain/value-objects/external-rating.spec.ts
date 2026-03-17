import { normalizeExternalRating } from './external-rating';

describe('normalizeExternalRating', () => {
  it('converts 8 → 80', () => {
    expect(normalizeExternalRating(8)).toBe(80);
  });

  it('converts 1 → 10 (minimum)', () => {
    expect(normalizeExternalRating(1)).toBe(10);
  });

  it('converts 10 → 100 (maximum)', () => {
    expect(normalizeExternalRating(10)).toBe(100);
  });

  it('returns null for null input', () => {
    expect(normalizeExternalRating(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeExternalRating(undefined)).toBeNull();
  });

  it('returns null for 0 (unset sentinel)', () => {
    expect(normalizeExternalRating(0)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(normalizeExternalRating(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(normalizeExternalRating(Infinity)).toBeNull();
    expect(normalizeExternalRating(-Infinity)).toBeNull();
  });

  it('clamps negative values below 1 to 10', () => {
    expect(normalizeExternalRating(-5)).toBe(10);
  });

  it('clamps values above 10 to 100', () => {
    expect(normalizeExternalRating(11)).toBe(100);
    expect(normalizeExternalRating(100)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(normalizeExternalRating(7.5)).toBe(75);
    expect(normalizeExternalRating(7.55)).toBe(76);
  });
});
