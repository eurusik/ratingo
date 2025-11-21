/**
 * @fileoverview Модуль для backfill операцій з фільмами
 *
 * Цей модуль містить функції для заповнення відсутніх метаданих фільмів:
 * - відео (трейлери, тизери, кліпи)
 * - жанри та деталі
 * - постачальники перегляду (watch providers)
 * - статуси релізу
 *
 * @module movies/backfill
 */

// Основна функція backfill
export { runMovieMetaBackfill } from './movies';

// Типи та інтерфейси
export type { BackfillMoviesMetaStats } from '@/lib/types';
