import * as fc from 'fast-check';

import { AlertKey } from '../constants/watchdog-rules.constants';

import { evaluateDigest, isPastDigestDeadline, kyivMinutesOfDay } from './digest-deadline.policy';

const utc = (iso: string): number => Date.parse(iso);

describe('digest deadline', () => {
  it.each([
    ['winter, one minute before', '2026-12-10T07:29:00Z', false],
    ['winter, on the minute', '2026-12-10T07:30:00Z', true],
    ['summer, one minute before', '2026-07-10T06:29:00Z', false],
    ['summer, on the minute', '2026-07-10T06:30:00Z', true],
    ['spring switch day (EEST from 04:00)', '2026-03-29T06:30:00Z', true],
    ['spring switch day, before', '2026-03-29T06:29:00Z', false],
    ['autumn switch day (EET after 04:00)', '2026-10-25T07:30:00Z', true],
    ['autumn switch day, before', '2026-10-25T07:29:00Z', false],
  ])('%s', (_label, iso, expected) => {
    expect(isPastDigestDeadline(utc(iso))).toBe(expected);
  });

  it('reads Kyiv local time across midnight in both seasons', () => {
    expect(kyivMinutesOfDay(utc('2026-12-09T22:00:00Z'))).toBe(0);
    expect(kyivMinutesOfDay(utc('2026-07-09T21:00:00Z'))).toBe(0);
    expect(kyivMinutesOfDay(utc('2026-12-09T21:59:00Z'))).toBe(23 * 60 + 59);
  });

  it('keeps minutes of the Kyiv day within one day for any instant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1_700_000_000_000, max: 2_000_000_000_000 }), (nowMs) => {
        const minutes = kyivMinutesOfDay(nowMs);
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThan(24 * 60);
      }),
    );
  });

  it('is healthy once today’s digest is sent, even after the deadline', () => {
    expect(evaluateDigest(utc('2026-12-10T12:00:00Z'), true)?.finding).toBeNull();
  });

  it('fails after the deadline without a digest', () => {
    const result = evaluateDigest(utc('2026-12-10T07:30:00Z'), false);
    expect(result?.key).toBe(AlertKey.DIGEST_MISSING);
    expect(result?.finding?.text).toContain('/digest');
  });

  it('leaves the alert untouched before the deadline without a digest, e.g. just after midnight', () => {
    expect(evaluateDigest(utc('2026-12-09T22:05:00Z'), false)).toBeNull();
    expect(evaluateDigest(utc('2026-12-10T06:00:00Z'), false)).toBeNull();
  });

  it('decides purely by Kyiv minutes and the delivery flag', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_700_000_000_000, max: 2_000_000_000_000 }),
        fc.boolean(),
        (nowMs, delivered) => {
          const result = evaluateDigest(nowMs, delivered);
          if (delivered) expect(result?.finding).toBeNull();
          else if (isPastDigestDeadline(nowMs)) expect(result?.finding).not.toBeNull();
          else expect(result).toBeNull();
        },
      ),
    );
  });
});
