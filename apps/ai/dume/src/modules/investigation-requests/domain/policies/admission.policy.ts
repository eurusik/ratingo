import { RejectionReason } from '../constants/request.constants';

export interface AdmissionReading {
  spentTodayUsd: number;
  dayBudgetUsd: number;
  acceptedToday: number;
  maxPerDay: number;
  waiting: number;
  maxWaiting: number;
}

export const decideAdmission = (reading: AdmissionReading): RejectionReason | null => {
  if (reading.spentTodayUsd >= reading.dayBudgetUsd) return RejectionReason.DAY_BUDGET;
  if (reading.acceptedToday >= reading.maxPerDay) return RejectionReason.DAILY_COUNT_CAP;
  if (reading.waiting >= reading.maxWaiting) return RejectionReason.QUEUE_FULL;
  return null;
};
