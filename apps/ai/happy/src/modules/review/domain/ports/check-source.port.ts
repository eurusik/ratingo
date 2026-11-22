import type { Check } from '../entities/check';

export const CHECK_SOURCE_PORT = Symbol('CHECK_SOURCE_PORT');

export interface CheckSourcePort {
  list(): readonly Check[];
}
