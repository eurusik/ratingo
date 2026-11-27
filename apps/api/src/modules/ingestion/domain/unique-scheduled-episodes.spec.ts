import { type ScheduledEpisode } from './ports/episode-schedule.port';
import { uniqueScheduledEpisodes } from './unique-scheduled-episodes';

const episode = (
  seasonNumber: number,
  number: number,
  fields: Partial<ScheduledEpisode> = {},
): ScheduledEpisode => ({ seasonNumber, number, title: `S${seasonNumber}E${number}`, ...fields });

describe('uniqueScheduledEpisodes', () => {
  it('keeps every episode when no season and number repeats', () => {
    const episodes = [episode(1, 1), episode(1, 2), episode(2, 1)];

    expect(uniqueScheduledEpisodes(episodes)).toEqual({ episodes, duplicates: [] });
  });

  it('keeps one episode per season and number, in the original order, the first copy on a tie', () => {
    const tenth = episode(1, 10);
    const eleventh = episode(1, 11, { title: "The Siblings' Room" });
    const eleventhCopy = episode(1, 11, { title: "The Siblings' Room" });
    const twelfth = episode(1, 12);

    const result = uniqueScheduledEpisodes([tenth, eleventh, eleventhCopy, twelfth]);

    expect(result.episodes).toHaveLength(3);
    expect(result.episodes[0]).toBe(tenth);
    expect(result.episodes[1]).toBe(eleventh);
    expect(result.episodes[2]).toBe(twelfth);
    expect(result.duplicates).toEqual(['S1E11']);
  });

  it('handles specials numbered zero like any other episode', () => {
    const special = episode(0, 0);
    const result = uniqueScheduledEpisodes([special, episode(0, 0), episode(1, 0)]);

    expect(result.episodes[0]).toBe(special);
    expect(result.episodes).toHaveLength(2);
    expect(result.duplicates).toEqual(['S0E0']);
  });

  it('keeps the copy with more data', () => {
    const sparse = episode(1, 3, { overview: null, stillPath: null });
    const rich = episode(1, 3, {
      overview: 'Plot',
      stillPath: 'https://tvmaze/3.jpg',
      runtime: 45,
    });

    expect(uniqueScheduledEpisodes([sparse, rich]).episodes[0]).toBe(rich);
    expect(uniqueScheduledEpisodes([rich, sparse]).episodes[0]).toBe(rich);
  });

  it('treats the same number in different seasons as different episodes', () => {
    const episodes = [episode(1, 1), episode(2, 1)];

    expect(uniqueScheduledEpisodes(episodes).episodes).toHaveLength(2);
  });

  it('reports each repeated episode once', () => {
    const result = uniqueScheduledEpisodes([episode(1, 5), episode(1, 5), episode(1, 5)]);

    expect(result.episodes).toHaveLength(1);
    expect(result.duplicates).toEqual(['S1E5']);
  });
});
