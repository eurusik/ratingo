import type { DigestThresholds } from '../modules/digest/domain/entities/digest-thresholds';

export const DIGEST_THRESHOLDS: DigestThresholds = {
  queues: {
    minBacklog: 50,
    failureMinVolume: 10,
    failureShareForAction: 0.1,
    drainHoursForAction: 24,
    drainHoursForNote: 6,
    backlogNoteOnly: ['ratings-backfill'],
  },
  product: {
    minBaseline: 10,
    dropRatioForNote: 0.5,
  },
  site: {
    minRequests: 500,
    serverErrorMinCount: 20,
    serverErrorShareForAction: 0.02,
    serverErrorGrowthRatio: 2,
    renderP95FloorSeconds: 0.5,
    renderP95GrowthRatioForNote: 1.5,
    memoryFloorMegabytes: 400,
    memoryGrowthRatioForNote: 1.5,
    eventLoopDelayFloorSeconds: 0.1,
    eventLoopDelayGrowthRatioForNote: 2,
  },
  http: {
    rateLimitCountForAction: 500,
    rateLimitNoteMinCount: 20,
    rateLimitGrowthRatioForNote: 0.5,
    serverNames: {
      'api.themoviedb.org': 'TMDB',
      'api.trakt.tv': 'Trakt',
      'api.mdblist.com': 'MDBList',
      'api.tvmaze.com': 'TVMaze',
    },
  },
  backup: {
    staleHours: 36,
    shrinkRatioForNote: 0.3,
  },
  infra: {
    redisMemoryRatioForNote: 0.85,
  },
  scheduler: {
    staleHours: 36,
  },
};
