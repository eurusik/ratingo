import { type MonitoredProvider } from '../constants/monitored-provider.const';
import {
  type KeyHealthSnapshot,
  type SaveKeyHealthInput,
} from '../entities/key-health-snapshot.entity';

export interface KeyHealthRepository {
  save(snapshot: SaveKeyHealthInput): Promise<void>;
  findLatestPerProvider(): Promise<KeyHealthSnapshot[]>;
  findHistory(provider: MonitoredProvider, limit: number): Promise<KeyHealthSnapshot[]>;
}

export const KEY_HEALTH_REPOSITORY = Symbol('KEY_HEALTH_REPOSITORY');
