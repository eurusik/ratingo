-- Migration: Update public_media_items view to join on active policy version
-- Now that evaluations are versioned by policy, we need to join on the active policy's version

-- Drop and recreate the view
DROP VIEW IF EXISTS public_media_items;

CREATE VIEW public_media_items AS
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
  mi.ingestion_status,
  mi.created_at,
  mi.updated_at,
  -- Stats
  ms.ratingo_score,
  ms.quality_score,
  ms.popularity_score,
  ms.freshness_score,
  ms.watchers_count,
  -- Evaluation (from active policy)
  mce.relevance_score,
  mce.status AS eligibility_status
FROM media_items mi
LEFT JOIN media_stats ms ON ms.media_item_id = mi.id
-- Join evaluations for the active policy version only
JOIN catalog_policies cp ON cp.is_active = true
JOIN media_catalog_evaluations mce 
  ON mce.media_item_id = mi.id 
  AND mce.policy_version = cp.version
WHERE 
  mce.status = 'eligible'
  AND mi.ingestion_status = 'ready'
  AND mi.deleted_at IS NULL;
