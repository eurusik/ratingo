import { parseJobIdPrefix } from './job-id-prefix';

describe('parseJobIdPrefix', () => {
  it('moves the job id from the message into a field', () => {
    expect(
      parseJobIdPrefix('[job:backfill-mdblist-ratings_8f3c_20261126] Failed: timeout'),
    ).toEqual({
      text: 'Failed: timeout',
      fields: { job_id: 'backfill-mdblist-ratings_8f3c_20261126' },
    });
  });

  it('leaves messages without a prefix alone', () => {
    expect(parseJobIdPrefix('Unknown job type: x')).toEqual({ text: 'Unknown job type: x' });
  });

  it('only reads the prefix at the start of the message', () => {
    expect(parseJobIdPrefix('retrying [job:1] later')).toEqual({ text: 'retrying [job:1] later' });
  });
});
