import { DumeFailureReason, DumeRejectionReason, DumeSupport } from '../entities/dume';

export const DUME_STARTED_NOTICE =
  'DUM-E розбирає це в коді й даних. Відповідь прийде окремим повідомленням за кілька хвилин.';

export const DUME_ALREADY_STARTED_NOTICE =
  'DUM-E уже розбирає це питання. Відповідь прийде окремим повідомленням.';

export const DUME_ALREADY_RUNNING_NOTICE =
  'DUM-E ще розбирає попереднє питання з цього чату. Нове можна запускати, коли воно завершиться.';

export const DUME_UNCONFIRMED_NOTICE =
  'Не вдалося підтвердити, чи розпочато розслідування в DUM-E. Якщо відповіді не буде, спитай ще раз.';

export const DUME_UNTRACKED_NOTICE =
  'Питання передано DUM-E, але стежити за відповіддю не вдалося через збій черги. Спитай ще раз пізніше.';

export const DUME_DELIVERY_FAILED_LINE = 'Відповідь DUM-E не вдалося доставити. Спитай ще раз.';

export const DUME_UNAVAILABLE_NOTICE =
  'DUM-E зараз недоступний, глибоке розслідування не запущено.';

export const DUME_WHY_USAGE =
  'Напиши питання після команди: «/why чому sync-show падає з тайм-аутом».';

export const DUME_REJECTION_NOTICE: Readonly<Record<DumeRejectionReason, string>> = {
  [DumeRejectionReason.DAY_BUDGET]:
    'Денний бюджет DUM-E вичерпано, глибоке розслідування не запущено. Спробуй завтра.',
  [DumeRejectionReason.DAILY_COUNT_CAP]:
    'Денний ліміт розслідувань DUM-E вичерпано, нове не запущено. Спробуй завтра.',
  [DumeRejectionReason.QUEUE_FULL]:
    'У DUM-E зараз повна черга, розслідування не запущено. Спробуй трохи пізніше.',
  [DumeRejectionReason.OTHER]:
    'DUM-E зараз не приймає нових розслідувань, нове не запущено. Спробуй трохи пізніше.',
};

export const DUME_FAILURE_LINE: Readonly<Record<DumeFailureReason, string>> = {
  [DumeFailureReason.BUDGET_STOP]:
    'Розслідування зупинено: вичерпано бюджет запуску. Перевіреної відповіді немає.',
  [DumeFailureReason.TIMEOUT]: 'Розслідування зупинено за часом. Спробуй звузити питання.',
  [DumeFailureReason.MODEL_ERROR]:
    'Розслідування не завершилось через збій моделі. Спробуй ще раз пізніше.',
  [DumeFailureReason.NO_VALID_ANSWER]: 'Розслідування завершилось без перевіреної відповіді.',
  [DumeFailureReason.CODE_UNAVAILABLE]:
    'Код не вдалося отримати з GitHub, розслідування не почалося.',
  [DumeFailureReason.DAY_BUDGET]: 'Денний бюджет DUM-E вичерпано. Спробуй завтра.',
  [DumeFailureReason.INTERRUPTED]: 'Розслідування перервано перезапуском сервісу. Спитай ще раз.',
  [DumeFailureReason.INTERNAL_ERROR]:
    'Розслідування не завершилось через внутрішній збій DUM-E. Спробуй ще раз пізніше.',
};

export const DUME_GAVE_UP_LINE =
  'Відповіді від DUM-E немає вже 15 хвилин. Спробуй спитати ще раз пізніше.';

export const DUME_NOT_FOUND_LINE =
  'DUM-E не має результату цього запиту: його, схоже, втрачено. Спробуй спитати ще раз.';

export const DUME_SUPPORT_LABEL: Readonly<Record<DumeSupport, string>> = {
  [DumeSupport.SUPPORTED]: 'підтверджено',
  [DumeSupport.PARTLY_SUPPORTED]: 'підтверджено частково',
  [DumeSupport.UNSUPPORTED]: 'не підтверджено',
  [DumeSupport.NO_CLAIMS]: 'перевірених тверджень немає',
};

export const DUME_PROBLEM_LABEL: Readonly<Record<string, string>> = {
  no_citation: 'немає цитати',
  invalid_path: 'шлях не підійшов',
  file_not_in_snapshot: 'файлу немає в цьому коміті',
  lines_out_of_range: 'таких рядків немає',
  range_too_large: 'діапазон завеликий',
  not_read_in_this_run: 'ці рядки не читали в цьому запуску',
  evidence_not_shown: 'рядок даних не показували',
};

export const DUME_UNKNOWN_PROBLEM_LABEL = 'не перевірено';
