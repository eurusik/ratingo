export const UNKNOWN_COMMAND_REPLY = 'Не знаю такої команди. Усі команди: /help';

export const COMMAND_FAILED_REPLY = 'Не вдалося зібрати відповідь. Спробуй ще раз трохи пізніше.';

export const ON_DEMAND_DIGEST_NOTE = '<i>Звіт на вимогу. Ранковий надійде як завжди о 09:00.</i>';

export const HELP_TITLE = '<b>Що я вмію</b>';

export const SEARCHING_REPLY = '<i>шукаю…</i>';

export const HAPPY_NEEDS_NUMBER_REPLY =
  'Скажи номер PR: «Хеппі, глянь 470», або надішли посилання на pull request.';

export const HAPPY_NO_OPEN_PULL_REQUESTS_REPLY = 'Відкритих PR зараз немає, глянути нічого.';

export const HAPPY_CHOOSE_PULL_REQUEST_REPLY =
  'Відкритих PR кілька. Який глянути? Напиши номер, наприклад «глянь #471».';

export const HAPPY_MORE_PULL_REQUESTS_NOTE = 'Є й старіші відкриті PR, тут п’ять найновіших.';

export const happyPickedPullRequestReply = (pullNumber: number, title: string): string =>
  `Беру PR №${pullNumber} «${title}».`;

export const HAPPY_UNAVAILABLE_REPLY =
  'Хеппі зараз недоступний, тож не можу ні запустити огляд, ні показати результат. Спробуй трохи пізніше. Звіти й команди працюють як завжди.';

export const happyForeignRepositoryReply = (repository: string): string =>
  `Хеппі працює лише з репозиторієм ${repository}. Посилання на інший репозиторій пропускаю.`;

export const happyNotFoundReply = (pullNumber: number): string =>
  `Не знайшла PR №${pullNumber} у репозиторії. Перевір номер.`;

export const happyStartedReply = (pullNumber: number): string =>
  `Хеппі взявся за PR №${pullNumber}. Огляд займає кілька хвилин, напишу, щойно буде готово.`;

export const happyAlreadyRunningReply = (pullNumber: number): string =>
  `Хеппі вже оглядає PR №${pullNumber}. Напишу, щойно буде готово.`;

const HAPPY_SKIP_REASON_TEXT: Readonly<Record<string, string>> = {
  closed: 'уже закритий',
  merged: 'уже злитий',
  untrusted_fork: 'від автора з форка, якого немає серед довірених',
};

export const happySkippedReply = (pullNumber: number, reason: string): string =>
  `Хеппі не оглядає PR №${pullNumber}: він ${HAPPY_SKIP_REASON_TEXT[reason] ?? 'не підходить для огляду'}.`;

export const happyHeadMovedReply = (pullNumber: number): string =>
  `У PR №${pullNumber} з'явився новий коміт, тож огляд попереднього не опублікували. Напиши «Хеппі, глянь ${pullNumber}» ще раз.`;

export const happyNotPublishedReply = (pullNumber: number): string =>
  `Хеппі закінчив роботу над PR №${pullNumber}, але результату не опублікував: PR міг змінитися чи закритися. Спробуй ще раз.`;

export const happyGaveUpReply = (pullNumber: number, pullRequestUrl: string): string =>
  `Хеппі досі не закінчив PR №${pullNumber}. Результат з'явиться в перевірці Happy на сторінці PR:\n${pullRequestUrl}`;

export const HAPPY_HELP_LINES: readonly string[] = [
  '«Хеппі, глянь 470»: огляд PR від Хеппі; після нових комітів він дивиться лише їх',
  '«Хеппі, глянь 470 повністю» або «повне рев’ю 470»: повний огляд усього PR',
  'Посилання на PR цього репозиторію працює так само',
  '«Зроби ревью» без номера: один відкритий PR беру сама, з кількох питаю, який',
];

export const EMPTY_QUESTION_REPLY = 'Що саме цікавить? Напиши питання одним повідомленням.';

export const REDACTED_NOTE =
  '<i>Частину відповіді прибрано: у ній були числа, яких немає в отриманих даних.</i>';

export const FALLBACK_INTRO = {
  MODEL_DOWN: '<b>Модель зараз недоступна</b>, тому відповідаю сухими даними зі знімка.',
  BUDGET: '<b>Ліміт витрат на модель вичерпано</b>, тому відповідаю сухими даними зі знімка.',
  UNVERIFIED: '<b>Не зміг перевірити числа у відповіді</b>, тому показую сухі дані зі знімка.',
} as const;

export const FALLBACK_FAILED_REPLY =
  'Не вдалося ні розібратися з питанням, ні зібрати знімок. Спробуй ще раз трохи пізніше.';

export const LAST_EXCHANGES_TITLE = '<b>Останні відповіді</b>';

export const NO_EXCHANGES_REPLY = 'Ще немає відповідей, які я записала.';
