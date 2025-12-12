import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';

describe('CatalogUserStateEnricher', () => {
  const userMediaService = {
    findMany: jest.fn(),
    getState: jest.fn(),
  };

  let enricher: CatalogUserStateEnricher;

  beforeEach(() => {
    jest.clearAllMocks();
    enricher = new CatalogUserStateEnricher(userMediaService as any);
  });

  it('enrichList should set userState null when userId missing', async () => {
    const items = [{ id: 'm1' }, { id: 'm2' }];

    const result = await enricher.enrichList(null, items as any);

    expect(userMediaService.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'm1', userState: null },
      { id: 'm2', userState: null },
    ]);
  });

  it('enrichList should batch states and map by mediaItemId', async () => {
    userMediaService.findMany.mockResolvedValue([
      { mediaItemId: 'm2', state: 'watching' },
      { mediaItemId: 'm1', state: 'planned' },
    ]);

    const result = await enricher.enrichList('u1', [{ id: 'm1' }, { id: 'm2' }] as any);

    expect(userMediaService.findMany).toHaveBeenCalledWith('u1', ['m1', 'm2']);
    expect(result).toEqual([
      { id: 'm1', userState: { mediaItemId: 'm1', state: 'planned' } },
      { id: 'm2', userState: { mediaItemId: 'm2', state: 'watching' } },
    ]);
  });

  it('enrichOne should return userState null when userId missing', async () => {
    const result = await enricher.enrichOne(null, { id: 'm1' } as any);

    expect(userMediaService.getState).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'm1', userState: null });
  });

  it('enrichOne should fetch state when userId present', async () => {
    userMediaService.getState.mockResolvedValue({ mediaItemId: 'm1', state: 'watching' });

    const result = await enricher.enrichOne('u1', { id: 'm1' } as any);

    expect(userMediaService.getState).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 'm1', userState: { mediaItemId: 'm1', state: 'watching' } });
  });
});
