import { FixedClock, type AgentFolder } from '@ratingo/ai-core';

import { FailureReason, RequestState } from '../../domain/constants/request.constants';
import {
  InMemoryRequestStore,
  NOW_MS,
  queuedRecord,
} from '../../testing/investigation-requests.testing';

import { InvestigationLookupService } from './investigation-lookup.service';

const TIMEOUT_MS = 240_000;
const folder = { manifest: { limits: { timeoutMs: TIMEOUT_MS } } } as unknown as AgentFolder;

describe('InvestigationLookupService', () => {
  it('returns null for an unknown request', async () => {
    const service = new InvestigationLookupService(
      new InMemoryRequestStore(),
      folder,
      new FixedClock(NOW_MS),
    );

    expect(await service.find('tg1000009')).toBeNull();
  });

  it('turns a run that is far past its timeout into an interrupted one and keeps that', async () => {
    const store = new InMemoryRequestStore();
    await store.save(queuedRecord({ state: RequestState.RUNNING, startedAtMs: NOW_MS }));
    const service = new InvestigationLookupService(
      store,
      folder,
      new FixedClock(NOW_MS + 10 * 60_000),
    );

    const record = await service.find('tg1000001');

    expect(record).toMatchObject({ state: RequestState.FAILED, reason: FailureReason.INTERRUPTED });
    expect(store.records.get('tg1000001')?.reason).toBe(FailureReason.INTERRUPTED);
  });

  it('returns a healthy record as it is', async () => {
    const store = new InMemoryRequestStore();
    const record = queuedRecord();
    await store.save(record);
    const service = new InvestigationLookupService(store, folder, new FixedClock(NOW_MS));

    expect(await service.find('tg1000001')).toBe(record);
  });
});
