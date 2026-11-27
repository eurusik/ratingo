import type { ClockPort } from '@ratingo/ai-core';
import type { OpsExecutors } from '@ratingo/ai-ops-tools';

import { createOpsRuntime } from '../../../../core/ops-runtime.factory';

export const unavailableOps = (clock: ClockPort): OpsExecutors =>
  createOpsRuntime({ loki: {}, prometheus: {} }, clock).executors;
