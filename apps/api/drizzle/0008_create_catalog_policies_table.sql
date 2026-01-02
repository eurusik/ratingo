-- Migration: Create catalog_policies table
-- Stores versioned catalog filtering policies
-- Requirements: 2.1, 2.2

-- Create catalog_policies table
CREATE TABLE catalog_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  policy jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  activated_at timestamp
);

-- Partial unique index on constant (1) - ensures only one active policy
-- This is a PostgreSQL trick: index on a constant WHERE clause
CREATE UNIQUE INDEX catalog_policies_single_active 
ON catalog_policies ((1)) 
WHERE is_active = true;

-- Unique version numbers - each version must be unique
CREATE UNIQUE INDEX catalog_policies_version_uniq 
ON catalog_policies (version);

-- Index for version lookups
CREATE INDEX catalog_policies_version_idx 
ON catalog_policies (version);
