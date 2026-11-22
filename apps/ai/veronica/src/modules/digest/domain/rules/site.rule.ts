import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, Fact, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import type { Measured } from '../entities/measured';
import type { SiteStats } from '../entities/snapshot';
import { BYTES_PER_MEGABYTE, PERCENT, itemOf, share } from './rule-helpers';

const MILLISECONDS_PER_SECOND = 1000;
const PERCENT_PRECISION = 10;

type Round = (value: number) => number;
type SiteThresholds = DigestThresholds['site'];

const roundToTenth = (value: number): number =>
  Math.round(value * PERCENT_PRECISION) / PERCENT_PRECISION;

const shareOfRequests = (part: Measured, requests: Measured): Measured => ({
  current: share(part.current, requests.current),
  baseline:
    part.baseline !== null && requests.baseline !== null
      ? share(part.baseline, requests.baseline)
      : null,
});

const scale = (value: number | null | undefined, factor: number, round: Round): number | null =>
  value === null || value === undefined ? null : round(value * factor);

const measuredFact = (
  label: string,
  unit: FactUnit,
  value: Measured | null,
  factor: number,
  round: Round = Math.round,
): Fact => ({
  label,
  unit,
  current: scale(value?.current, factor, round),
  baseline: scale(value?.baseline, factor, round),
});

const grewBeyond = (value: Measured | null, floor: number, ratio: number): boolean =>
  value !== null &&
  value.baseline !== null &&
  value.current >= floor &&
  value.current > value.baseline * ratio;

const growthNote = (
  id: string,
  advice: string,
  fact: Fact,
  value: Measured | null,
  floor: number,
  ratio: number,
): DigestItem[] =>
  grewBeyond(value, floor, ratio)
    ? [itemOf(id, DigestBlock.SITE, DigestLevel.NOTE, advice, [fact])]
    : [];

const isClearlyUp = (current: number, baseline: number | null, ratio: number): boolean =>
  baseline === null || current > baseline * ratio;

const serverErrorsAction = (
  site: SiteStats,
  errorShare: Measured,
  limits: SiteThresholds,
  fact: Fact,
): DigestItem[] =>
  site.requests24h.current >= limits.minRequests &&
  site.serverErrors24h.current >= limits.serverErrorMinCount &&
  errorShare.current >= limits.serverErrorShareForAction &&
  isClearlyUp(errorShare.current, errorShare.baseline, limits.serverErrorGrowthRatio)
    ? [
        itemOf(
          'site-server-errors',
          DigestBlock.SITE,
          DigestLevel.ACTION,
          'Сайт відповідає помилками сервера значно частіше, ніж зазвичай. Подивись логи storefront на Railway.',
          [fact],
        ),
      ]
    : [];

export const evaluateSite = (site: SiteStats, thresholds: DigestThresholds): RuleOutcome => {
  const limits = thresholds.site;
  const errorShare = shareOfRequests(site.serverErrors24h, site.requests24h);
  const errorFact = measuredFact(
    'помилок сервера (5xx)',
    FactUnit.PERCENT,
    errorShare,
    PERCENT,
    roundToTenth,
  );
  const renderFact = measuredFact(
    'p95 відповіді сервера',
    FactUnit.MILLISECONDS,
    site.renderP95Seconds,
    MILLISECONDS_PER_SECOND,
  );
  const memoryFact = measuredFact(
    'пік пам’яті сайту',
    FactUnit.MEGABYTES,
    site.peakRssBytes,
    1 / BYTES_PER_MEGABYTE,
  );
  const loopFact = measuredFact(
    'затримка event loop (p99)',
    FactUnit.MILLISECONDS,
    site.eventLoopDelayP99Seconds,
    MILLISECONDS_PER_SECOND,
  );
  const botFact = measuredFact(
    'запитів від ботів',
    FactUnit.PERCENT,
    site.botShare,
    PERCENT,
    roundToTenth,
  );
  const facts: Fact[] = [
    measuredFact('запитів до сайту', FactUnit.COUNT, site.requests24h, 1),
    errorFact,
    renderFact,
    memoryFact,
    loopFact,
    botFact,
  ];
  const items = [
    ...serverErrorsAction(site, errorShare, limits, errorFact),
    ...growthNote(
      'site-render-slow',
      'Сторінки сайту відповідають помітно повільніше, ніж тиждень тому.',
      renderFact,
      site.renderP95Seconds,
      limits.renderP95FloorSeconds,
      limits.renderP95GrowthRatioForNote,
    ),
    ...growthNote(
      'site-memory-growth',
      'Сайт займає помітно більше пам’яті, ніж тиждень тому. Подивись, чи немає витоку.',
      memoryFact,
      site.peakRssBytes,
      limits.memoryFloorMegabytes * BYTES_PER_MEGABYTE,
      limits.memoryGrowthRatioForNote,
    ),
    ...growthNote(
      'site-event-loop-delay',
      'Сервер сайту частіше «підвисає», ніж тиждень тому: затримка циклу подій зросла.',
      loopFact,
      site.eventLoopDelayP99Seconds,
      limits.eventLoopDelayFloorSeconds,
      limits.eventLoopDelayGrowthRatioForNote,
    ),
  ];
  return { items, facts };
};
