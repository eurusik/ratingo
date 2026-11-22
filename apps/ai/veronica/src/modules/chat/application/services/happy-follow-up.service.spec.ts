import type { HappyLookup, HappyResult } from '../../domain/entities/happy';
import { HappyUnavailableError } from '../../domain/ports/happy-client.port';

import { HappyFollowUpService } from './happy-follow-up.service';

const RESULT: HappyResult = {
  status: 'reviewed',
  checkedSha: 'h1',
  current: true,
  title: 'Стоп. Так далі не поїде.',
  summary: '',
  skipReason: null,
  counts: { critical: 1, major: 0, minor: 0, nit: 0 },
  questions: [],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: null,
};

const setup = (lookup: HappyLookup | Error) => {
  const sent: string[] = [];
  const scheduled: { followUp: { attempt: number }; delay: number }[] = [];
  const service = new HappyFollowUpService(
    {
      latestResult: async () => {
        if (lookup instanceof Error) throw lookup;
        return lookup;
      },
      requestReview: jest.fn(),
    },
    {
      enqueue: async () => undefined,
      scheduleHappyFollowUp: async (followUp, delay) =>
        void scheduled.push({ followUp: followUp as { attempt: number }, delay }),
    },
    {
      sendMessage: async (_chatId: string, html: string) => void sent.push(html),
    } as never,
    { repository: 'eurusik/ratingo' },
  );
  return { service, sent, scheduled };
};

const job = (attempt = 1) => ({ chatId: '10', pullNumber: 470, headSha: 'h1', attempt });

describe('HappyFollowUpService', () => {
  it('posts the summary when the result for the requested commit is ready', async () => {
    const { service, sent, scheduled } = setup({
      kind: 'found',
      headSha: 'h1',
      reviewPending: false,
      result: RESULT,
    });
    expect(await service.handle(job())).toBe('deliver');
    expect(sent[0]).toContain('Стоп. Так далі не поїде.');
    expect(scheduled).toEqual([]);
  });

  it('polls again later, with the next attempt number, while the review runs', async () => {
    const { service, sent, scheduled } = setup({
      kind: 'found',
      headSha: 'h1',
      reviewPending: true,
      result: null,
    });
    expect(await service.handle(job(3))).toBe('wait');
    expect(sent).toEqual([]);
    expect(scheduled).toEqual([{ followUp: { ...job(), attempt: 4 }, delay: 30_000 }]);
  });

  it('keeps polling through an outage, then points to the pull request', async () => {
    const down = new HappyUnavailableError('HTTP 502');
    const early = setup(down);
    expect(await early.service.handle(job(2))).toBe('wait');
    const last = setup(down);
    expect(await last.service.handle(job(20))).toBe('give_up');
    expect(last.sent[0]).toContain('https://github.com/eurusik/ratingo/pull/470');
  });

  it('tells the owner when the head moved and nothing was published', async () => {
    const { service, sent } = setup({
      kind: 'found',
      headSha: 'h2',
      reviewPending: false,
      result: null,
    });
    expect(await service.handle(job())).toBe('head_moved');
    expect(sent[0]).toContain('новий коміт');
  });

  it('lets unexpected errors through for the queue to retry', async () => {
    await expect(setup(new Error('boom')).service.handle(job())).rejects.toThrow('boom');
  });
});
