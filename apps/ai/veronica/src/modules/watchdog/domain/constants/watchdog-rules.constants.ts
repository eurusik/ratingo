export const AlertKey = {
  HAPPY_DOWN: 'happy_down',
  DIGEST_MISSING: 'digest_missing',
  BUDGET_AGENT: 'budget_agent',
  BUDGET_CHAT: 'budget_chat',
  FAILED_RUNS: 'failed_runs',
  BUDGET_HAPPY: 'budget_happy',
  BUDGET_DUME: 'budget_dume',
  FAILED_RUNS_HAPPY: 'failed_runs_happy',
  FAILED_RUNS_DUME: 'failed_runs_dume',
} as const;
export type AlertKey = (typeof AlertKey)[keyof typeof AlertKey];

export const ALERT_KEYS: readonly AlertKey[] = Object.values(AlertKey);

export const WATCHDOG_INTERVAL_MINUTES = 5;
export const HAPPY_FAILURES_TO_ALERT = 2;
export const DIGEST_DEADLINE_MINUTES_OF_DAY = 9 * 60 + 30;
export const BUDGET_ALERT_RATIO = 0.8;
export const BUDGET_COMPARISON_EPSILON = 1e-9;
export const FAILED_RUNS_TO_ALERT = 3;
export const FAILED_RUNS_WINDOW_MS = 60 * 60 * 1000;
export const FAILED_RUN_OUTCOMES = 'model_error|unexpected_error';
export const PERCENT = 100;
export const MONEY_DECIMALS = 2;

const DIGEST_DEADLINE_LABEL = '09:30';

export const happyDownText = (minutes: number): string =>
  `🔴 Хеппі не відповідає ${minutes} хв. Перевір Railway → happy → Deployments`;

export const digestMissingText = (): string =>
  `🔴 Ранкового звіту досі немає, а вже за ${DIGEST_DEADLINE_LABEL}. Перевір Railway → veronica → Deployments. /digest надішле звіт одразу`;

export const budgetAgentText = (percent: number, spentUsd: string, limitUsd: string): string =>
  `🟠 Вероніка витратила ${percent}% денного бюджету ($${spentUsd} із $${limitUsd}). Глянь, на що пішли гроші: /last`;

export const budgetChatText = (percent: number, spentUsd: string, limitUsd: string): string =>
  `🟠 Чат Вероніки витратив ${percent}% денного бюджету ($${spentUsd} із $${limitUsd}). Далі вона відповідатиме лише готовим станом`;

export const failedRunsText = (count: number): string =>
  `🔴 ${count} невдалих запусків за останню годину. Перевір Railway → veronica → Logs`;

export interface WatchedAgent {
  agent: string;
  label: string;
  budgetKey: AlertKey;
  failedRunsKey: AlertKey;
}

export const WATCHED_AGENTS: readonly WatchedAgent[] = [
  {
    agent: 'happy',
    label: 'Хеппі',
    budgetKey: AlertKey.BUDGET_HAPPY,
    failedRunsKey: AlertKey.FAILED_RUNS_HAPPY,
  },
  {
    agent: 'dume',
    label: 'DUM-E',
    budgetKey: AlertKey.BUDGET_DUME,
    failedRunsKey: AlertKey.FAILED_RUNS_DUME,
  },
];

export const watchedAgentBudgetText = (
  label: string,
  percent: number,
  spentUsd: string,
  limitUsd: string,
): string => `🟠 Бюджет ${label} за добу: ${percent}% ($${spentUsd} із $${limitUsd})`;

export const watchedAgentFailedRunsText = (label: string, service: string, count: number): string =>
  `🔴 ${label}: невдалих запусків за останню годину: ${count}. Перевір Railway → ${service} → Logs`;

export const RECOVERY_TEXT: Readonly<Record<AlertKey, string>> = {
  [AlertKey.HAPPY_DOWN]: '✅ відновилось: Хеппі знову відповідає',
  [AlertKey.DIGEST_MISSING]: '✅ відновилось: ранковий звіт надіслано',
  [AlertKey.BUDGET_AGENT]: '✅ відновилось: витрати Вероніки знову нижче порогу',
  [AlertKey.BUDGET_CHAT]: '✅ відновилось: витрати чату знову нижче порогу',
  [AlertKey.FAILED_RUNS]: '✅ відновилось: невдалих запусків знову менше трьох за годину',
  [AlertKey.BUDGET_HAPPY]: '✅ відновилось: витрати Хеппі знову нижче порогу',
  [AlertKey.BUDGET_DUME]: '✅ відновилось: витрати DUM-E знову нижче порогу',
  [AlertKey.FAILED_RUNS_HAPPY]:
    '✅ відновилось: невдалих запусків Хеппі знову менше трьох за годину',
  [AlertKey.FAILED_RUNS_DUME]:
    '✅ відновилось: невдалих запусків DUM-E знову менше трьох за годину',
};
