import { extractPrimaryTrailer } from './primary-trailer.mapper';

describe('extractPrimaryTrailer', () => {
  it('returns the first video', () => {
    expect(extractPrimaryTrailer([{ key: 'a' }, { key: 'b' }])).toEqual({ key: 'a' });
  });

  it.each([[[]], [null], [undefined], ['abc'], [{ key: 'a' }], [[null]]])(
    'returns null for %p',
    (videos) => {
      expect(extractPrimaryTrailer(videos)).toBeNull();
    },
  );
});
