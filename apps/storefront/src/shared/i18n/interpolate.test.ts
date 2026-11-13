import fc from 'fast-check';
import { interpolate } from './interpolate';

describe('interpolate', () => {
  it('fills every named placeholder', () => {
    expect(
      interpolate('Увійди, щоб зберегти «{title}» ({year})', { title: 'Андор', year: 2025 }),
    ).toBe('Увійди, щоб зберегти «Андор» (2025)');
  });

  it('keeps placeholders it has no value for', () => {
    expect(interpolate('{title} {missing}', { title: 'Дюна' })).toBe('Дюна {missing}');
  });

  it('never reinterprets placeholder syntax inside a value', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        expect(interpolate('«{title}»', { title })).toBe(`«${title}»`);
      }),
    );
  });
});
