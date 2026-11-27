import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { EXTERNAL_API_FAILURE_EVENT } from '@/common/events/external-api-failure.event';
import tvmazeConfig from '@/config/tvmaze.config';
import { EpisodeScheduleUnavailableError } from '@/modules/ingestion/domain/errors/episode-schedule-unavailable.error';

import { TvMazeAdapter } from './tvmaze.adapter';

global.fetch = jest.fn();
const fetchMock = global.fetch as jest.Mock;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status: number) => ({
  ok: false,
  status,
  statusText: 'error',
  headers: new Headers(),
});

const episodeResponse = {
  id: 1,
  season: 1,
  number: 1,
  name: 'Pilot',
  summary: '<p>Intro</p>',
  airstamp: '2023-01-01T20:00:00+00:00',
  runtime: 60,
  image: { original: 'http://image.com/1.jpg' },
  rating: { average: 8.5 },
};

describe('TvMazeAdapter', () => {
  let adapter: TvMazeAdapter;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    fetchMock.mockReset();
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TvMazeAdapter,
        { provide: tvmazeConfig.KEY, useValue: { apiUrl: 'https://api.tvmaze.com' } },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    adapter = module.get(TvMazeAdapter);
  });

  describe('getEpisodesByImdbId', () => {
    it('maps the episodes of the found show as exact instants', async () => {
      fetchMock.mockResolvedValueOnce(ok({ id: 123 })).mockResolvedValueOnce(ok([episodeResponse]));

      const result = await adapter.getEpisodesByImdbId('tt1234567');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Pilot',
          overview: 'Intro',
          airDate: new Date('2023-01-01T20:00:00+00:00'),
          airDateDayOnly: false,
          runtime: 60,
          stillPath: 'http://image.com/1.jpg',
          rating: 8.5,
        },
      ]);
    });

    it('returns no episodes when TVMaze does not know the show', async () => {
      fetchMock.mockResolvedValueOnce(failed(404));

      await expect(adapter.getEpisodesByImdbId('tt0000000')).resolves.toEqual([]);
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('returns no episodes when the episodes list is not found', async () => {
      fetchMock.mockResolvedValueOnce(ok({ id: 123 })).mockResolvedValueOnce(failed(404));

      await expect(adapter.getEpisodesByImdbId('tt123')).resolves.toEqual([]);
    });

    it('reports a forbidden answer as unavailable and emits a key failure', async () => {
      fetchMock.mockResolvedValue(failed(403));

      const error = await adapter.getEpisodesByImdbId('tt123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EpisodeScheduleUnavailableError);
      expect((error as EpisodeScheduleUnavailableError).statusCode).toBe(403);
      expect(emitter.emit).toHaveBeenCalledWith(EXTERNAL_API_FAILURE_EVENT, {
        provider: 'tvmaze',
        statusCode: 403,
      });
    });

    it('reports a server error after retries as unavailable without a key failure', async () => {
      fetchMock.mockResolvedValueOnce(ok({ id: 123 })).mockResolvedValue(failed(503));

      await expect(adapter.getEpisodesByImdbId('tt123')).rejects.toBeInstanceOf(
        EpisodeScheduleUnavailableError,
      );
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('reports an empty response body as unavailable', async () => {
      fetchMock.mockResolvedValueOnce(ok(null));

      await expect(adapter.getEpisodesByImdbId('tt123')).rejects.toBeInstanceOf(
        EpisodeScheduleUnavailableError,
      );
    });
  });

  describe('getEpisodesByShowName', () => {
    it('searches by the encoded name', async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ id: 86953, name: 'Тиха Нава' }))
        .mockResolvedValueOnce(ok([{ ...episodeResponse, image: null }]));

      const result = await adapter.getEpisodesByShowName('Тиха Нава');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/singlesearch/shows?q=${encodeURIComponent('Тиха Нава')}`),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result[0].stillPath).toBeNull();
    });

    it('returns no episodes when no show matches the name', async () => {
      fetchMock.mockResolvedValueOnce(failed(404));

      await expect(adapter.getEpisodesByShowName('NonexistentShow12345')).resolves.toEqual([]);
    });

    it('maps null and missing ratings to null', async () => {
      fetchMock.mockResolvedValueOnce(ok({ id: 86953 })).mockResolvedValueOnce(
        ok([
          { ...episodeResponse, airstamp: null, rating: { average: null } },
          { ...episodeResponse, number: 2, rating: undefined },
        ]),
      );

      const result = await adapter.getEpisodesByShowName('Test');

      expect(result.map((episode) => episode.rating)).toEqual([null, null]);
      expect(result[0].airDate).toBeNull();
    });

    it('reports an unauthorized answer as unavailable', async () => {
      fetchMock.mockResolvedValue(failed(401));

      await expect(adapter.getEpisodesByShowName('Test')).rejects.toBeInstanceOf(
        EpisodeScheduleUnavailableError,
      );
    });
  });
});
