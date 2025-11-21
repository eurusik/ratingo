/**
 * @fileoverview Централізований експорт усіх функцій бекфілу для шоу
 * @module lib/sync/shows/backfill
 */

// Бекфіл метаданих шоу
export { runMetaBackfill, backfillShowMetaById } from './show';

// Бекфіл OMDB рейтингів
export { runOmdbBackfill } from './omdb';

// Бекфіл метаданих фільмів (хоча це movies, він частина backfill функціональності)
export { runMovieMetaBackfill } from './movies';
