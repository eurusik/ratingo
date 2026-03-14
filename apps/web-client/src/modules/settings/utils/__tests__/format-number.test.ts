import { formatNumber } from '../format-number';

describe('formatNumber', () => {
  it('formats zero as "0"', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats numbers below 1000 without separator', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats 1000 with a thousands separator for the default uk locale', () => {
    const result = formatNumber(1000);
    // Ukrainian locale uses a non-breaking thin space (U+202F) as thousands separator
    expect(result).toMatch(/1.000/);
    expect(result).not.toBe('1000');
  });

  it('formats large numbers correctly for the default uk locale', () => {
    const result = formatNumber(1_234_567);
    // Should contain three groups: 1, 234, 567
    expect(result).toMatch(/1/);
    expect(result).toMatch(/234/);
    expect(result).toMatch(/567/);
    // Must not be the plain unformatted string
    expect(result).not.toBe('1234567');
  });

  it('accepts "en" locale and formats with a comma thousands separator', () => {
    expect(formatNumber(1000, 'en')).toBe('1,000');
    expect(formatNumber(1_000_000, 'en')).toBe('1,000,000');
  });

  it('accepts "uk" locale explicitly and formats consistently with the default', () => {
    expect(formatNumber(500, 'uk')).toBe(formatNumber(500));
    expect(formatNumber(1000, 'uk')).toBe(formatNumber(1000));
  });

  it('formats negative numbers correctly', () => {
    const result = formatNumber(-1000, 'en');
    expect(result).toBe('-1,000');
  });

  it('formats decimal numbers correctly for en locale', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
  });
});
