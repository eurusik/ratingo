import { JOB_STATUS } from '@/common/enums/job-status.enum';

import { mapBullStateToJobStatus } from './job-status-mapper';

describe('mapBullStateToJobStatus', () => {
  it.each([
    ['waiting', JOB_STATUS.QUEUED],
    ['prioritized', JOB_STATUS.QUEUED],
    ['delayed', JOB_STATUS.QUEUED],
    ['paused', JOB_STATUS.QUEUED],
    ['active', JOB_STATUS.PROCESSING],
    ['completed', JOB_STATUS.READY],
    ['failed', JOB_STATUS.FAILED],
    ['stalled', JOB_STATUS.FAILED],
  ])('should map "%s" to %s', (state, expected) => {
    expect(mapBullStateToJobStatus(state)).toBe(expected);
  });

  it('should infer READY for unknown state with finishedOn', () => {
    expect(mapBullStateToJobStatus('unknown-state', Date.now())).toBe(JOB_STATUS.READY);
  });

  it('should infer FAILED for unknown state without finishedOn', () => {
    expect(mapBullStateToJobStatus('unknown-state')).toBe(JOB_STATUS.FAILED);
    expect(mapBullStateToJobStatus('unknown-state', null)).toBe(JOB_STATUS.FAILED);
  });
});
