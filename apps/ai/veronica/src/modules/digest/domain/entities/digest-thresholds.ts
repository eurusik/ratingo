export interface DigestThresholds {
  queues: {
    minBacklog: number;
    failureMinVolume: number;
    failureShareForAction: number;
    drainHoursForAction: number;
    drainHoursForNote: number;
    backlogNoteOnly: readonly string[];
  };
  product: {
    minBaseline: number;
    dropRatioForNote: number;
  };
  site: {
    minRequests: number;
    serverErrorMinCount: number;
    serverErrorShareForAction: number;
    serverErrorGrowthRatio: number;
    renderP95FloorSeconds: number;
    renderP95GrowthRatioForNote: number;
    memoryFloorMegabytes: number;
    memoryGrowthRatioForNote: number;
    eventLoopDelayFloorSeconds: number;
    eventLoopDelayGrowthRatioForNote: number;
  };
  http: {
    rateLimitCountForAction: number;
    rateLimitNoteMinCount: number;
    rateLimitGrowthRatioForNote: number;
    serverNames: Readonly<Record<string, string>>;
  };
  backup: {
    staleHours: number;
    shrinkRatioForNote: number;
  };
  infra: {
    redisMemoryRatioForNote: number;
  };
  scheduler: {
    staleHours: number;
    runGraceHours: number;
  };
}
