import { AnticipatedShowsService } from './anticipated-shows.service';

describe('AnticipatedShowsService', () => {
  it('looks for premieres above the anticipation threshold that are still ahead, through the next 90 days', async () => {
    const shows = [{ mediaItemId: 'm1' }];
    const showRepository = { findAnticipated: jest.fn().mockResolvedValue(shows) };
    const clock = { now: () => new Date('2026-11-20T15:30:00.000Z') };
    const service = new AnticipatedShowsService(showRepository as never, clock);

    await expect(service.findAnticipated(20)).resolves.toBe(shows);

    expect(showRepository.findAnticipated).toHaveBeenCalledWith({
      from: new Date('2026-11-20T15:30:00.000Z'),
      toExclusive: new Date('2027-02-19T00:00:00.000Z'),
      minListCount: 1000,
      limit: 20,
    });
  });
});
