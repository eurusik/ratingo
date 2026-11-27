import type {
  DumeFollowUp,
  DumeLookup,
  DumeSubmission,
  DumeSubmitResult,
} from '../domain/entities/dume';
import type { ChatJobQueuePort } from '../domain/ports/chat-job-queue.port';
import type { DelegationStorePort, InFlightClaim } from '../domain/ports/delegation-store.port';
import type { DumeClientPort } from '../domain/ports/dume-client.port';

export class FakeDumeClient implements DumeClientPort {
  readonly submissions: DumeSubmission[] = [];
  submitResult: DumeSubmitResult | Error = {
    kind: 'accepted',
    created: true,
    request: { requestId: 'tg1', state: 'queued', createdAtMs: 1_000 },
  };
  lookups: (DumeLookup | Error)[] = [];

  async submit(submission: DumeSubmission): Promise<DumeSubmitResult> {
    this.submissions.push(submission);
    if (this.submitResult instanceof Error) throw this.submitResult;
    return this.submitResult;
  }

  async find(): Promise<DumeLookup> {
    const next = this.lookups.length > 1 ? this.lookups.shift() : this.lookups[0];
    if (next === undefined) return { kind: 'not_found' };
    if (next instanceof Error) throw next;
    return next;
  }
}

export class FakeDelegationStore implements DelegationStorePort {
  readonly inFlight = new Map<string, string>();
  readonly delivered = new Set<string>();
  readonly confirmed = new Set<string>();

  async claimInFlight(chatId: string, requestId: string): Promise<InFlightClaim> {
    const held = this.inFlight.get(chatId);
    if (held !== undefined && held !== requestId) return { claimed: false, heldBy: held };
    this.inFlight.set(chatId, requestId);
    return { claimed: true };
  }

  async releaseInFlight(chatId: string, requestId: string): Promise<void> {
    if (this.inFlight.get(chatId) === requestId) this.inFlight.delete(chatId);
  }

  async claimDelivery(requestId: string): Promise<boolean> {
    if (this.delivered.has(requestId)) return false;
    this.delivered.add(requestId);
    return true;
  }

  async confirmDelivery(requestId: string): Promise<void> {
    this.confirmed.add(requestId);
  }

  async releaseDelivery(requestId: string): Promise<void> {
    this.delivered.delete(requestId);
  }
}

export class RecordingQueue implements ChatJobQueuePort {
  readonly dumeFollowUps: { followUp: DumeFollowUp; delayMs: number }[] = [];

  async enqueue(): Promise<void> {
    return undefined;
  }

  async scheduleHappyFollowUp(): Promise<void> {
    return undefined;
  }

  async scheduleDumeFollowUp(followUp: DumeFollowUp, delayMs: number): Promise<void> {
    this.dumeFollowUps.push({ followUp, delayMs });
  }
}
