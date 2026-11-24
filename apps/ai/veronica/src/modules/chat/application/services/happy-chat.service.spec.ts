import type {
  HappyLookup,
  HappyOpenPullRequest,
  HappyResult,
  HappyReviewRequest,
} from '../../domain/entities/happy';
import { HappyUnavailableError } from '../../domain/ports/happy-client.port';

import { HappyChatService } from './happy-chat.service';

const RESULT: HappyResult = {
  kind: 'review',
  status: 'reviewed',
  checkedSha: 'h1',
  current: true,
  title: 'Периметр чистий. Проходь.',
  summary: 'Усе гаразд.',
  skipReason: null,
  counts: { critical: 0, major: 0, minor: 0, nit: 0 },
  questions: [],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: null,
  review: null,
};

const found = (result: HappyResult | null, reviewPending = false): HappyLookup => ({
  kind: 'found',
  headSha: 'h1',
  baseBranch: 'main',
  headBranch: 'feature',
  reviewPending,
  result,
});

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

const setup = (
  lookup: HappyLookup | Error,
  request?: HappyReviewRequest | Error,
  open: HappyOpenPullRequest[] = [],
) => {
  const latestResult = jest.fn(async () => {
    if (lookup instanceof Error) throw lookup;
    return lookup;
  });
  const requestReview = jest.fn(async () => {
    if (request instanceof Error) throw request;
    return request ?? { kind: 'queued' as const, headSha: 'h1' };
  });
  const scheduled: { followUp: unknown; delay: number }[] = [];
  const service = new HappyChatService(
    { latestResult, requestReview, listOpenPullRequests: async () => open },
    {
      enqueue: async () => undefined,
      scheduleHappyFollowUp: async (followUp, delay) => void scheduled.push({ followUp, delay }),
    },
    { repository: 'eurusik/ratingo' },
    { nowMs: () => NOW_MS },
  );
  return { service, latestResult, requestReview, scheduled };
};

const number = (value: number) => ({ kind: 'number' as const, number: value });

