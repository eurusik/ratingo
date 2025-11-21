/**
 * @fileoverview Логіка роботи з Trakt API для трендових фільмів
 *
 * Модуль відповідає за отримання трендових фільмів з Trakt API,
 * обробку помилок та повторні спроби при невдачах.
 *
 * @author Твій Асистент
 */

import type { TraktMovieData, TraktTrendingOptions } from './types';

/**
 * Отримує трендові фільми з Trakt API
 *
 * @param options - Параметри для запиту (ліміт, повторні спроби)
 * @returns Масив трендових фільмів з Trakt
 * @throws Помилка при неможливості отримати дані
 *
 * @example
 * ```typescript
 * try {
 *   const movies = await fetchTraktTrendingMovies({ limit: 20 });
 *   console.log(`Отримано ${movies.length} трендових фільмів`);
 * } catch (error) {
 *   console.error('Помилка отримання трендів:', error);
 * }
 * ```
 */
export async function fetchTraktTrendingMovies(
  options: TraktTrendingOptions = {}
): Promise<TraktMovieData[]> {
  const { limit = 10, retries = 3, retryDelay = 1000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Використовуємо глобальну функцію з movies/trending
      const movies = (await (global as any).fetchTraktTrendingMovies?.(limit)) || [];

      if (!Array.isArray(movies)) {
        throw new Error('Невірний формат відповіді від Trakt API');
      }

      return movies;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Невідома помилка');

      if (attempt < retries) {
        // Затримка перед повторною спробою
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  throw new Error(
    `Не вдалося отримати трендові фільми після ${retries + 1} спроб: ${lastError?.message}`
  );
}

/**
 * Валідує дані трендового фільму
 *
 * @param movie - Дані фільму для валідації
 * @returns true якщо дані валідні, false в іншому випадку
 *
 * @example
 * ```typescript
 * const isValid = validateTraktMovieData(movie);
 * if (!isValid) {
 *   console.warn('Невалідні дані фільму:', movie);
 * }
 * ```
 */
export function validateTraktMovieData(movie: any): movie is TraktMovieData {
  if (!movie || typeof movie !== 'object') {
    return false;
  }

  if (!movie.movie || typeof movie.movie !== 'object') {
    return false;
  }

  if (!movie.movie.ids || typeof movie.movie.ids !== 'object') {
    return false;
  }

  if (typeof movie.movie.ids.tmdb !== 'number') {
    return false;
  }

  return true;
}

/**
 * Фільтрує та очищає масив трендових фільмів
 *
 * @param movies - Масив фільмів для фільтрації
 * @returns Відфільтрований масив валідних фільмів
 *
 * @example
 * ```typescript
 * const rawMovies = await fetchTraktTrendingMovies();
 * const validMovies = filterValidTraktMovies(rawMovies);
 * console.log(`Знайдено ${validMovies.length} валідних фільмів з ${rawMovies.length}`);
 * ```
 */
export function filterValidTraktMovies(movies: any[]): TraktMovieData[] {
  return movies.filter(validateTraktMovieData);
}
