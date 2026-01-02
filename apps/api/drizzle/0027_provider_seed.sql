-- Seed migration for provider registry and initial mappings
-- Based on existing CANONICAL_PROVIDERS and PROVIDER_ID_TO_CANONICAL

-- Provider Registry: Canonical provider brands
INSERT INTO "provider_registry" ("id", "display_name", "brand_group", "logo_path", "priority", "is_active", "created_at", "updated_at")
VALUES
  -- Global streaming (priority 10-50 for major providers)
  ('netflix', 'Netflix', NULL, '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg', 10, true, NOW(), NOW()),
  ('prime_video', 'Prime Video', 'amazon', '/emthp39XA2YScoYL1p0sdbAH2WA.jpg', 20, true, NOW(), NOW()),
  ('disney_plus', 'Disney+', 'disney', '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg', 30, true, NOW(), NOW()),
  ('max', 'Max', 'warner', '/6Q3ZYUNA9Hsgj6iWnVsw2gR5V6z.jpg', 40, true, NOW(), NOW()),
  ('apple_tv_plus', 'Apple TV+', 'apple', '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg', 50, true, NOW(), NOW()),
  ('hulu', 'Hulu', 'disney', '/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg', 60, true, NOW(), NOW()),
  ('peacock', 'Peacock', 'nbcuniversal', '/8VCV78prwd9QzZnEm0ReO6bERDa.jpg', 70, true, NOW(), NOW()),
  ('paramount_plus', 'Paramount+', 'paramount', '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg', 80, true, NOW(), NOW()),
  ('crunchyroll', 'Crunchyroll', 'sony', '/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg', 90, true, NOW(), NOW()),
  ('mubi', 'MUBI', NULL, '/bVR4Z1LCHY7gidXAJF5pMa4QrDS.jpg', 100, true, NOW(), NOW()),
  -- Ukrainian providers
  ('megogo', 'MEGOGO', NULL, '/t6N57S17sdXRXmZDAkaGP0NHNG0.jpg', 110, true, NOW(), NOW()),
  ('sweet_tv', 'SWEET.TV', NULL, '/xLu1rkZNOKuNnRNr70wySosfTBf.jpg', 120, true, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "display_name" = EXCLUDED."display_name",
  "brand_group" = EXCLUDED."brand_group",
  "logo_path" = EXCLUDED."logo_path",
  "priority" = EXCLUDED."priority",
  "updated_at" = NOW();

-- Provider Mappings: TMDB ID to canonical provider (global mappings only)
-- Regional mappings will be added via Admin UI
INSERT INTO "provider_mappings" ("id", "tmdb_provider_id", "provider_id", "variant_id", "distribution_channel", "region", "notes", "source", "created_at")
VALUES
  -- Netflix (TMDB ID: 8)
  (gen_random_uuid(), 8, 'netflix', NULL, 'direct', 'global', 'Netflix standard', 'manual', NOW()),
  
  -- Prime Video (TMDB IDs: 9, 119)
  (gen_random_uuid(), 9, 'prime_video', NULL, 'direct', 'global', 'Prime Video', 'manual', NOW()),
  (gen_random_uuid(), 119, 'prime_video', NULL, 'amazon_channel', 'global', 'Prime Video Channels', 'manual', NOW()),
  
  -- Disney+ (TMDB ID: 337)
  (gen_random_uuid(), 337, 'disney_plus', NULL, 'direct', 'global', 'Disney+', 'manual', NOW()),
  
  -- Max / HBO Max (TMDB IDs: 384, 1899)
  (gen_random_uuid(), 384, 'max', NULL, 'direct', 'global', 'HBO Max (legacy ID)', 'manual', NOW()),
  (gen_random_uuid(), 1899, 'max', NULL, 'direct', 'global', 'Max', 'manual', NOW()),
  
  -- Apple TV+ (TMDB ID: 350)
  (gen_random_uuid(), 350, 'apple_tv_plus', NULL, 'direct', 'global', 'Apple TV+', 'manual', NOW()),
  
  -- Hulu (TMDB ID: 15)
  (gen_random_uuid(), 15, 'hulu', NULL, 'direct', 'global', 'Hulu', 'manual', NOW()),
  
  -- Peacock (TMDB IDs: 386, 387)
  (gen_random_uuid(), 386, 'peacock', NULL, 'direct', 'global', 'Peacock', 'manual', NOW()),
  (gen_random_uuid(), 387, 'peacock', NULL, 'direct', 'global', 'Peacock Premium', 'manual', NOW()),
  
  -- Paramount+ (TMDB ID: 531)
  (gen_random_uuid(), 531, 'paramount_plus', NULL, 'direct', 'global', 'Paramount+', 'manual', NOW()),
  
  -- Crunchyroll (TMDB ID: 283)
  (gen_random_uuid(), 283, 'crunchyroll', NULL, 'direct', 'global', 'Crunchyroll', 'manual', NOW()),
  
  -- MUBI (TMDB ID: 11)
  (gen_random_uuid(), 11, 'mubi', NULL, 'direct', 'global', 'MUBI', 'manual', NOW()),
  
  -- Ukrainian providers
  (gen_random_uuid(), 484, 'megogo', NULL, 'direct', 'global', 'MEGOGO', 'manual', NOW()),
  (gen_random_uuid(), 1773, 'sweet_tv', NULL, 'direct', 'global', 'SWEET.TV', 'manual', NOW())
ON CONFLICT ("tmdb_provider_id", "region") DO UPDATE SET
  "provider_id" = EXCLUDED."provider_id",
  "distribution_channel" = EXCLUDED."distribution_channel",
  "notes" = EXCLUDED."notes";
