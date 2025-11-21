/**
 * Типи для trending coordinator модуля
 * @module trendingCoordinator/types
 */

/**
 * Результат роботи trending coordinator
 */
export interface TrendingCoordinatorResult {
  /** Успішність операції */
  success: boolean;
  /** ID створеної job */
  jobId: number;
  /** Кількість створених tasks */
  tasksQueued: number;
  /** Статистика по операції */
  totals: {
    /** Кількість отриманих trending shows */
    trendingFetched: number;
  };
}

/**
 * Trending show з Trakt API
 */
export interface TraktTrendingShow {
  /** Кількість глядачів */
  watchers?: number;
  /** Інформація про шоу */
  show?: {
    /** Ідентифікатори */
    ids?: {
      /** TMDB ID */
      tmdb?: number;
    };
  };
}

/**
 * Payload для sync task
 */
export interface SyncTaskPayload {
  /** Кількість глядачів */
  watchers: number | null;
  /** Повна інформація про шоу з Trakt */
  traktShow: any;
}

/**
 * Створення sync task для бази даних
 */
export interface SyncTaskCreateData {
  /** ID job */
  jobId: number;
  /** TMDB ID шоу */
  tmdbId: number;
  /** Payload з додатковою інформацією */
  payload: SyncTaskPayload;
  /** Статус task */
  status: 'pending';
  /** Кількість спроб */
  attempts: number;
  /** Дата створення */
  createdAt: Date;
  /** Дата оновлення */
  updatedAt: Date;
}
