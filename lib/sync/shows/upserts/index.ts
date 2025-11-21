/**
 * @fileoverview Централізований експорт усіх функцій upsert для шоу
 * @module lib/sync/shows/upserts
 */

// Основні операції з шоу
export { upsertShow } from './show';

// Рейтинги та дистрибуція голосів
export { upsertShowRatings, upsertShowRatingBuckets } from './ratings';

// Медіа: відео, провайдери перегляду, контент рейтинги
export { upsertShowVideos, upsertShowWatchProviders, upsertShowContentRatings } from './media';

// Акторський склад
export { upsertShowCast } from './cast';

// Снапшоти популярності
export { upsertShowWatchersSnapshot } from './snapshots';

// Переклади
export { upsertShowTranslations } from './translations';

// Жанри
export { upsertShowGenres } from './genres';
