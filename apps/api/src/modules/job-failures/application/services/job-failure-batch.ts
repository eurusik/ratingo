import { type JobFailureTally } from '@/modules/job-failures/domain/entities/job-failure-tally.entity';
import { type JobFailure } from '@/modules/job-failures/domain/entities/job-failure.entity';
import {
  tallyKeyOf,
  tallyWith,
} from '@/modules/job-failures/domain/policies/job-failure-tally.policy';

export interface DrainedBatch {
  readonly tallies: readonly JobFailureTally[];
  readonly droppedFailures: number;
}

export class JobFailureBatch {
  private tallies = new Map<string, JobFailureTally>();
  private droppedFailures = 0;

  constructor(private readonly maxRows: number) {}

  add(failure: JobFailure): void {
    const key = tallyKeyOf(failure);
    const tally = this.tallies.get(key);
    if (tally === undefined && this.tallies.size >= this.maxRows) {
      this.droppedFailures += 1;
      return;
    }
    this.tallies.set(key, tallyWith(tally, failure));
  }

  drain(): DrainedBatch {
    const drained = { tallies: [...this.tallies.values()], droppedFailures: this.droppedFailures };
    this.tallies = new Map();
    this.droppedFailures = 0;
    return drained;
  }
}
