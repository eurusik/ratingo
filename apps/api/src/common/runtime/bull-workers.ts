import { WorkerHost } from '@nestjs/bullmq';
import { type DiscoveryService } from '@nestjs/core';

import { type Worker } from 'bullmq';

export const findBullWorkers = (discovery: DiscoveryService): Worker[] =>
  discovery
    .getProviders()
    .map(({ instance }) => instance)
    .filter((instance): instance is WorkerHost => instance instanceof WorkerHost)
    .map((host) => host.worker);
