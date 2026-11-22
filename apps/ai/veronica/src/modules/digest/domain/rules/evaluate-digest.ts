import { DIGEST_BLOCK_ORDER, DigestBlock } from '../constants/digest-block.constants';
import { DIGEST_LEVEL_RANK, DigestLevel } from '../constants/digest-level.constants';
import type { DigestSource } from '../constants/digest-source.constants';
import {
  DigestSource as Sources,
  OPTIONAL_SOURCES,
  SOURCE_BLOCK,
  SOURCE_LABEL,
} from '../constants/digest-source.constants';
import type {
  BlockReport,
  Digest,
  DigestItem,
  RuleOutcome,
  SourceStatus,
} from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import type { Snapshot } from '../entities/snapshot';
import type { SourceReading } from '../entities/source-reading';
import { SourceState } from '../entities/source-reading';
import { evaluateBackup } from './backup.rule';
import { evaluateApiKeys, evaluateHttpErrors } from './external-apis.rule';
import { evaluateInfra } from './infra.rule';
import { evaluateProduct } from './product.rule';
import { evaluateQueues } from './queues.rule';
import { itemOf } from './rule-helpers';
import { evaluateScheduler } from './scheduler.rule';

interface SourceEvaluation {
  source: DigestSource;
  reading: SourceReading<unknown>;
  outcome: RuleOutcome | null;
}

const evaluateSource = <T>(
  source: DigestSource,
  reading: SourceReading<T>,
  rule: (data: T) => RuleOutcome,
): SourceEvaluation => ({
  source,
  reading,
  outcome: reading.state === SourceState.OK ? rule(reading.data) : null,
});

const evaluateSources = (snapshot: Snapshot, thresholds: DigestThresholds): SourceEvaluation[] => [
  evaluateSource(Sources.PRODUCT, snapshot.product, (data) => evaluateProduct(data, thresholds)),
  evaluateSource(Sources.QUEUES, snapshot.queues, (data) => evaluateQueues(data, thresholds)),
  evaluateSource(Sources.SCHEDULER, snapshot.scheduler, (data) =>
    evaluateScheduler(data, thresholds),
  ),
  evaluateSource(Sources.API_KEYS, snapshot.apiKeys, (data) => evaluateApiKeys(data)),
  evaluateSource(Sources.HTTP_ERRORS, snapshot.httpErrors, (data) =>
    evaluateHttpErrors(data, thresholds),
  ),
  evaluateSource(Sources.BACKUP, snapshot.backup, (data) => evaluateBackup(data, thresholds)),
  evaluateSource(Sources.INFRA, snapshot.infra, (data) => evaluateInfra(data, thresholds)),
];

const missingSourcesItem = (evaluations: readonly SourceEvaluation[]): DigestItem | null => {
  const missing = evaluations.filter(
    (evaluation) => evaluation.outcome === null && !OPTIONAL_SOURCES.includes(evaluation.source),
  );
  if (missing.length === 0) {
    return null;
  }
  const required = evaluations.filter((e) => !OPTIONAL_SOURCES.includes(e.source));
  const blind = missing.length === required.length;
  const names = missing.map((evaluation) => SOURCE_LABEL[evaluation.source]).join(', ');
  return itemOf(
    'sources-missing',
    DigestBlock.SERVICES,
    blind ? DigestLevel.ACTION : DigestLevel.NOTE,
    blind
      ? `Звіт сліпий: немає жодних даних (${names}). Перевір токен і доступ до Grafana.`
      : `Немає даних про: ${names}. Перевір доступ до Grafana.`,
  );
};

const statusOf = (evaluation: SourceEvaluation): SourceStatus => ({
  source: evaluation.source,
  state: evaluation.reading.state,
  ...(evaluation.reading.state === SourceState.UNAVAILABLE
    ? { reason: evaluation.reading.reason }
    : {}),
});

const byImportance = (a: DigestItem, b: DigestItem): number =>
  DIGEST_LEVEL_RANK[b.level] - DIGEST_LEVEL_RANK[a.level] || a.id.localeCompare(b.id);

const reportFor = (
  block: DigestBlock,
  evaluations: readonly SourceEvaluation[],
  missing: DigestItem | null,
): BlockReport => {
  const inBlock = evaluations.filter((evaluation) => SOURCE_BLOCK[evaluation.source] === block);
  return {
    block,
    items: inBlock
      .flatMap((evaluation) => evaluation.outcome?.items ?? [])
      .concat(missing?.block === block ? [missing] : [])
      .sort(byImportance),
    facts: inBlock.flatMap((evaluation) => evaluation.outcome?.facts ?? []),
  };
};

const worstLevel = (items: readonly DigestItem[]): DigestLevel =>
  items.reduce<DigestLevel>(
    (worst, item) =>
      DIGEST_LEVEL_RANK[item.level] > DIGEST_LEVEL_RANK[worst] ? item.level : worst,
    DigestLevel.OK,
  );

export const evaluateDigest = (snapshot: Snapshot, thresholds: DigestThresholds): Digest => {
  const evaluations = evaluateSources(snapshot, thresholds);
  const missing = missingSourcesItem(evaluations);
  const blocks = DIGEST_BLOCK_ORDER.map((block) => reportFor(block, evaluations, missing));
  return {
    date: snapshot.date,
    level: worstLevel(blocks.flatMap((block) => block.items)),
    blocks,
    sources: evaluations.map(statusOf),
  };
};
