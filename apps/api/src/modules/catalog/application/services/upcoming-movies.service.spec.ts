import { UpcomingMoviesService } from './upcoming-movies.service';

describe('UpcomingMoviesService', () => {
  it('looks for releases from the start of today through the last day of the window', async () => {
    const movies = Object.assign([], { total: 0 });
    const movieRepository = { findUpcoming: jest.fn().mockResolvedValue(movies) };
    const clock = { now: () => new Date('2026-11-17T15:30:00.000Z') };
    const service = new UpcomingMoviesService(movieRepository as never, clock);

    await expect(service.findUpcoming({ days: 120, limit: 20, offset: 40 })).resolves.toBe(movies);

    expect(movieRepository.findUpcoming).toHaveBeenCalledWith({
      from: new Date('2026-11-17T00:00:00.000Z'),
      toExclusive: new Date('2027-03-18T00:00:00.000Z'),
      limit: 20,
      offset: 40,
    });
  });
});
