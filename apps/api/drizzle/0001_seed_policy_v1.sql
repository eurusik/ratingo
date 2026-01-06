-- Seed Default Policy v1 (Trend-optimized)
-- Balanced for catching trends early while maintaining quality
-- qualityThreshold = soft baseline, breakout = can override

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
    "allowedCountries": ["US","GB","CA","AU","UA","DE","FR","ES","IT","JP","KR","NL","SE","PL","BR","MX","IN","TR","ID","AR"],
    "blockedCountries": [],
    "blockedCountryMode": "ANY",
    "allowedLanguages": ["en","uk","de","fr","es","it","ja","ko","pt","hi","pl","tr","id","ar"],
    "blockedLanguages": [],
    "globalProviders": ["netflix","prime_video","disney_plus","apple_tv_plus","max","paramount_plus","hulu","peacock"],
    "globalRequirements": {
      "minQualityScoreNormalized": 0.45,
      "requireAnyOfRatingsPresent": [],
      "minVotesAnyOf": {
        "sources": ["imdb", "trakt"],
        "min": 250
      },
      "appliesTo": ["catalog", "trending", "homepage"]
    },
    "breakoutRules": [
      {
        "id": "early-viral",
        "name": "Early Viral",
        "priority": 1,
        "requirements": {
          "minImdbVotes": 15000,
          "minQualityScoreNormalized": 0.62
        }
      },
      {
        "id": "viral-hit",
        "name": "Viral Hit",
        "priority": 2,
        "requirements": {
          "minImdbVotes": 100000,
          "minQualityScoreNormalized": 0.55
        }
      },
      {
        "id": "streaming-original",
        "name": "Streaming Original",
        "priority": 3,
        "requirements": {
          "minImdbVotes": 3000,
          "requireAnyOfProviders": ["netflix","prime_video","disney_plus","apple_tv_plus","max"]
        }
      },
      {
        "id": "critically-acclaimed",
        "name": "Critically Acclaimed",
        "priority": 4,
        "requirements": {
          "minQualityScoreNormalized": 0.74,
          "requireAnyOfRatingsPresent": ["imdb","metacritic","rt"]
        }
      },
      {
        "id": "ukrainian-content",
        "name": "Ukrainian Content",
        "priority": 5,
        "requirements": {
          "originCountries": ["UA"],
          "minImdbVotes": 200
        }
      }
    ],
    "eligibilityMode": "STRICT",
    "homepage": {
      "minRelevanceScore": 35
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
