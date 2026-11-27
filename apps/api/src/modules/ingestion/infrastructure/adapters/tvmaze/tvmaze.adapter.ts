import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MS_PER_SECOND } from '@/common/constants';
import {
  EXTERNAL_API_PROVIDER,
  emitExternalApiFailure,
} from '@/common/events/external-api-failure.event';
import {
  HttpError,
  ResilientHttpClient,
  type RetryConfig,
} from '@/common/http/resilient-http.client';
import { SlidingWindowRateLimiter } from '@/common/http/sliding-window-rate-limiter';
import tvmazeConfig from '@/config/tvmaze.config';
import { EpisodeScheduleUnavailableError } from '@/modules/ingestion/domain/errors/episode-schedule-unavailable.error';
import {
  type EpisodeSchedulePort,
  type ScheduledEpisode,
} from '@/modules/ingestion/domain/ports/episode-schedule.port';

const TVMAZE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxTotalTimeMs: 20_000,
  timeoutMs: 10_000,
};

const TVMAZE_MAX_REQUESTS_PER_WINDOW = 18;
const TVMAZE_RATE_WINDOW_SECONDS = 10;
const TVMAZE_RATE_WINDOW_MS = TVMAZE_RATE_WINDOW_SECONDS * MS_PER_SECOND;

interface TvMazeShow {
  id: number;
  name?: string;
}

interface TvMazeEpisodeResponse {
  id: number;
  season: number;
  number: number;
  name: string;
  summary: string | null;
  airstamp: string | null;
  runtime: number | null;
  image: { original: string; medium: string } | null;
  rating: { average: number | null } | null;
}

@Injectable()
export class TvMazeAdapter implements EpisodeSchedulePort {
  private readonly httpClient = new ResilientHttpClient(TVMAZE_RETRY_CONFIG);
  private readonly rateLimiter = new SlidingWindowRateLimiter(
    TVMAZE_MAX_REQUESTS_PER_WINDOW,
    TVMAZE_RATE_WINDOW_MS,
  );

  constructor(
    @Inject(tvmazeConfig.KEY)
    private readonly config: ConfigType<typeof tvmazeConfig>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getEpisodesByImdbId(imdbId: string): Promise<ScheduledEpisode[]> {
    const show = await this.fetch<TvMazeShow>(`/lookup/shows?imdb=${imdbId}`);
    return this.episodesOf(show);
  }

  async getEpisodesByShowName(showName: string): Promise<ScheduledEpisode[]> {
    const show = await this.fetch<TvMazeShow>(
      `/singlesearch/shows?q=${encodeURIComponent(showName)}`,
    );
    return this.episodesOf(show);
  }

  private async episodesOf(show: TvMazeShow | null): Promise<ScheduledEpisode[]> {
    if (!show?.id) return [];

    const episodes = await this.fetch<TvMazeEpisodeResponse[]>(`/shows/${show.id}/episodes`);
    return Array.isArray(episodes) ? episodes.map((ep) => this.mapEpisode(ep)) : [];
  }

  private mapEpisode(ep: TvMazeEpisodeResponse): ScheduledEpisode {
    return {
      seasonNumber: ep.season,
      number: ep.number,
      title: ep.name,
      overview: ep.summary ? ep.summary.replace(/<[^>]*>/g, '').trim() : null,
      airDate: ep.airstamp ? new Date(ep.airstamp) : null,
      airDateDayOnly: false,
      runtime: ep.runtime,
      stillPath: ep.image?.original || null,
      rating: ep.rating?.average ?? null,
    };
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    await this.rateLimiter.acquire();
    const result = await this.httpClient.get<T>(`${this.config.apiUrl}${endpoint}`);

    if (result.success) {
      if (result.data !== null) return result.data;
      throw new EpisodeScheduleUnavailableError(HttpStatus.BAD_GATEWAY, 'empty response');
    }

    const status =
      result.error instanceof HttpError ? result.error.status : HttpStatus.SERVICE_UNAVAILABLE;
    if (status === HttpStatus.NOT_FOUND) return null;

    emitExternalApiFailure(this.eventEmitter, EXTERNAL_API_PROVIDER.TVMAZE, status);
    throw new EpisodeScheduleUnavailableError(status, result.error?.message ?? 'request failed');
  }
}
