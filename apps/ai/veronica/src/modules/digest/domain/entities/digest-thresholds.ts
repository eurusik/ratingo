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
  };
}
