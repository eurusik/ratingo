/** Домен фільмів - основні експорти */

// Експорти з upserts (базові функції роботи з фільмами)
export * from './upserts';

// Експорти з processing (основна обробка фільмів)
export * from './processing';

// Експорти з trending (трендові фільми) - імпортуємо окремо щоб уникнути конфліктів
export {
  // Головні функції
  runTrendingMoviesSync,
  runTrendingMoviesIncremental,
  getSyncStatus,
  runTrendingMoviesCoordinator,
  runTrendingMoviesProcessor,

  // Управління кешами
  createTrendingMoviesCache,
  clearTrendingMoviesCache,
  getCacheStats,
  initializeCaches,

  // Робота з Trakt API
  fetchTraktTrendingMovies,
  validateTraktMovieData,
  filterValidTraktMovies,

  // Обробка фільмів (окрім processMovie щоб уникнути конфлікту)
  processMoviesBatch,
  aggregateResults,
  processMovieTask,

  // Управління задачами та джобами
  getPendingTasks,
  updateTaskToProcessing,
  updateTaskToDone,
  updateTaskToError,
  createTasksBatch,
  createSyncJob,
  updateJobStats,
  getTrendingMovies,
  convertMoviesToTaskData,
} from './trending';

// Експорти з backfill (заповнення метаданих)
export * from './backfill';
