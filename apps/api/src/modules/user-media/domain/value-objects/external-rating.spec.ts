import { normalizeKinobazaRating } from './external-rating';

describe('normalizeKinobazaRating', () => {
  it('converts 8 → 80', () => {
    expect(normalizeKinobazaRating(8)).toBe(80);
  });

  it('converts 1 → 10 (minimum)', () => {
    expect(normalizeKinobazaRating(1)).toBe(10);
  });

  it('converts 10 → 100 (maximum)', () => {
    expect(normalizeKinobazaRating(10)).toBe(100);
  });

  it('returns null for null input', () => {
    expect(normalizeKinobazaRating(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeKinobazaRating(undefined)).toBeNull();
  });

  it('returns null for 0 (unset sentinel)', () => {
    expect(normalizeKinobazaRating(0)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(normalizeKinobazaRating(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(normalizeKinobazaRating(Infinity)).toBeNull();
    expect(normalizeKinobazaRating(-Infinity)).toBeNull();
  });

  it('clamps negative values below 1 to 10', () => {
    expect(normalizeKinobazaRating(-5)).toBe(10);
  });

  it('clamps values above 10 to 100', () => {
    expect(normalizeKinobazaRating(11)).toBe(100);
    expect(normalizeKinobazaRating(100)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(normalizeKinobazaRating(7.5)).toBe(75);
    expect(normalizeKinobazaRating(7.55)).toBe(76);
  });
});
