import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import { measured } from '../entities/measured';
import type { ApiKeyStat, HttpErrorStat } from '../entities/snapshot';
import { ApiKeyState, HttpErrorKind } from '../entities/snapshot';
import { factOf, itemOf, sumMeasured } from './rule-helpers';

const serverName = (server: string, thresholds: DigestThresholds): string =>
  thresholds.http.serverNames[server] ?? server;

const keyItem = (key: ApiKeyStat): DigestItem | null => {
  switch (key.state) {
    case ApiKeyState.INVALID:
      return itemOf(
        `api-key:${key.provider}`,
        DigestBlock.SERVICES,
        DigestLevel.ACTION,
        `Ключ ${key.provider} не працює. Онови його у змінних Railway.`,
      );
    case ApiKeyState.DEGRADED:
      return itemOf(
        `api-key:${key.provider}`,
        DigestBlock.SERVICES,
        DigestLevel.NOTE,
        `Ключ ${key.provider} працює з перебоями.`,
      );
    case ApiKeyState.UNKNOWN:
      return itemOf(
        `api-key:${key.provider}`,
        DigestBlock.SERVICES,
        DigestLevel.NOTE,
        `Стан ключа ${key.provider} невідомий: перевірка ще не відпрацювала.`,
      );
    case ApiKeyState.VALID:
      return null;
  }
};

export const evaluateApiKeys = (keys: readonly ApiKeyStat[]): RuleOutcome => ({
  items: keys.map(keyItem).filter((item): item is DigestItem => item !== null),
  facts: [
    factOf(
      'ключів не в порядку',
      FactUnit.COUNT,
      measured(keys.filter((key) => key.state !== ApiKeyState.VALID).length),
    ),
  ],
});

const httpItem = (error: HttpErrorStat, thresholds: DigestThresholds): DigestItem | null => {
  if (error.count.current <= 0) {
    return null;
  }
  const name = serverName(error.server, thresholds);
  const fact = factOf('відповідей', FactUnit.COUNT, error.count);
  if (error.kind === HttpErrorKind.AUTH) {
    return itemOf(
      `http-auth:${error.server}`,
      DigestBlock.SERVICES,
      DigestLevel.ACTION,
      `${name} відхиляє наші запити: доступ заборонено. Перевір ключ або токен.`,
      [fact],
    );
  }
  const heavy = error.count.current >= thresholds.http.rateLimitCountForAction;
  return itemOf(
    `http-rate-limit:${error.server}`,
    DigestBlock.SERVICES,
    heavy ? DigestLevel.ACTION : DigestLevel.NOTE,
    heavy
      ? `${name} часто обмежує швидкість: ліміт майже вичерпано. Зменш частоту запитів або підвищ тариф.`
      : `${name} інколи обмежує швидкість. Поки що це не збій, але стеж, чи не росте.`,
    [fact],
  );
};

export const evaluateHttpErrors = (
  errors: readonly HttpErrorStat[],
  thresholds: DigestThresholds,
): RuleOutcome => {
  const ofKind = (kind: HttpErrorKind) =>
    sumMeasured(errors.filter((error) => error.kind === kind).map((error) => error.count));
  return {
    items: errors
      .map((error) => httpItem(error, thresholds))
      .filter((item): item is DigestItem => item !== null),
    facts: [
      factOf('відмов у доступі', FactUnit.COUNT, ofKind(HttpErrorKind.AUTH)),
      factOf('обмежень швидкості', FactUnit.COUNT, ofKind(HttpErrorKind.RATE_LIMIT)),
    ],
  };
};
