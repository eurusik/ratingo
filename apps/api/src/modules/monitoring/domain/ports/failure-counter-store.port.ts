import { type MonitoredProvider } from '../constants/monitored-provider.const';
import { type ProviderFailureCounts } from '../entities/key-health-snapshot.entity';

export interface FailureCounterStore {
  increment(provider: MonitoredProvider, statusCode: number | undefined): Promise<void>;
  get(provider: MonitoredProvider): Promise<ProviderFailureCounts>;
}

export const FAILURE_COUNTER_STORE = Symbol('FAILURE_COUNTER_STORE');
