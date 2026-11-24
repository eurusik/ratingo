import fc from 'fast-check';

import { DigestLevel } from '../constants/digest-level.constants';
import { THRESHOLDS, healthySite } from '../../testing/digest.testing';
import { measured } from '../entities/measured';
import type { SiteStats } from '../entities/snapshot';

import { evaluateSite } from './site.rule';

const MEGABYTE = 1024 * 1024;
const limits = THRESHOLDS.site;

const idsOf = (site: SiteStats): string[] =>
  evaluateSite(site, THRESHOLDS).items.map((item) => item.id);

const withErrors = (errors: number, requests: number, baseline: number | null = 0): SiteStats => ({
  ...healthySite(),
  requests24h: measured(requests, requests),
  serverErrors24h: measured(errors, baseline),
});

const counts = fc.integer({ min: 0, max: 200_000 });
const optionalMeasured = (max: number) =>
  fc.option(
    fc.record({
      current: fc.double({ min: 0, max, noNaN: true }),
      baseline: fc.option(fc.double({ min: 0, max, noNaN: true }), { nil: null }),
    }),
    { nil: null },
  );

const siteArb: fc.Arbitrary<SiteStats> = fc.record({
  requests24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  serverErrors24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  renderP95Seconds: optionalMeasured(10),
  peakRssBytes: optionalMeasured(4 * 1024 * MEGABYTE),
  eventLoopDelayP99Seconds: optionalMeasured(5),
  botShare: optionalMeasured(1),
});

describe('evaluateSite', () => {
  it('stays quiet for a healthy site', () => {
    expect(evaluateSite(healthySite(), THRESHOLDS).items).toEqual([]);
  });

  it('does not treat 404 crawler noise as a problem because only 5xx counts are read', () => {
    expect(idsOf({ ...healthySite(), requests24h: measured(14_300, 13_000) })).toEqual([]);
  });

  it('raises an action when the 5xx share is above the floor and clearly up', () => {
    const items = evaluateSite(withErrors(400, 10_000, 5), THRESHOLDS).items;
    expect(items.map((item) => [item.id, item.level])).toEqual([
      ['site-server-errors', DigestLevel.ACTION],
    ]);
  });

  it('stays calm when the share is high but not up against last week', () => {
    expect(idsOf(withErrors(400, 10_000, 380))).toEqual([]);
  });

  it('raises an action on a high share when there is no baseline yet', () => {
    expect(idsOf(withErrors(400, 10_000, null))).toEqual(['site-server-errors']);
  });

  it('ignores a high share on a handful of requests', () => {
    expect(idsOf(withErrors(5, 50))).toEqual([]);
  });

  it('notes slower renders, memory growth and event loop delay against the baseline', () => {
    const site: SiteStats = {
      ...healthySite(),
      renderP95Seconds: measured(0.9, 0.3),
      peakRssBytes: measured(700 * MEGABYTE, 300 * MEGABYTE),
      eventLoopDelayP99Seconds: measured(0.4, 0.05),
    };
    expect(idsOf(site).sort()).toEqual([
      'site-event-loop-delay',
      'site-memory-growth',
      'site-render-slow',
    ]);
  });

  it('never notes growth without a baseline or below the floors', () => {
    const noBaseline: SiteStats = {
      ...healthySite(),
      renderP95Seconds: measured(9),
      peakRssBytes: measured(3000 * MEGABYTE),
      eventLoopDelayP99Seconds: measured(4),
    };
    const belowFloors: SiteStats = {
      ...healthySite(),
      renderP95Seconds: measured(limits.renderP95FloorSeconds / 2, 0.01),
      peakRssBytes: measured((limits.memoryFloorMegabytes / 2) * MEGABYTE, MEGABYTE),
      eventLoopDelayP99Seconds: measured(limits.eventLoopDelayFloorSeconds / 2, 0.001),
    };
    expect(idsOf(noBaseline)).toEqual([]);
    expect(idsOf(belowFloors)).toEqual([]);
  });

  it('keeps the bot line empty, never zero, when the label is not exported yet', () => {
    const bot = evaluateSite(healthySite(), THRESHOLDS).facts.find(
      (fact) => fact.label === 'запитів від ботів',
    );
    expect(bot).toEqual({
      label: 'запитів від ботів',
      unit: 'percent',
      current: null,
      baseline: null,
    });
  });

  it('shows the bot share as a percentage when the label exists', () => {
    const bot = evaluateSite(
      { ...healthySite(), botShare: measured(0.314, 0.2) },
      THRESHOLDS,
    ).facts.find((fact) => fact.label === 'запитів від ботів');
    expect(bot).toMatchObject({ current: 31.4, baseline: 20 });
  });

  it('always reports the same six facts and only site items for any readings', () => {
    fc.assert(
      fc.property(siteArb, (site) => {
        const outcome = evaluateSite(site, THRESHOLDS);
        expect(outcome.facts).toHaveLength(6);
        expect(outcome.items.every((item) => item.block === 'site')).toBe(true);
        expect(outcome.items.filter((item) => item.level === DigestLevel.ACTION)).toHaveLength(
          idsOf(site).includes('site-server-errors') ? 1 : 0,
        );
      }),
    );
  });

  it('turns missing readings into empty facts and never into zero', () => {
    fc.assert(
      fc.property(counts, (requests) => {
        const facts = evaluateSite(
          {
            ...healthySite(),
            requests24h: measured(requests, null),
            renderP95Seconds: null,
            peakRssBytes: null,
            eventLoopDelayP99Seconds: null,
            botShare: null,
          },
          THRESHOLDS,
        ).facts;
        const missing = facts.filter((fact) => fact.current === null).map((fact) => fact.label);
        expect(missing).toEqual([
          'p95 відповіді сервера',
          'пік пам’яті сайту',
          'затримка event loop (p99)',
          'запитів від ботів',
        ]);
      }),
    );
  });

  it('never raises an action for a share below the floor, whatever the baseline', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 200_000 }),
        fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
        (requests, baselineShare) => {
          const errors = Math.floor(requests * (limits.serverErrorShareForAction - 0.001));
          const baseline = baselineShare === null ? null : Math.floor(requests * baselineShare);
          expect(idsOf(withErrors(errors, requests, baseline))).not.toContain('site-server-errors');
        },
      ),
    );
  });
});
