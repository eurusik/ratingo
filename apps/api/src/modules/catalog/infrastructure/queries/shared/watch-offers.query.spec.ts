import { Test, TestingModule } from '@nestjs/testing';
import { WatchOffersQuery } from './watch-offers.query';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import { DatabaseException } from '../../../../../common/exceptions/database.exception';
import { createDrizzleThenable } from '../../__test__/drizzle-mock.utils';

describe('WatchOffersQuery', () => {
  let query: WatchOffersQuery;
  let db: any;
  let selectChain: any;

  const setup = (options: { resolveWith?: any[]; rejectWith?: Error } = {}) => {
    selectChain = createDrizzleThenable(options.resolveWith ?? [], options.rejectWith);
    db = {
      select: jest.fn().mockReturnValue(selectChain),
    };

    return Test.createTestingModule({
      providers: [WatchOffersQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('fetchForMediaItem', () => {
    it('should return watch offers for a media item', async () => {
      const mockOffers = [
        {
          providerId: 'netflix',
          displayName: 'Netflix',
          logoPath: '/logos/netflix.png',
          priority: 1,
          offerType: 'flatrate',
          region: 'UA',
          link: 'https://netflix.com/watch/123',
        },
        {
          providerId: 'apple',
          displayName: 'Apple TV+',
          logoPath: '/logos/apple.png',
          priority: 2,
          offerType: 'buy',
          region: 'US',
          link: 'https://tv.apple.com/movie/123',
        },
      ];
      const module: TestingModule = await setup({ resolveWith: mockOffers });
      query = module.get(WatchOffersQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual(mockOffers);
      expect(db.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
      expect(selectChain.innerJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should return empty array when no watch offers found', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      query = module.get(WatchOffersQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('DB Error') });
      query = module.get(WatchOffersQuery);

      await expect(query.fetchForMediaItem('media-1')).rejects.toThrow(DatabaseException);
    });

    it('should call query with correct structure', async () => {
      const module: TestingModule = await setup();
      query = module.get(WatchOffersQuery);

      await query.fetchForMediaItem('media-1');

      // Verify the select was called with the expected fields
      expect(db.select).toHaveBeenCalledWith({
        providerId: expect.anything(),
        displayName: expect.anything(),
        logoPath: expect.anything(),
        priority: expect.anything(),
        offerType: expect.anything(),
        region: expect.anything(),
        link: expect.anything(),
      });
    });
  });
});
