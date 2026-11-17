import { Inject, Injectable } from '@nestjs/common';

import { addUtcDays, startOfUtcDay } from '@/common/utils/date.util';
import {
  type IMovieRepository,
  MOVIE_REPOSITORY,
  type UpcomingMovie,
  type WithTotal,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

export interface UpcomingMoviesRequest {
  days: number;
  limit: number;
  offset: number;
}

@Injectable()
export class UpcomingMoviesService {
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  findUpcoming({ days, limit, offset }: UpcomingMoviesRequest): Promise<WithTotal<UpcomingMovie>> {
    const today = startOfUtcDay(this.clock.now());
    return this.movieRepository.findUpcoming({
      from: today,
      toExclusive: addUtcDays(today, days + 1),
      limit,
      offset,
    });
  }
}
