import { Inject, Injectable } from '@nestjs/common';

import {
  ANTICIPATED_SHOWS_MIN_LIST_COUNT,
  ANTICIPATED_SHOWS_WINDOW_DAYS,
} from '@/common/constants';
import { addUtcDays, startOfUtcDay } from '@/common/utils/date.util';
import {
  type AnticipatedShow,
  type IShowRepository,
  SHOW_REPOSITORY,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

@Injectable()
export class AnticipatedShowsService {
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  findAnticipated(limit: number): Promise<AnticipatedShow[]> {
    const now = this.clock.now();
    return this.showRepository.findAnticipated({
      from: now,
      toExclusive: addUtcDays(startOfUtcDay(now), ANTICIPATED_SHOWS_WINDOW_DAYS + 1),
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      limit,
    });
  }
}
