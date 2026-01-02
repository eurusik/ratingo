-- Seed Default Policy v1
-- This migration creates the initial catalog policy with STRICT mode.
-- Design Decision DD-2: Active policy always exists after seed.

INSERT INTO catalog_policies (
  id,
  version,
  is_active,
  policy,
  created_at,
  activated_at
) VALUES (
  gen_random_uuid(),
  1,
  true,
  '{
    "allowedCountries": ["US", "GB", "CA", "AU", "UA", "DE", "FR", "ES", "IT", "JP", "KR", "NL", "SE", "NO", "DK", "FI", "PL", "CZ", "AT", "CH", "BE", "IE", "NZ"],
    "blockedCountries": [],
    "blockedCountryMode": "ANY",
    "allowedLanguages": ["en", "uk", "de", "fr", "es", "it", "ja", "ko", "nl", "sv", "no", "da", "fi", "pl", "cs"],
    "blockedLanguages": [],
    "globalProviders": ["Netflix", "Prime Video", "Disney+", "Apple TV+", "Max", "Paramount+"],
    "breakoutRules": [
      {
        "id": "global-hit",
        "name": "Global Hit",
        "priority": 1,
        "requirements": {
          "minImdbVotes": 50000,
          "minQualityScoreNormalized": 0.6
        }
      },
      {
        "id": "streaming-exclusive",
        "name": "Streaming Exclusive",
        "priority": 2,
        "requirements": {
          "minImdbVotes": 10000,
          "requireAnyOfProviders": ["Netflix", "Prime Video", "Disney+", "Apple TV+", "Max"]
        }
      },
      {
        "id": "critically-acclaimed",
        "name": "Critically Acclaimed",
        "priority": 3,
        "requirements": {
          "minQualityScoreNormalized": 0.75,
          "requireAnyOfRatingsPresent": ["imdb", "metacritic", "rt"]
        }
      }
    ],
    "eligibilityMode": "STRICT",
    "homepage": {
      "minRelevanceScore": 50
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Verify: should have exactly one active policy
-- SELECT * FROM catalog_policies WHERE is_active = true;
