export const UNKNOWN_COMMAND_REPLY = 'Не знаю такої команди. Усі команди: /help';

export const COMMAND_FAILED_REPLY = 'Не вдалося зібрати відповідь. Спробуй ще раз трохи пізніше.';

export const ON_DEMAND_DIGEST_NOTE = '<i>Звіт на вимогу. Ранковий надійде як завжди о 09:00.</i>';

export const HELP_TITLE = '<b>Що я вмію</b>';

export const SEARCHING_REPLY = '<i>шукаю…</i>';

export const HAPPY_SOON_REPLY =
  'Розмова з Хеппі тут ще не підключена. Поки що вона перевіряє pull request-и на GitHub.';

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
