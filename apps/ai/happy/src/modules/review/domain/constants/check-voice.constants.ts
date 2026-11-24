export const CheckVoice = {
  CLEAN: 'Периметр чистий. Проходь.',
  CRITICAL: 'Стоп. Так далі не поїде.',
  MAJOR: 'Затримую на вході: є що виправити.',
  MINOR: 'Пропускаю, але дещо записав.',
  QUESTIONS: 'Маю питання до водія.',
  TRIVIAL: 'Цей сам доїде, огляд не потрібен.',
  TOO_LARGE: 'Вантаж завеликий для одного огляду. Розбий на кілька заїздів.',
  COVERAGE_GAP: 'Оглянув не все: ось що пропустив.',
  RELEASE_CHECKLIST: 'Список вантажу на виїзд.',
  BUDGET_EXHAUSTED: 'Зміна закінчилась. Завтра огляну.',
} as const;
export type CheckVoice = (typeof CheckVoice)[keyof typeof CheckVoice];

export const SKIPPED_TITLE_PREFIX = 'Пропущено';
