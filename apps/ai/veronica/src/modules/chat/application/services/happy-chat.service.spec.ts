import type { HappyLookup, HappyResult, HappyReviewRequest } from '../../domain/entities/happy';
import { HappyUnavailableError } from '../../domain/ports/happy-client.port';

import { HappyChatService } from './happy-chat.service';

const RESULT: HappyResult = {
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
};

const found = (result: HappyResult | null, reviewPending = false): HappyLookup => ({
  kind: 'found',
  headSha: 'h1',
  reviewPending,
  result,
});

const setup = (lookup: HappyLookup | Error, request?: HappyReviewRequest | Error) => {
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
    { latestResult, requestReview },
    {
      enqueue: async () => undefined,
      scheduleHappyFollowUp: async (followUp, delay) => void scheduled.push({ followUp, delay }),
    },
    { repository: 'eurusik/ratingo' },
  );
  return { service, latestResult, requestReview, scheduled };
};

const number = (value: number) => ({ kind: 'number' as const, number: value });

describe('HappyChatService', () => {
  it('shows a fresh result at once and requests nothing', async () => {
    const { service, requestReview, scheduled } = setup(found(RESULT));
    const html = await service.reply('10', number(470));
    expect(html).toContain('Периметр чистий');
    expect(requestReview).not.toHaveBeenCalled();
    expect(scheduled).toEqual([]);
  });

  it('requests a review when the result is old or missing and schedules a follow-up', async () => {
    for (const lookup of [found(null), found({ ...RESULT, current: false })]) {
      const { service, requestReview, scheduled } = setup(lookup);
      expect(await service.reply('10', number(470))).toContain('Хеппі взявся');
      expect(requestReview).toHaveBeenCalledWith(470);
      expect(scheduled).toEqual([
        { followUp: { chatId: '10', pullNumber: 470, headSha: 'h1', attempt: 1 }, delay: 30_000 },
      ]);
    }
  });

  it('does not request again while a review is already running', async () => {
    const { service, requestReview, scheduled } = setup(found(null, true));
    expect(await service.reply('10', number(470))).toContain('вже оглядає');
    expect(requestReview).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
  });

  it('explains a refusal without scheduling anything', async () => {
    const { service, scheduled } = setup(found(null), { kind: 'skipped', reason: 'merged' });
    expect(await service.reply('10', number(470))).toContain('уже злитий');
    expect(scheduled).toEqual([]);
  });

  it('says the pull request was not found', async () => {
    expect(await setup({ kind: 'not_found' }).service.reply('10', number(9))).toContain('№9');
  });

  it('rejects another repository and an unclear target without calling Happy', async () => {
    const { service, latestResult } = setup(found(RESULT));
    const foreign = await service.reply('10', {
      kind: 'link',
      pullRequest: { owner: 'other', repo: 'repo', number: 1 },
    });
    expect(foreign).toContain('eurusik/ratingo');
    expect(await service.reply('10', { kind: 'unclear' })).toContain('номер PR');
    expect(latestResult).not.toHaveBeenCalled();
  });

  it('accepts a link to the configured repository in any letter case', async () => {
    const { service, latestResult } = setup(found(RESULT));
    await service.reply('10', {
      kind: 'link',
      pullRequest: { owner: 'Eurusik', repo: 'Ratingo', number: 431 },
    });
    expect(latestResult).toHaveBeenCalledWith(431);
  });

  it('answers honestly when Happy is down, on either call', async () => {
    const down = new HappyUnavailableError('HTTP 503');
    expect(await setup(down).service.reply('10', number(1))).toContain('недоступний');
    expect(await setup(found(null), down).service.reply('10', number(1))).toContain('недоступний');
  });

  it('lets unexpected errors through for the queue to retry', async () => {
    await expect(setup(new Error('boom')).service.reply('10', number(1))).rejects.toThrow('boom');
  });
});
