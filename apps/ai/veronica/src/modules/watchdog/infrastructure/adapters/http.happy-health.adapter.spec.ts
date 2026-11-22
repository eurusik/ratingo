import { HappyProbe } from '../../domain/entities/happy-probe';

import { HttpHappyHealthAdapter } from './http.happy-health.adapter';

const respond = (ok: boolean) => jest.fn().mockResolvedValue({ ok });

describe('HttpHappyHealthAdapter', () => {
  it('skips when the URL is not set', async () => {
    const fetchImpl = jest.fn();
    await expect(new HttpHappyHealthAdapter({}, fetchImpl).probe()).resolves.toBe(
      HappyProbe.SKIPPED,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls /health without doubling slashes and reports up', async () => {
    const fetchImpl = respond(true);
    const adapter = new HttpHappyHealthAdapter(
      { internalUrl: 'http://happy.internal:3005/' },
      fetchImpl,
    );
    await expect(adapter.probe()).resolves.toBe(HappyProbe.UP);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://happy.internal:3005/health');
  });

  it('reports down on an error status or a network failure', async () => {
    await expect(
      new HttpHappyHealthAdapter({ internalUrl: 'http://h' }, respond(false)).probe(),
    ).resolves.toBe(HappyProbe.DOWN);
    await expect(
      new HttpHappyHealthAdapter(
        { internalUrl: 'http://h' },
        jest.fn().mockRejectedValue(new Error('refused')),
      ).probe(),
    ).resolves.toBe(HappyProbe.DOWN);
  });
});
