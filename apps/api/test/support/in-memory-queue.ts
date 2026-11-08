import type { JobsOptions } from 'bullmq';

interface QueuedJob {
  id: string;
  name: string;
  data: unknown;
  opts?: JobsOptions;
}

interface BulkJob {
  name: string;
  data: unknown;
  opts?: JobsOptions;
}

export class InMemoryQueue {
  readonly jobs: QueuedJob[] = [];

  constructor(readonly name: string) {}

  add(name: string, data: unknown, opts?: JobsOptions): Promise<QueuedJob> {
    const job = { id: String(this.jobs.length + 1), name, data, opts };
    this.jobs.push(job);
    return Promise.resolve(job);
  }

  addBulk(jobs: BulkJob[]): Promise<QueuedJob[]> {
    return Promise.all(jobs.map(({ name, data, opts }) => this.add(name, data, opts)));
  }

  getJob(id: string): Promise<QueuedJob | undefined> {
    return Promise.resolve(this.jobs.find((job) => job.id === id));
  }

  getJobs(): Promise<QueuedJob[]> {
    return Promise.resolve([...this.jobs]);
  }

  getJobCounts(): Promise<Record<string, number>> {
    return Promise.resolve({ waiting: this.jobs.length });
  }

  getJobSchedulers(): Promise<never[]> {
    return Promise.resolve([]);
  }

  getRepeatableJobs(): Promise<never[]> {
    return Promise.resolve([]);
  }

  upsertJobScheduler(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  removeJobScheduler(): Promise<boolean> {
    return Promise.resolve(false);
  }

  removeRepeatableByKey(): Promise<boolean> {
    return Promise.resolve(false);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
