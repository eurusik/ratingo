import { describe, it, expect } from 'vitest';
import { generateProviderSlug, prepareProviderData, shouldUpdateProvider } from './processors';

describe('backfillProviders/processors', () => {
  it('generateProviderSlug нормалізує назву та видаляє зайві символи', () => {
    expect(generateProviderSlug(null)).toBeNull();
    expect(generateProviderSlug('')).toBeNull();
    expect(generateProviderSlug('   ')).toBeNull();
    expect(generateProviderSlug('Netflix')).toBe('netflix');
    expect(generateProviderSlug('HBO Max')).toBe('hbo-max');
    expect(generateProviderSlug('Hulu+Live TV')).toBe('hulu-live-tv');
    expect(generateProviderSlug('  Apple TV+  ')).toBe('apple-tv');
    expect(generateProviderSlug('Paramount---Plus')).toBe('paramount-plus');
    expect(generateProviderSlug('Viasat (UA)')).toBe('viasat-ua');
  });

  it('prepareProviderData повертає null, якщо немає даних', () => {
    expect(prepareProviderData(5, null)).toBeNull();
  });

  it('prepareProviderData формує правильну структуру та slug', () => {
    const data = { providerId: 12, name: 'HBO Max', logoPath: '/hbo.png' };
    const res = prepareProviderData(12, data);
    expect(res).toEqual({ tmdbId: 12, name: 'HBO Max', logoPath: '/hbo.png', slug: 'hbo-max' });
  });

  it('shouldUpdateProvider повертає true коли є відмінності', () => {
    const oldRow = { tmdbId: 7, name: 'Netflix', logoPath: '/n.png', slug: 'netflix' };
    const newRow1 = { tmdbId: 7, name: 'Netflix', logoPath: '/n2.png', slug: 'netflix' };
    const newRow2 = { tmdbId: 7, name: 'Netflix HD', logoPath: '/n.png', slug: 'netflix-hd' };
    expect(shouldUpdateProvider(oldRow as any, newRow1 as any)).toBe(true);
    expect(shouldUpdateProvider(oldRow as any, newRow2 as any)).toBe(true);
  });

  it('shouldUpdateProvider повертає false коли дані не змінилися', () => {
    const oldRow = { tmdbId: 7, name: 'Netflix', logoPath: '/n.png', slug: 'netflix' };
    const newRow = { tmdbId: 7, name: 'Netflix', logoPath: '/n.png', slug: 'netflix' };
    expect(shouldUpdateProvider(oldRow as any, newRow as any)).toBe(false);
  });
});
