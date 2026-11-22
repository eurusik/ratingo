import { METRIC_WINDOW_MAX_HOURS } from '../constants/investigation.constants';

const WINDOW_PATTERN = /^(\d{1,3})([hd])$/;
const QUEUE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PROVIDER_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{0,99}$/;
const HTTP_STATUS_PATTERN = /^[1-5]\d{2}$/;
const HOURS_PER_DAY = 24;

export interface MetricWindow {
  promql: string;
  hours: number;
}

export const parseWindow = (raw: string): MetricWindow | null => {
  const match = WINDOW_PATTERN.exec(raw);
  if (match === null) return null;
  const amount = Number(match[1]);
  const hours = match[2] === 'd' ? amount * HOURS_PER_DAY : amount;
  if (hours < 1 || hours > METRIC_WINDOW_MAX_HOURS) return null;
  return { promql: `${amount}${match[2]}`, hours };
};

export const isQueueName = (value: string): boolean => QUEUE_NAME_PATTERN.test(value);

export const isProviderName = (value: string): boolean => PROVIDER_NAME_PATTERN.test(value);

export const isHttpStatus = (value: string): boolean => HTTP_STATUS_PATTERN.test(value);
