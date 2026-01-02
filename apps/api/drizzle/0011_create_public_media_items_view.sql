-- Migration: Create public_media_items view
-- Safe view that only exposes ELIGIBLE media items for public endpoints
-- Requirements: 6.1

CREATE OR REPLACE VIEW public_media_items AS
SELECT 
  mi.id,
  mi.type,
  mi.tmdb_id,
  mi.imdb_id,
  mi.title,
  mi.original_title,
  mi.slug,
  mi.overview,
  mi.poster_path,
  mi.backdrop_path,
  mi.videos,
  mi.credits,
  mi.watch_providers,
  mi.trending_score,
  mi.trending_rank,
  mi.popularity,
  mi.rating,
  mi.vote_count,
  mi.rating_imdb,
  mi.rating_metacritic,
  mi.rating_rotten_tomatoes,
  mi.rating_trakt,
  mi.release_date,
  mi.origin_countries,
  mi.original_language,
  mi.ingestion_status,  -- included for debugging/verification
  mi.created_at,
  mi.updated_at,
  ms.ratingo_score,
  ms.quality_score,
  ms.popularity_score,
  ms.freshness_score,
  ms.watchers_count,
  mce.relevance_score,
  mce.status as eligibility_status
FROM media_items mi
LEFT JOIN media_stats ms ON ms.media_item_id = mi.id
INNER JOIN media_catalog_evaluations mce ON mce.media_item_id = mi.id
WHERE mce.status = 'eligible'
  AND mi.ingestion_status = 'ready'
  AND mi.deleted_at IS NULL;
