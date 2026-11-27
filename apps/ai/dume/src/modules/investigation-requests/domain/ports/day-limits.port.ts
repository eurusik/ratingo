export interface DayLimitsPort {
  spentTodayUsd(): Promise<number>;
  dayBudgetUsd(): number;
  acceptedToday(): Promise<number>;
  countAccepted(): Promise<void>;
  maxPerDay(): number;
}

export const DAY_LIMITS = Symbol('DAY_LIMITS');
