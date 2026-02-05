import { Test, TestingModule } from '@nestjs/testing';

import {
  IUserStateProvider,
  USER_STATE_PROVIDER,
} from '../../domain/ports/user-state-provider.port';

import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';

describe('CatalogUserStateEnricher', () => {
  let enricher: CatalogUserStateEnricher;
  let userStateProvider: jest.Mocked<IUserStateProvider>;

  beforeEach(async () => {
    const mockUserStateProvider: jest.Mocked<IUserStateProvider> = {
      findMany: jest.fn(),
      getState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogUserStateEnricher,
        { provide: USER_STATE_PROVIDER, useValue: mockUserStateProvider },
      ],
    }).compile();

    enricher = module.get<CatalogUserStateEnricher>(CatalogUserStateEnricher);
    userStateProvider = module.get(USER_STATE_PROVIDER);
  });

  describe('enrichList', () => {
    it('should set userState null when userId is null', async () => {
      const items = [{ id: 'm1' }, { id: 'm2' }];

      const result = await enricher.enrichList(null, items as any);

      expect(userStateProvider.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'm1', userState: null },
        { id: 'm2', userState: null },
      ]);
    });

    it('should set userState null when userId is undefined', async () => {
      const items = [{ id: 'm1' }];

      const result = await enricher.enrichList(undefined, items as any);

      expect(userStateProvider.findMany).not.toHaveBeenCalled();
      expect(result[0].userState).toBeNull();
    });

    it('should set userState null when items array is empty', async () => {
      const result = await enricher.enrichList('user-1', []);

      expect(userStateProvider.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should batch fetch states and map by mediaItemId', async () => {
      userStateProvider.findMany.mockResolvedValue([
        { mediaItemId: 'm2', state: 'watching' } as any,
        { mediaItemId: 'm1', state: 'planned' } as any,
      ]);

      const result = await enricher.enrichList('u1', [{ id: 'm1' }, { id: 'm2' }] as any);

      expect(userStateProvider.findMany).toHaveBeenCalledWith('u1', ['m1', 'm2']);
      expect(result).toEqual([
        { id: 'm1', userState: { mediaItemId: 'm1', state: 'planned' } },
        { id: 'm2', userState: { mediaItemId: 'm2', state: 'watching' } },
      ]);
    });

    it('should set userState null for items without matching state', async () => {
      userStateProvider.findMany.mockResolvedValue([
        { mediaItemId: 'm1', state: 'watching' } as any,
      ]);

      const result = await enricher.enrichList('u1', [{ id: 'm1' }, { id: 'm2' }] as any);

      expect(result[0].userState).toEqual({ mediaItemId: 'm1', state: 'watching' });
      expect(result[1].userState).toBeNull();
    });
  });

  describe('enrichItemList', () => {
    it('should enrich plain items without pre-attached userState', async () => {
      userStateProvider.findMany.mockResolvedValue([]);

      const result = await enricher.enrichItemList('user-1', [{ id: 'm1' }, { id: 'm2' }]);

      expect(userStateProvider.findMany).toHaveBeenCalledWith('user-1', ['m1', 'm2']);
      expect(result).toEqual([
        { id: 'm1', userState: null },
        { id: 'm2', userState: null },
      ]);
    });

    it('should return items with null userState when no userId', async () => {
      const result = await enricher.enrichItemList(null, [{ id: 'm1' }]);

      expect(userStateProvider.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'm1', userState: null }]);
    });

    it('should return empty array when items is empty', async () => {
      const result = await enricher.enrichItemList('user-1', []);

      expect(userStateProvider.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should map found states to items', async () => {
      userStateProvider.findMany.mockResolvedValue([
        { mediaItemId: 'm1', state: 'watching' } as any,
      ]);

      const result = await enricher.enrichItemList('u1', [{ id: 'm1' }, { id: 'm2' }]);

      expect(result[0].userState).toEqual({ mediaItemId: 'm1', state: 'watching' });
      expect(result[1].userState).toBeNull();
    });
  });

  describe('enrichOne', () => {
    it('should return userState null when userId is null', async () => {
      const result = await enricher.enrichOne(null, { id: 'm1' } as any);

      expect(userStateProvider.getState).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'm1', userState: null });
    });

    it('should return userState null when userId is undefined', async () => {
      const result = await enricher.enrichOne(undefined, { id: 'm1' } as any);

      expect(userStateProvider.getState).not.toHaveBeenCalled();
      expect(result.userState).toBeNull();
    });

    it('should fetch state when userId is present', async () => {
      userStateProvider.getState.mockResolvedValue({
        mediaItemId: 'm1',
        state: 'watching',
      } as any);

      const result = await enricher.enrichOne('u1', { id: 'm1' } as any);

      expect(userStateProvider.getState).toHaveBeenCalledWith('u1', 'm1');
      expect(result).toEqual({
        id: 'm1',
        userState: { mediaItemId: 'm1', state: 'watching' },
      });
    });

    it('should return userState null when state not found', async () => {
      userStateProvider.getState.mockResolvedValue(null);

      const result = await enricher.enrichOne('u1', { id: 'm1' } as any);

      expect(result.userState).toBeNull();
    });
  });
});
