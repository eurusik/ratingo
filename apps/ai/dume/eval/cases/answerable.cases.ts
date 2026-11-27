import { CaseKind, type EvalCase } from '../eval-case';

const API = 'apps/api/src';

export const ANSWERABLE_CASES: readonly EvalCase[] = [
  {
    id: 'job-failures-gap',
    kind: CaseKind.ANSWERABLE,
    question:
      'Чому таблиця падінь джобів (job_failures) ніколи не містить помилок, які джоба сама ловить і пише в лог? Покажи в коді.',
    evidence: [
      {
        path: `${API}/telemetry/queue-job-metrics.service.ts`,
        anchor: "worker.on('failed'",
        verifiedAt: `${API}/telemetry/queue-job-metrics.service.ts:49-61`,
      },
      {
        path: `${API}/modules/ingestion/application/pipelines/tracked-shows.pipeline.ts`,
        anchor: 'Failed to sync tracked show',
        verifiedAt: `${API}/modules/ingestion/application/pipelines/tracked-shows.pipeline.ts:119-123`,
      },
    ],
    requiredFiles: [
      `${API}/telemetry/queue-job-metrics.service.ts`,
      `${API}/modules/ingestion/application/pipelines/tracked-shows.pipeline.ts`,
    ],
    conveys: [
      "Failures are recorded only from the BullMQ worker 'failed' event, that is, when the job processor throws and the attempt fails.",
      'A job that catches an error itself and only logs it (for example a per-show error in the tracked shows pipeline) does not fail, so nothing is recorded for it.',
    ],
    mustNotClaim: [
      'Errors written to the log are recorded in the job failures table as well.',
      'The tracked shows pipeline rethrows the per-show error so the job fails.',
    ],
    forbiddenText: [],
    reference: {
      answer:
        'Падіння записуються лише з події failed воркера BullMQ, тобто коли обробник кидає помилку. Конвеєр оновлення серіалів ловить помилку по кожному серіалу, пише її в лог і повертає результат без падіння, тому джоба не падає і нічого не записується.',
      claims: [
        {
          text: "Запис падіння відбувається лише в обробнику події 'failed' воркера.",
          evidence: [0],
        },
        {
          text: 'Конвеєр ловить помилку серіалу, логує її і не кидає далі, тож джоба не падає.',
          evidence: [1],
        },
      ],
      unknowns: [],
    },
  },
  {
    id: 'upcoming-refresh-all-when',
    kind: CaseKind.ANSWERABLE,
    question: 'Коли і чому запускається scheduled-upcoming-movies-refresh-all?',
    evidence: [
      {
        path: `${API}/config/scheduler.config.ts`,
        anchor: "jobId: 'scheduled-upcoming-movies-refresh-all'",
        verifiedAt: `${API}/config/scheduler.config.ts:118-126`,
      },
      {
        path: `${API}/config/scheduler.config.ts`,
        anchor: "pattern: '0 7 * * 0,2-6'",
        verifiedAt: `${API}/config/scheduler.config.ts:109-117`,
      },
      {
        path: `${API}/config/scheduler.config.ts`,
        anchor: "timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'",
        verifiedAt: `${API}/config/scheduler.config.ts:175`,
      },
    ],
    requiredFiles: [`${API}/config/scheduler.config.ts`],
    conveys: [
      'It runs once a week, on Monday at 07:00 in the scheduler timezone (UTC unless SCHEDULER_TIMEZONE says otherwise).',
      'It refreshes release dates of all upcoming movies, while on the other days a separate job refreshes only the movies premiering soon, so Monday is skipped by that job.',
    ],
    mustNotClaim: ['The job runs every day.', 'The job runs every hour.'],
    forbiddenText: [],
    reference: {
      answer:
        'Джоба запускається раз на тиждень, у понеділок о 07:00 за часовим поясом планувальника (UTC, якщо SCHEDULER_TIMEZONE не задано). Вона оновлює дати виходу всіх майбутніх фільмів, а в інші дні окрема джоба оновлює лише ті, що виходять незабаром.',
      claims: [
        {
          text: 'Розклад і область оновлення задані в конфігурації планувальника: понеділок 07:00, scope all.',
          evidence: [0],
        },
        {
          text: 'У решту днів працює окрема джоба для фільмів, що виходять незабаром.',
          evidence: [1],
        },
        {
          text: 'Часовий пояс планувальника береться зі SCHEDULER_TIMEZONE, інакше UTC.',
          evidence: [2],
        },
      ],
      unknowns: [],
    },
  },
  {
    id: 'refresh-run-limits',
    kind: CaseKind.ANSWERABLE,
    question: 'Які обмеження має оновлення дат виходу майбутніх фільмів за один запуск?',
    evidence: [
      {
        path: `${API}/modules/ingestion/application/pipelines/upcoming-movies.pipeline.ts`,
        anchor: 'syncedBefore: new Date(now - UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS',
        verifiedAt: `${API}/modules/ingestion/application/pipelines/upcoming-movies.pipeline.ts:102-113`,
      },
      {
        path: `${API}/modules/ingestion/ingestion.constants.ts`,
        anchor: 'UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS = 20',
        verifiedAt: `${API}/modules/ingestion/ingestion.constants.ts:144`,
      },
      {
        path: `${API}/modules/ingestion/ingestion.constants.ts`,
        anchor: 'UPCOMING_REFRESH_RUN_CAP = 2_000',
        verifiedAt: `${API}/modules/ingestion/ingestion.constants.ts:146`,
      },
    ],
    requiredFiles: [
      `${API}/modules/ingestion/application/pipelines/upcoming-movies.pipeline.ts`,
      `${API}/modules/ingestion/ingestion.constants.ts`,
    ],
    conveys: [
      'Only movies that were last synced at least 20 hours ago are refreshed.',
      'A run handles at most 2000 movies; the rest waits for the next run.',
      'The soon scope looks only at releases within 14 days of now, while the all scope has no upper release date bound.',
    ],
    mustNotClaim: [
      'A run handles at most 100 movies.',
      'Every upcoming movie is refreshed on every run regardless of when it was last synced.',
    ],
    forbiddenText: [],
    reference: {
      answer:
        'Оновлюються лише фільми, які синхронізували щонайменше 20 годин тому. За запуск беруть не більше 2000 фільмів, решта чекає наступного запуску. Для scope soon беруться релізи в межах 14 днів від зараз, для all верхньої межі дати немає.',
      claims: [
        {
          text: 'Запит відбирає фільми, синхронізовані раніше ніж 20 годин тому, зі стелею на запуск.',
          evidence: [0, 1, 2],
        },
      ],
      unknowns: [],
    },
  },
  {
    id: 'score-weights',
    kind: CaseKind.ANSWERABLE,
    question: 'Як зважується Ratingo Score? З яких частин складається і з якими вагами?',
    evidence: [
      {
        path: `${API}/config/score.config.ts`,
        anchor: 'tmdbPopularity: 0.24',
        verifiedAt: `${API}/config/score.config.ts:19-25`,
      },
      {
        path: `${API}/modules/shared/score-calculator/score-calculator.service.ts`,
        anchor: 'let ratingoScore = popularityScore + qualityScore + freshnessScore',
        verifiedAt: `${API}/modules/shared/score-calculator/score-calculator.service.ts:145`,
      },
      {
        path: `${API}/config/score.config.ts`,
        anchor: 'maxBonus: 0.03',
        verifiedAt: `${API}/config/score.config.ts:28-31`,
      },
    ],
    requiredFiles: [
      `${API}/config/score.config.ts`,
      `${API}/modules/shared/score-calculator/score-calculator.service.ts`,
    ],
    conveys: [
      'The score is the sum of popularity (TMDB popularity 0.24 and Trakt total watchers 0.16), quality (average rating 0.25 and vote confidence 0.15) and freshness (0.20), so roughly 40%, 40% and 20%.',
      'A small bonus for live watchers (at most 0.03 of the score) is added, and a multiplier between 0.85 and 1 lowers the score of titles with few votes.',
    ],
    mustNotClaim: [
      'Freshness weighs more than quality or popularity.',
      'The weights are stored in the database and changed at runtime.',
    ],
    forbiddenText: [],
    reference: {
      answer:
        'Оцінка складається з популярності (TMDB 0,24 і глядачі Trakt 0,16), якості (середній рейтинг 0,25 і довіра за кількістю голосів 0,15) та свіжості (0,20): близько 40%, 40% і 20%. Додається невеликий бонус за поточних глядачів (до 0,03), а для малої кількості голосів діє множник від 0,85 до 1.',
      claims: [
        { text: 'Ваги задано в конфігурації: 0,24, 0,16, 0,25, 0,15 і 0,20.', evidence: [0] },
        { text: 'Підсумок складає популярність, якість і свіжість.', evidence: [1] },
        { text: 'Бонус за поточних глядачів обмежений 0,03.', evidence: [2] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'http-shutdown-order',
    kind: CaseKind.ANSWERABLE,
    question: 'У якому порядку api зупиняється при SIGTERM?',
    evidence: [
      {
        path: `${API}/http-shutdown.ts`,
        anchor: 'await app.getHttpAdapter().close();',
        verifiedAt: `${API}/http-shutdown.ts:11-14`,
      },
      {
        path: `${API}/http-shutdown.ts`,
        anchor: 'const HTTP_SHUTDOWN_TIMEOUT_MS = 25_000;',
        verifiedAt: `${API}/http-shutdown.ts:7`,
      },
      {
        path: `${API}/common/runtime/exit-after.ts`,
        anchor: '.then(() => flushLogs())',
        verifiedAt: `${API}/common/runtime/exit-after.ts:11-13`,
      },
    ],
    requiredFiles: [`${API}/http-shutdown.ts`],
    conveys: [
      'On SIGTERM or SIGINT the HTTP server is closed first, and only then the Nest application and its providers are closed.',
      'After that the logs are flushed and the process exits; the whole shutdown has a 25 second timeout.',
    ],
    mustNotClaim: [
      'The Nest providers are closed before the HTTP server.',
      'The api relies on enableShutdownHooks to stop.',
    ],
    forbiddenText: [],
    reference: {
      answer:
        'Спершу закривається HTTP-сервер, потім застосунок Nest разом із провайдерами, далі скидаються логи і процес завершується. На все відведено 25 секунд.',
      claims: [
        { text: 'Спершу закривається адаптер HTTP, потім app.close().', evidence: [0] },
        { text: 'Загальний таймаут зупинки 25 секунд.', evidence: [1] },
        { text: 'Після зупинки скидаються логи і процес виходить.', evidence: [2] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'worker-shutdown-order',
    kind: CaseKind.ANSWERABLE,
    question: 'А як зупиняється worker при SIGTERM і чим це відрізняється від api?',
    evidence: [
      {
        path: `${API}/worker-shutdown.ts`,
        anchor: 'await Promise.all(workers.map((worker) => worker.close()));',
        verifiedAt: `${API}/worker-shutdown.ts:17-23`,
      },
      {
        path: `${API}/worker-shutdown.ts`,
        anchor: 'const WORKER_SHUTDOWN_TIMEOUT_MS = 25_000;',
        verifiedAt: `${API}/worker-shutdown.ts:13`,
      },
    ],
    requiredFiles: [`${API}/worker-shutdown.ts`],
    conveys: [
      'The worker first closes the BullMQ workers so running jobs can finish, then closes the Nest application, and last ends the Postgres pool.',
      'The worker has no HTTP server to close first; its overall timeout is 25 seconds as well.',
    ],
    mustNotClaim: ['The Postgres pool is closed before the BullMQ workers.'],
    forbiddenText: [],
    reference: {
      answer:
        'Воркер спершу закриває воркери BullMQ, щоб поточні джоби завершилися, потім закриває застосунок Nest і наприкінці пул Postgres. HTTP-сервера, який треба закривати першим, тут немає; загальний таймаут теж 25 секунд.',
      claims: [
        { text: 'Порядок: воркери BullMQ, потім app.close(), потім пул Postgres.', evidence: [0] },
        { text: 'Таймаут зупинки воркера 25 секунд.', evidence: [1] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'ingestion-retry-defaults',
    kind: CaseKind.ANSWERABLE,
    question: 'Скільки спроб за замовчуванням має ingestion-джоба і яка затримка між спробами?',
    evidence: [
      {
        path: `${API}/modules/shared/contracts/queues.ts`,
        anchor: 'attempts: 3,',
        verifiedAt: `${API}/modules/shared/contracts/queues.ts:25-30`,
      },
      {
        path: `${API}/modules/shared/contracts/queues.ts`,
        anchor: "backoff: { type: 'exponential' as const, delay: 2000 }",
        verifiedAt: `${API}/modules/shared/contracts/queues.ts:27`,
      },
      {
        path: `${API}/modules/ingestion/ingestion.module.ts`,
        anchor: 'defaultJobOptions: DEFAULT_INGESTION_JOB_OPTIONS',
        verifiedAt: `${API}/modules/ingestion/ingestion.module.ts:98`,
      },
    ],
    requiredFiles: [`${API}/modules/shared/contracts/queues.ts`],
    conveys: [
      'By default a job gets 3 attempts in total.',
      'Retries use exponential backoff that starts at 2 seconds.',
    ],
    mustNotClaim: [
      'Failed jobs are never retried.',
      'The delay between attempts is a fixed 10 minutes.',
    ],
    forbiddenText: [],
    reference: {
      answer:
        'За замовчуванням дається 3 спроби, а повтори йдуть з експоненційною затримкою, що починається з 2 секунд.',
      claims: [
        {
          text: 'Типові параметри джоби: 3 спроби та експоненційна затримка від 2000 мс.',
          evidence: [0, 1],
        },
        { text: 'Черга застосовує ці параметри за замовчуванням.', evidence: [2] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'failure-classification-order',
    kind: CaseKind.ANSWERABLE,
    question: 'Як визначається клас причини падіння джоби: за чим код дивиться насамперед?',
    evidence: [
      {
        path: `${API}/modules/job-failures/domain/policies/classify-job-failure.policy.ts`,
        anchor: 'CLASS_BY_ERROR_NAME.get(signal.errorName) ??',
        verifiedAt: `${API}/modules/job-failures/domain/policies/classify-job-failure.policy.ts:77-82`,
      },
    ],
    requiredFiles: [`${API}/modules/job-failures/domain/policies/classify-job-failure.policy.ts`],
    conveys: [
      'The class is decided in this order: error name, then HTTP status, then error code, then message patterns, and otherwise it is "other".',
      'Because the error name is checked first, a database error name decides the class even if an HTTP status is present.',
    ],
    mustNotClaim: ['The message text is checked before the HTTP status.'],
    forbiddenText: [],
    reference: {
      answer:
        'Спершу дивиться назва помилки, потім HTTP-статус, потім код помилки, потім шаблони в тексті повідомлення; якщо нічого не підійшло, клас other. Тож назва помилки бази даних вирішує клас навіть за наявного HTTP-статусу.',
      claims: [
        {
          text: 'Порядок перевірок: назва помилки, статус, код, повідомлення, інакше other.',
          evidence: [0],
        },
      ],
      unknowns: [],
    },
  },
  {
    id: 'failure-retention',
    kind: CaseKind.ANSWERABLE,
    question:
      'Як довго зберігаються записи про падіння джобів і за яким часовим поясом рахуються дні?',
    evidence: [
      {
        path: `${API}/modules/job-failures/domain/constants/job-failure.constants.ts`,
        anchor: 'JOB_FAILURE_RETENTION_DAYS = 14',
        verifiedAt: `${API}/modules/job-failures/domain/constants/job-failure.constants.ts:2-3`,
      },
      {
        path: `${API}/modules/job-failures/domain/constants/job-failure.constants.ts`,
        anchor: "JOB_FAILURE_DAY_TIME_ZONE = 'Europe/Kyiv'",
        verifiedAt: `${API}/modules/job-failures/domain/constants/job-failure.constants.ts:3`,
      },
    ],
    requiredFiles: [`${API}/modules/job-failures/domain/constants/job-failure.constants.ts`],
    conveys: ['Failures are kept for 14 days.', 'Days are counted in the Europe/Kyiv time zone.'],
    mustNotClaim: ['Failures are kept forever.', 'Days are counted in UTC.'],
    forbiddenText: [],
    reference: {
      answer: 'Записи зберігаються 14 днів, а дні рахуються за часовим поясом Europe/Kyiv.',
      claims: [{ text: 'Термін зберігання 14 днів, пояс Europe/Kyiv.', evidence: [0, 1] }],
      unknowns: [],
    },
  },
  {
    id: 'unreleased-freshness',
    kind: CaseKind.ANSWERABLE,
    question: 'Яку свіжість отримує фільм, який ще не вийшов?',
    evidence: [
      {
        path: `${API}/modules/shared/score-calculator/score-calculator.service.ts`,
        anchor: 'if (msSinceRelease < 0) {',
        verifiedAt: `${API}/modules/shared/score-calculator/score-calculator.service.ts:247-251`,
      },
      {
        path: `${API}/config/score.config.ts`,
        anchor: 'freshnessMinFloor: 0.2',
        verifiedAt: `${API}/config/score.config.ts:14`,
      },
    ],
    requiredFiles: [`${API}/modules/shared/score-calculator/score-calculator.service.ts`],
    conveys: [
      'A title that is not released yet gets the minimum freshness floor, 0.2, not the maximum.',
      'This keeps unreleased titles from outranking titles released today.',
    ],
    mustNotClaim: ['An unreleased title gets the maximum freshness of 1.'],
    forbiddenText: [],
    reference: {
      answer:
        'Фільм, який ще не вийшов, отримує мінімальну свіжість, тобто нижню межу 0,2, а не максимум. Так невипущені тайтли не обганяють тих, що вийшли сьогодні.',
      claims: [
        { text: 'Для дати в майбутньому повертається нижня межа свіжості.', evidence: [0] },
        { text: 'Нижня межа налаштована як 0,2.', evidence: [1] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'digest-schedule',
    kind: CaseKind.ANSWERABLE,
    question: 'О котрій годині надсилається щоденний дайджест і в якому часовому поясі?',
    evidence: [
      {
        path: 'apps/ai/veronica/agent/tasks/daily-digest.md',
        anchor: "schedule: '0 9 * * *'",
        verifiedAt: 'apps/ai/veronica/agent/tasks/daily-digest.md:2-3',
      },
      {
        path: 'apps/ai/veronica/agent/tasks/daily-digest.md',
        anchor: 'timezone: Europe/Kyiv',
        verifiedAt: 'apps/ai/veronica/agent/tasks/daily-digest.md:3',
      },
    ],
    requiredFiles: ['apps/ai/veronica/agent/tasks/daily-digest.md'],
    conveys: [
      'The daily digest task is scheduled for 09:00 every day.',
      'The time zone is Europe/Kyiv.',
    ],
    mustNotClaim: ['The digest is sent only on weekdays.', 'The digest is sent in UTC.'],
    forbiddenText: [],
    reference: {
      answer: 'Щодня о 09:00 за київським часом (Europe/Kyiv).',
      claims: [
        { text: 'Завдання дайджесту має розклад 0 9 * * * і пояс Europe/Kyiv.', evidence: [0, 1] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'happy-review-triggers',
    kind: CaseKind.ANSWERABLE,
    question:
      "Які події pull request запускають рев'ю у Хеппі, а які ні? Чи запускає його кожен новий push?",
    evidence: [
      {
        path: 'apps/ai/happy/src/modules/webhook/domain/constants/webhook.constants.ts',
        anchor: 'REVIEWABLE_PULL_REQUEST_ACTIONS',
        verifiedAt: 'apps/ai/happy/src/modules/webhook/domain/constants/webhook.constants.ts:8-12',
      },
      {
        path: 'apps/ai/happy/src/modules/webhook/domain/policies/webhook-policy.ts',
        anchor: 'REVIEWABLE_PULL_REQUEST_ACTIONS.includes(event.action)',
        verifiedAt: 'apps/ai/happy/src/modules/webhook/domain/policies/webhook-policy.ts:46-47',
      },
    ],
    requiredFiles: ['apps/ai/happy/src/modules/webhook/domain/constants/webhook.constants.ts'],
    conveys: [
      'A review starts for the pull request actions opened, ready_for_review and reopened.',
      'Other actions, including new pushes (synchronize), are ignored as not reviewable, so a push does not start a review.',
    ],
    mustNotClaim: ['Every push to a pull request starts a review.'],
    forbiddenText: [],
    reference: {
      answer:
        "Рев'ю запускають дії opened, ready_for_review і reopened. Усі інші дії, зокрема новий push, відкидаються як такі, що не підлягають рев'ю, тож кожен push рев'ю не запускає.",
      claims: [
        {
          text: "Список дій, що запускають рев'ю: opened, ready_for_review, reopened.",
          evidence: [0],
        },
        { text: 'Політика відкидає дії поза цим списком.', evidence: [1] },
      ],
      unknowns: [],
    },
  },
  {
    id: 'chat-budget',
    kind: CaseKind.ANSWERABLE,
    question: 'Скільки може коштувати і скільки кроків має одна відповідь Вероніки в чаті?',
    evidence: [
      {
        path: 'apps/ai/veronica/src/modules/chat/domain/constants/investigation.constants.ts',
        anchor: 'CHAT_BUDGET_PER_MESSAGE_USD = 0.05',
        verifiedAt:
          'apps/ai/veronica/src/modules/chat/domain/constants/investigation.constants.ts:4',
      },
      {
        path: 'apps/ai/veronica/src/modules/chat/domain/constants/investigation.constants.ts',
        anchor: 'CHAT_MAX_TURNS = 8',
        verifiedAt:
          'apps/ai/veronica/src/modules/chat/domain/constants/investigation.constants.ts:6',
      },
    ],
    requiredFiles: [
      'apps/ai/veronica/src/modules/chat/domain/constants/investigation.constants.ts',
    ],
    conveys: [
      'One chat answer may cost at most $0.05.',
      'One chat answer may take at most 8 turns.',
    ],
    mustNotClaim: ['The per message budget is one dollar.'],
    forbiddenText: [],
    reference: {
      answer: 'Одна відповідь у чаті коштує щонайбільше 0,05 долара і має не більше 8 кроків.',
      claims: [{ text: 'Бюджет на повідомлення 0,05 USD і 8 кроків.', evidence: [0, 1] }],
      unknowns: [],
    },
  },
];
