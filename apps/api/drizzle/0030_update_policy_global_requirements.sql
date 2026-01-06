-- Migration: Update policy globalRequirements with appliesTo
-- Purpose: Configure global quality gate to NOT apply to trending context
-- 
-- This allows trending items to be ELIGIBLE even without full maturity signals,
-- while catalog/homepage/search still require quality gates.

-- Case 1: Policy has no globalRequirements at all - add full structure
UPDATE catalog_policies
SET policy = policy || '{
  "globalRequirements": {
    "minVotesAnyOf": {
      "sources": ["imdb", "trakt"],
      "min": 1000
    },
    "appliesTo": ["catalog", "homepage", "search"]
  }
}'::jsonb
WHERE is_active = true
  AND NOT (policy ? 'globalRequirements');

-- Case 2: Policy has globalRequirements but no appliesTo - add appliesTo
UPDATE catalog_policies
SET policy = jsonb_set(
  policy,
  '{globalRequirements,appliesTo}',
  '["catalog", "homepage", "search"]'::jsonb
)
WHERE is_active = true
  AND policy ? 'globalRequirements'
  AND NOT (policy->'globalRequirements' ? 'appliesTo');

-- Case 3: Policy has globalRequirements with appliesTo that includes 'trending' - remove trending
UPDATE catalog_policies
SET policy = jsonb_set(
  policy,
  '{globalRequirements,appliesTo}',
  '["catalog", "homepage", "search"]'::jsonb
)
WHERE is_active = true
  AND policy ? 'globalRequirements'
  AND policy->'globalRequirements' ? 'appliesTo'
  AND policy->'globalRequirements'->'appliesTo' @> '"trending"'::jsonb;

COMMENT ON TABLE catalog_policies IS 
'Catalog policies with context-aware global requirements. trending context is excluded from global gate.';