describe('HappyChatService', () => {
  it('shows a fresh result at once and requests nothing', async () => {
    const { service, requestReview, scheduled } = setup(found(RESULT));
    const html = await service.reply('10', number(470), 'auto');
    expect(html).toContain('Периметр чистий');
    expect(requestReview).not.toHaveBeenCalled();
    expect(scheduled).toEqual([]);
  });

  describe('full review', () => {
    const scope = (mode: 'incremental' | 'full') => ({
      ...RESULT,
      review: {
        mode,
        baseSha: null,
        fullReason: null,
        files: 1,
        statusCounts: { new: 0, stillOpen: 0, resolved: 0, needsRecheck: 0 },
      },
    });

    it('asks for a full review even when the current result is incremental', async () => {
      const { service, requestReview, scheduled } = setup(found(scope('incremental')));
      expect(await service.reply('10', number(470), 'full')).toContain('Хеппі взявся');
      expect(requestReview).toHaveBeenCalledWith(470, 'full');
      expect(scheduled).toEqual([
        {
          followUp: { chatId: '10', pullNumber: 470, headSha: 'h1', attempt: 1, mode: 'full' },
          delay: 30_000,
        },
      ]);
    });

    it('shows a current result at once when it already is a full review', async () => {
      const { service, requestReview } = setup(found(scope('full')));
      expect(await service.reply('10', number(470), 'full')).toContain('Периметр чистий');
      expect(requestReview).not.toHaveBeenCalled();
    });

    it('remembers the full mode when a review is already running', async () => {
      const { service, scheduled } = setup(found(null, true));
      await service.reply('10', number(470), 'full');
      expect(scheduled[0]?.followUp).toMatchObject({ mode: 'full' });
    });
  });

  it('requests a review when the result is old or missing and schedules a follow-up', async () => {
    for (const lookup of [found(null), found({ ...RESULT, current: false })]) {
      const { service, requestReview, scheduled } = setup(lookup);
      expect(await service.reply('10', number(470), 'auto')).toContain('Хеппі взявся');
      expect(requestReview).toHaveBeenCalledWith(470, 'auto');
      expect(scheduled).toEqual([
        { followUp: { chatId: '10', pullNumber: 470, headSha: 'h1', attempt: 1 }, delay: 30_000 },
      ]);
    }
  });

  it('does not request again while a review is already running', async () => {
    const { service, requestReview, scheduled } = setup(found(null, true));
    expect(await service.reply('10', number(470), 'auto')).toContain('вже оглядає');
    expect(requestReview).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
  });

  it('explains a refusal without scheduling anything', async () => {
    const { service, scheduled } = setup(found(null), { kind: 'skipped', reason: 'merged' });
    expect(await service.reply('10', number(470), 'auto')).toContain('уже злитий');
    expect(scheduled).toEqual([]);
  });

  it('says the pull request was not found', async () => {
    expect(await setup({ kind: 'not_found' }).service.reply('10', number(9), 'auto')).toContain(
      '№9',
    );
  });

  it('rejects another repository and an unclear target without calling Happy', async () => {
    const { service, latestResult } = setup(found(RESULT));
    const foreign = await service.reply(
      '10',
      {
        kind: 'link',
        pullRequest: { owner: 'other', repo: 'repo', number: 1 },
      },
      'auto',
    );
    expect(foreign).toContain('eurusik/ratingo');
    expect(await service.reply('10', { kind: 'unclear' }, 'auto')).toContain('номер PR');
    expect(latestResult).not.toHaveBeenCalled();
  });

  it('accepts a link to the configured repository in any letter case', async () => {
    const { service, latestResult } = setup(found(RESULT));
    await service.reply(
      '10',
      {
        kind: 'link',
        pullRequest: { owner: 'Eurusik', repo: 'Ratingo', number: 431 },
      },
      'auto',
    );
    expect(latestResult).toHaveBeenCalledWith(431);
  });

  it('answers honestly when Happy is down, on either call', async () => {
    const down = new HappyUnavailableError('HTTP 503');
    expect(await setup(down).service.reply('10', number(1), 'auto')).toContain('недоступний');
    expect(await setup(found(null), down).service.reply('10', number(1), 'auto')).toContain(
      'недоступний',
    );
  });

  it('lets unexpected errors through for the queue to retry', async () => {
    await expect(setup(new Error('boom')).service.reply('10', number(1), 'auto')).rejects.toThrow(
      'boom',
    );
  });

  describe('without a number', () => {
    const pick = { kind: 'pick' as const };
    const open = (number: number, title = 'Fix <b>trending</b>'): HappyOpenPullRequest => ({
      number,
      title,
      author: 'alice',
      updatedAtMs: NOW_MS - 2 * 3_600_000,
    });

    it('takes the only open pull request, names it and answers as with a number', async () => {
      const { service, requestReview, scheduled } = setup(found(null), undefined, [open(471)]);
      const html = await service.reply('10', pick, 'auto');
      expect(html).toContain('Беру PR №471 «Fix &lt;b&gt;trending&lt;/b&gt;»');
      expect(html).toContain('Хеппі взявся');
      expect(requestReview).toHaveBeenCalledWith(471, 'auto');
      expect(scheduled).toHaveLength(1);
    });

    it('shows a fresh result for the only open pull request without a new review', async () => {
      const { service, requestReview } = setup(found(RESULT), undefined, [open(471)]);
      const html = await service.reply('10', pick, 'auto');
      expect(html).toContain('Периметр чистий');
      expect(requestReview).not.toHaveBeenCalled();
    });

    it('lists up to five when there are several and starts nothing', async () => {
      const pulls = [1, 2, 3, 4, 5, 6].map((n) => open(n));
      const { service, requestReview, latestResult } = setup(found(null), undefined, pulls);
      const html = await service.reply('10', pick, 'auto');
      expect(html).toContain('Який глянути?');
      expect(html).toContain('№5');
      expect(html).not.toContain('№6');
      expect(html).toContain('2 год тому');
      expect(html).toContain('alice');
      expect(requestReview).not.toHaveBeenCalled();
      expect(latestResult).not.toHaveBeenCalled();
    });

    it('says there is nothing to review when no pull request is open', async () => {
      const { service, requestReview } = setup(found(null), undefined, []);
      expect(await service.reply('10', pick, 'auto')).toContain('немає');
      expect(requestReview).not.toHaveBeenCalled();
    });

    it('answers honestly when Happy cannot list pull requests', async () => {
      const service = new HappyChatService(
        {
          latestResult: jest.fn(),
          requestReview: jest.fn(),
          listOpenPullRequests: async () => {
            throw new HappyUnavailableError('HTTP 502');
          },
        },
        { enqueue: jest.fn(), scheduleHappyFollowUp: jest.fn() },
        { repository: 'eurusik/ratingo' },
        { nowMs: () => NOW_MS },
      );
      expect(await service.reply('10', pick, 'auto')).toContain('недоступний');
    });
  });
});
