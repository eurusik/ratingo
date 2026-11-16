import { toImportItemDto } from './import-item';

describe('toImportItemDto', () => {
  it('drops the media kind and trims titles to the API limit', () => {
    const dto = toImportItemDto({
      imdbId: 'tt1',
      state: 'completed',
      kind: 'show',
      title: 'x'.repeat(250),
    });
    expect(dto).toEqual({ imdbId: 'tt1', state: 'completed', title: 'x'.repeat(200) });
  });
});
