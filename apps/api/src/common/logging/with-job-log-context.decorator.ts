import { runWithLogContext } from '@ratingo/node-telemetry';
import type { Job } from 'bullmq';

type JobProcessor = (job: Job<never>, ...rest: never[]) => unknown;

export const WithJobLogContext =
  (queue: string): MethodDecorator =>
  (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as unknown as JobProcessor;
    const wrapped = function (this: unknown, job: Job<never>, ...rest: never[]): unknown {
      return runWithLogContext({ queue, job_id: String(job.id), job_name: job.name }, () =>
        original.call(this, job, ...rest),
      );
    };
    descriptor.value = wrapped as unknown as typeof descriptor.value;
  };
