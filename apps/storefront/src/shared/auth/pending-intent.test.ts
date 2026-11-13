import fc from 'fast-check';
import { closeAuth } from './auth-opener';
import type { AuthIntent } from './auth-opener';
import {
  parsePendingIntent,
  rememberPendingIntent,
  serializePendingIntent,
  takePendingIntent,
} from './pending-intent';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const NOW = 1_800_000_000_000;

const intents = fc.record({
  kind: fc.constant('save' as const),
  title: fc.string(),
  mediaItemId: fc.string({ minLength: 1 }),
});

const ANDOR: AuthIntent = { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' };

describe('pending sign-in intent', () => {
  afterEach(() => window.sessionStorage.clear());

  it('reads back any intent saved within fifteen minutes', () => {
    fc.assert(
      fc.property(intents, fc.integer({ min: 0, max: FIFTEEN_MINUTES }), (intent, age) => {
        expect(parsePendingIntent(serializePendingIntent(intent, NOW), NOW + age)).toEqual(intent);
      }),
    );
  });

  it('drops an intent once it is too old or from the future', () => {
    fc.assert(
      fc.property(intents, fc.integer({ min: 1, max: FIFTEEN_MINUTES }), (intent, drift) => {
        const raw = serializePendingIntent(intent, NOW);
        expect(parsePendingIntent(raw, NOW + FIFTEEN_MINUTES + drift)).toBeNull();
        expect(parsePendingIntent(raw, NOW - drift)).toBeNull();
      }),
    );
  });

  it('never trusts arbitrary stored text', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json()), (raw) => {
        const parsed = parsePendingIntent(raw, NOW);
        if (parsed !== null) expect(parsed.kind).toBe('save');
      }),
    );
    expect(parsePendingIntent('{"intent":{"kind":"delete"},"savedAt":0}', 0)).toBeNull();
  });

  it('hands the intent over once after the redirect', () => {
    rememberPendingIntent(ANDOR, NOW);

    expect(takePendingIntent(NOW + 1000)).toEqual(ANDOR);
    expect(takePendingIntent(NOW + 1000)).toBeNull();
  });

  it('forgets the intent when the sign-in dialog is closed', () => {
    rememberPendingIntent(ANDOR, NOW);
    closeAuth();
    expect(takePendingIntent(NOW)).toBeNull();
  });
});
