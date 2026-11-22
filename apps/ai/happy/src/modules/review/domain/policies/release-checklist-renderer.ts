import { MAX_LISTED_ITEMS } from '../constants/release.constants';
import { formatPullRequest, type PullRequestRef } from '../entities/pull-request';

import type { DependencyChange, ReleaseChecklist } from './release-checklist';

const SHORT_SHA_LENGTH = 7;
const NONE = 'немає';
const CHANGE_LABELS: Readonly<Record<DependencyChange['change'], string>> = {
  added: 'додано',
  removed: 'прибрано',
  changed: 'змінено версію',
};

const bullets = (items: readonly string[]): string[] => {
  if (items.length === 0) return [`- ${NONE}`];
  const shown = items.slice(0, MAX_LISTED_ITEMS).map((item) => `- ${item}`);
  const hidden = items.length - shown.length;
  return hidden > 0 ? [...shown, `- ще ${hidden}`] : shown;
};

const safe = (text: string): string => text.replace(/`/g, "'");

export const renderReleaseChecklist = (
  ref: PullRequestRef,
  headSha: string,
  checklist: ReleaseChecklist,
  truncated: boolean,
): string => {
  const migrationItems = checklist.migrations.map(
    ({ path, risks }) => `\`${safe(path)}\`${risks.length > 0 ? `: ${risks.join('; ')}` : ''}`,
  );
  const dependencyItems = checklist.dependencies.flatMap(({ path, changes }) =>
    changes.map(
      ({ name, change }) => `\`${safe(path)}\`: ${safe(name)} (${CHANGE_LABELS[change]})`,
    ),
  );
  return [
    `## Чекліст релізу Happy: ${formatPullRequest(ref)}`,
    '',
    'Це перевірка без моделі: список ризиків із diff, а не код-ревʼю.',
    ...(truncated ? ['', 'Увага: PR завеликий, список файлів неповний.'] : []),
    '',
    '### Міграції БД',
    ...bullets(migrationItems),
    '',
    '### Нові змінні середовища (за diff, евристика)',
    ...bullets(checklist.envVars.map((name) => `\`${name}\``)),
    '',
    '### Змінені застосунки та пакети',
    ...bullets(checklist.services.map((service) => `\`${safe(service)}\``)),
    '',
    '### Залежності',
    ...bullets(dependencyItems),
    ...(checklist.lockfileChanged ? ['- package-lock.json змінено'] : []),
    '',
    `<sub>Коміт ${headSha.slice(0, SHORT_SHA_LENGTH)} · файлів: ${checklist.fileCount} · вартість $0.0000</sub>`,
  ].join('\n');
};
