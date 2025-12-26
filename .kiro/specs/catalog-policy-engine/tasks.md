# Implementation Plan: Catalog Policy Engine

## Overview

Поетапна імплементація Catalog Policy Engine з версіонованими політиками, детермінованим Policy Engine та safe API access через public_media_items view.

## Tasks

- [x] 1. Database Schema Setup
  - [x] 1.1 Create migration: Add columns to media_items
    - Add `origin_countries` (jsonb, nullable) and `original_language` (text, nullable)
    - Add index on `ingestion_status` WHERE `deleted_at IS NULL`
    - _Requirements: 1.1_

  - [x] 1.2 Create migration: catalog_policies table
    - Create table with id, version, is_active, policy (jsonb), created_at, activated_at
    - Add partial unique index `catalog_policies_single_active` on ((1)) WHERE is_active = true
    - Add unique index on version
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 Create migration: media_catalog_evaluations table
    - Create eligibility_status enum (pending, eligible, ineligible, review)
    - Create table with media_item_id (PK), status, reasons[], relevance_score, policy_version, breakout_rule_id, evaluated_at
    - Add CHECK constraint for relevance_score 0-100
    - Add indexes on status, (status, relevance_score), policy_version
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 1.4 Create migration: catalog_evaluation_runs table
    - Create evaluation_run_status enum (pending, running, completed, failed)
    - Create table with id, policy_version, status, started_at, finished_at, cursor, counters (jsonb)
    - _Requirements: 11.1_

  - [x] 1.5 Create migration: public_media_items view
    - Create view joining media_items + media_stats + media_catalog_evaluations
    - WHERE status = 'eligible' AND ingestion_status = 'ready' AND deleted_at IS NULL
    - _Requirements: 6.1_

  - [x] 1.6 Create migration: Backfill existing media_items
    - Insert PENDING evaluations for all existing media_items
    - Set policy_version = 0, reasons = ['NO_ACTIVE_POLICY']
    - _Requirements: 1.4, 1.6_

  - [x] 1.7 Update Drizzle schema.ts with new tables and enums
    - Add eligibilityStatusEnum, evaluationRunStatusEnum
    - Add catalogPolicies, mediaCatalogEvaluations, catalogEvaluationRuns tables
    - Add originCountries, originalLanguage to mediaItems
    - _Requirements: 1.1, 1.2, 2.1, 11.1_

- [x] 2. Update Ingestion to Populate Origin Data
  - [x] 2.1 Create normalization utilities
    - Create `apps/api/src/modules/catalog-policy/domain/utils/country-language.util.ts`
    - Normalize originCountries: uppercase ISO codes, filter invalid
    - Normalize originalLanguage: lowercase ISO code
    - _Requirements: 1.1_

  - [x] 2.2 Update TMDB mapper
    - Extract origin_country (shows) and production_countries (movies) from TMDB API response
    - Extract original_language from TMDB API response
    - Map to NormalizedMedia model
    - _Requirements: 1.1_

  - [x] 2.3 Update NormalizedMedia model
    - Add originCountries: string[] | null field
    - Add originalLanguage: string | null field
    - _Requirements: 1.1_

  - [x] 2.4 Update media repository upsert
    - Persist origin_countries and original_language to media_items
    - _Requirements: 1.1_

  - [x] 2.5 Update SYNC jobs to create PENDING evaluation
    - After media upsert, create media_catalog_evaluations record with status=PENDING
    - Set policy_version = 0, reasons = ['NO_ACTIVE_POLICY']
    - _Requirements: 1.4_

- [x] 3. Checkpoint - Verify migrations and ingestion
  - Run migrations, verify schema is correct
  - Run sync for a few items, verify origin data populated
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Policy Engine Domain Module
  - [x] 4.1 Install fast-check for property-based testing
    - Add fast-check to devDependencies in apps/api/package.json
    - _Requirements: Testing Strategy_

  - [x] 4.2 Create domain types and interfaces
    - Create `apps/api/src/modules/catalog-policy/domain/types/policy.types.ts`
    - Create `EligibilityStatus`, `EvaluationReason`, `Evaluation` types
    - Create `PolicyConfig`, `BreakoutRule`, `PolicyEngineInput` interfaces
    - _Requirements: 3.1, 4.5, 4.6_

  - [x] 4.3 Create policy schema validation (Zod or class-validator)
    - Create `apps/api/src/modules/catalog-policy/domain/validation/policy.schema.ts`
    - Define PolicyConfigSchema with all fields
    - Implement validatePolicyOrThrow() with normalization (defaults, sort breakoutRules by priority, uppercase country codes)
    - _Requirements: 10.3_

  - [x] 4.4 Implement evaluateEligibility pure function
    - Create `apps/api/src/modules/catalog-policy/domain/policy-engine.ts`
    - Implement missing data checks → return PENDING (not INELIGIBLE) with MISSING_ORIGIN_COUNTRY or MISSING_ORIGINAL_LANGUAGE
    - Implement blocked checks with blockedCountryMode (ANY/MAJORITY with tie-breaker for 1-2 countries)
    - Implement breakout rule matching with priority ordering
    - Implement neutral checks
    - Implement allowed checks with eligibilityMode (STRICT/RELAXED)
    - _Requirements: 3.1, 3.4, 4.1-4.8_
    - _Design Decision: DD-1 (Missing Data → PENDING)_

  - [x] 4.5 Write property test: Evaluation Determinism
    - **Property 1: Evaluation Determinism**
    - **Validates: Requirements 3.1, 3.5**

  - [x] 4.6 Write unit tests: Missing Data Returns PENDING
    - Test null originCountries → PENDING + MISSING_ORIGIN_COUNTRY
    - Test empty originCountries → PENDING + MISSING_ORIGIN_COUNTRY
    - Test null originalLanguage → PENDING + MISSING_ORIGINAL_LANGUAGE
    - 5-10 explicit test cases
    - **Validates: Requirements 4.1, 4.2**
    - _Design Decision: DD-1 (PENDING, not INELIGIBLE)_

  - [x] 4.7 Write unit tests: Blocked Without Breakout Returns INELIGIBLE
    - Test blocked country without breakout → BLOCKED_COUNTRY
    - Test blocked language without breakout → BLOCKED_LANGUAGE
    - Test blockedCountryMode ANY vs MAJORITY
    - Test MAJORITY tie-breaker: ["RU","US"] → blocked=true (fallback ANY)
    - 5-10 explicit test cases
    - **Validates: Requirements 4.3, 4.4**
    - _Design Decision: DD-5 (MAJORITY Tie-Breaker)_

  - [x] 4.8 Write unit tests: Breakout Overrides Blocked
    - Test blocked country with matching breakout → ELIGIBLE + BREAKOUT_ALLOWED
    - Test blocked language with matching breakout → ELIGIBLE + BREAKOUT_ALLOWED
    - 5-10 explicit test cases
    - **Validates: Requirements 4.5**

  - [x] 4.9 Write unit tests: Neutral Returns INELIGIBLE
    - Test neutral country (not in allowed/blocked) → NEUTRAL_COUNTRY
    - Test STRICT vs RELAXED eligibilityMode
    - 5-10 explicit test cases
    - **Validates: Requirements 3.6**

  - [x] 4.10 Write property test: Breakout Priority Ordering
    - **Property 6: Breakout Rule Priority Ordering**
    - **Validates: Requirements 4.6**

  - [x] 4.11 Implement computeRelevance pure function
    - Calculate score from qualityScore, popularityScore, freshnessScore (all 0-1 normalized)
    - Return value in range [0, 100]
    - _Requirements: 3.2_

  - [x] 4.12 Write property test: Relevance Score Range
    - **Property 7: Relevance Score Range**
    - **Validates: Requirements 3.2**

  - [x] 4.13 Implement getReasonDescriptions function
    - Return i18n dictionary for reason keys
    - _Requirements: 3.3_

- [x] 5. Checkpoint - Policy Engine tests
  - Ensure all property tests pass
  - Ensure all unit tests pass, ask the user if questions arise

- [x] 6. Policy Repository and Service
  - [x] 6.1 Create CatalogPolicyRepository
    - Create `apps/api/src/modules/catalog-policy/infrastructure/repositories/catalog-policy.repository.ts`
    - Implement findActive(): Promise<CatalogPolicy | null>
    - Implement findByVersion(version: number): Promise<CatalogPolicy | null>
    - Implement create(policy: PolicyConfig): Promise<CatalogPolicy>
    - Implement activate(id: string): Promise<void> with transaction
    - _Requirements: 2.1-2.5_

  - [ ]* 6.2 Write property test: Single Active Policy Invariant
    - **Property 13: Single Active Policy Invariant**
    - **Validates: Requirements 2.2**

  - [ ]* 6.3 Write property test: Policy Version Auto-Increment
    - **Property 14: Policy Version Auto-Increment**
    - **Validates: Requirements 2.5**

  - [x] 6.4 Create CatalogPolicyService
    - Create `apps/api/src/modules/catalog-policy/application/services/catalog-policy.service.ts`
    - Implement getActivePolicy()
    - Implement createAndActivate(policy: PolicyConfig)
    - Use validatePolicyOrThrow() from schema
    - _Requirements: 2.4, 10.3_

  - [ ]* 6.5 Write property test: Policy Serialization Round-Trip
    - **Property 8: Policy Serialization Round-Trip**
    - **Validates: Requirements 10.1**

  - [x] 6.6 Seed default policy v1
    - Create seed migration or service method
    - Insert initial policy with STRICT mode
    - allowedCountries: ['US', 'GB', 'CA', 'AU', 'UA', 'DE', 'FR', 'ES', 'IT', 'JP', 'KR']
    - allowedLanguages: ['en', 'uk', 'de', 'fr', 'es', 'it', 'ja', 'ko']
    - blockedCountries: [] (start empty, add as needed)
    - breakoutRules: [GLOBAL_HIT with minImdbVotes: 50000, minQualityScore: 0.6]
    - Activate policy v1 immediately (invariant: active policy always exists after seed)
    - _Requirements: 2.1-2.3_
    - _Design Decision: DD-2 (Active Policy Always Exists)_

- [x] 7. Evaluation Repository and Service
  - [x] 7.1 Create MediaCatalogEvaluationRepository
    - Create `apps/api/src/modules/catalog-policy/infrastructure/repositories/media-catalog-evaluation.repository.ts`
    - Implement findByMediaId(mediaItemId: string)
    - Implement upsert(evaluation: MediaCatalogEvaluation)
    - Implement findByStatus(status: EligibilityStatus)
    - Implement bulkUpsert(evaluations: MediaCatalogEvaluation[])
    - _Requirements: 1.2, 1.3_

  - [x] 7.2 Create CatalogEvaluationRunRepository
    - Create `apps/api/src/modules/catalog-policy/infrastructure/repositories/catalog-evaluation-run.repository.ts`
    - Implement create(run: CatalogEvaluationRun)
    - Implement update(id: string, updates: Partial<CatalogEvaluationRun>)
    - Implement findByPolicyVersion(version: number)
    - _Requirements: 11.1-11.6_

  - [x] 7.3 Create CatalogEvaluationService
    - Create `apps/api/src/modules/catalog-policy/application/services/catalog-evaluation.service.ts`
    - Implement evaluateMediaItem(mediaItemId: string)
    - Implement evaluateBatch(mediaItemIds: string[])
    - Use Policy Engine pure functions
    - _Requirements: 5.3_

  - [ ]* 7.4 Write property test: Evaluation Serialization Round-Trip
    - **Property 9: Evaluation Serialization Round-Trip**
    - **Validates: Requirements 10.2**

- [x] 8. Checkpoint - Repository tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Background Jobs
  - [x] 9.1 Create EVALUATE_CATALOG_ITEM job handler
    - Create `apps/api/src/modules/catalog-policy/application/workers/catalog-policy.worker.ts`
    - Read media_items + media_stats
    - Apply active policy via Policy Engine
    - Upsert to media_catalog_evaluations
    - Set evaluated_at = now()
    - _Requirements: 5.1, 5.3, 5.6_

  - [x] 9.2 Create RE_EVALUATE_CATALOG job handler
    - Implemented in catalog-policy.worker.ts
    - Create catalog_evaluation_runs record
    - Process in batches with cursor-based resumability
    - Update counters and cursor after each batch
    - Handle failures with status=FAILED
    - _Requirements: 5.2, 5.4, 5.5, 11.2-11.5_

  - [x] 9.3 Integrate with existing SYNC jobs
    - Update SyncMediaService to queue EVALUATE_CATALOG_ITEM after sync
    - _Requirements: 5.1_

  - [x] 9.4 Add job trigger on policy activation
    - When new policy activated, queue RE_EVALUATE_CATALOG
    - _Requirements: 5.2_

  - [x] 9.5 Run initial RE_EVALUATE_CATALOG
    - Trigger re-evaluation for all existing items with policy v1
    - Verify eligible items appear in public_media_items view
    - _Requirements: 5.2_

- [x] 10. Checkpoint - Jobs and evaluation pipeline
  - Verify eligible items in public_media_items view
  - Ensure all tests pass, ask the user if questions arise

- [ ] 11. Public Catalog Repository
  - [x] 11.1 Create PublicCatalogRepository
    - Create `apps/api/src/modules/catalog-policy/infrastructure/repositories/public-catalog.repository.ts`
    - Read only from public_media_items view
    - Implement findTrending(), search(), findForHomepage(), findById()
    - Define PublicMediaItemRow DTO type
    - _Requirements: 7.1, 7.5, 7.6_

  - [ ]* 11.2 Write integration test: Public View Eligibility Filter
    - Verify view only returns eligible + ready items
    - **Property 10: Public View Eligibility Filter**
    - **Validates: Requirements 6.1**

  - [x] 11.3 Create AdminCatalogRepository
    - Create `apps/api/src/modules/catalog-policy/infrastructure/repositories/admin-catalog.repository.ts`
    - Full access to media_items + evaluations
    - Implement findAll(), findById(), findByEligibilityStatus()
    - _Requirements: 7.2_

- [x] 12. Update Public API Endpoints
  - [x] 12.1 Update /trending endpoint
    - Updated TrendingMoviesQuery and TrendingShowsQuery to join media_catalog_evaluations
    - Added eligibility filter: status = 'eligible', ingestion_status = 'ready', deleted_at IS NULL
    - _Requirements: 6.2_

  - [x] 12.2 Update /search endpoint
    - Updated drizzle-media.repository.ts search method to join media_catalog_evaluations
    - Added eligibility filter: status = 'eligible', ingestion_status = 'ready'
    - _Requirements: 6.3_

  - [x] 12.3 Update /discover endpoint
    - No discover endpoint exists in current codebase (skipped)
    - _Requirements: 6.4_

  - [x] 12.4 Update /homepage endpoint
    - Updated HeroMediaQuery to join media_catalog_evaluations
    - Added eligibility filter: status = 'eligible', ingestion_status = 'ready', deleted_at IS NULL
    - _Requirements: 6.5_

  - [x] 12.5 Update /details/:id endpoint
    - Updated MovieDetailsQuery and ShowDetailsQuery to join media_catalog_evaluations
    - Returns null (404) for INELIGIBLE or PENDING media
    - _Requirements: 6.6_

- [ ] 13. Checkpoint - API integration tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 14. Admin API Endpoints
  - [x] 14.1 Create GET /admin/catalog-policies/:id/prepare endpoint
    - Prepare policy for activation
    - _Requirements: 2.4_

  - [x] 14.2 Create GET /admin/catalog-policies/runs/:runId endpoint
    - Get run status and progress
    - _Requirements: 11.6_

  - [x] 14.3 Create POST /admin/catalog-policies/runs/:runId/promote endpoint
    - Activate policy, deactivate previous
    - Queue RE_EVALUATE_CATALOG job
    - _Requirements: 2.3_

  - [x] 14.4 Create POST /admin/catalog-policies/runs/:runId/cancel endpoint
    - Cancel running evaluation
    - _Requirements: 11.6_

  - [x] 14.5 Create GET /admin/catalog-policies/runs/:runId/diff endpoint
    - Get diff report showing what will change
    - _Requirements: 9.5_

  - [x] 14.6 Create GET /admin/catalog-policies endpoint
    - List all policies with pagination, filtering, sorting
    - Include lastPreparedRunId, status, version
    - _Requirements: 12.1-12.11_

  - [x] 14.7 Create GET /admin/catalog-policies/runs endpoint
    - List all evaluation runs with pagination, filtering
    - Include hasDiff, canPromote, canCancel computed fields
    - _Requirements: 13.1-13.11_

  - [x] 14.8 Create POST /admin/catalog-policies endpoint
    - Create new policy (draft)
    - Validate policy JSON against schema
    - _Requirements: 2.4, 10.3_

- [x] 15. Run Status Model Migration
  - [x] 15.1 Create migration to update evaluation_run_status enum
    - Remove 'pending' status (runs start directly in 'running')
    - Replace 'completed' with 'prepared' (ready for promotion)
    - Add 'promoted' status (terminal state after activation)
    - Add 'canceled' status (terminal state after user cancellation)
    - _Requirements: 15.1-15.8_

  - [x] 15.2 Update existing runs with status=completed to status=prepared
    - _Requirements: 15.6_

  - [x] 15.3 Update RunStatus constants and types
    - Update evaluation.constants.ts with new status values
    - Update all code references to use new statuses
    - _Requirements: 15.7_

- [x] 16. Dry-Run Feature
  - [x] 16.1 Create DryRunService
    - Create `apps/api/src/modules/catalog-policy/application/services/dry-run.service.ts`
    - Implement mode selection: sample (TABLESAMPLE), top, byType, byCountry
    - Enforce limits (max 10000 items, 60s timeout)
    - Return DryRunSummary without modifying database
    - _Requirements: 9.1-9.4, 9.6_
    - _Design Decision: DD-6 (TABLESAMPLE for sample mode)_

  - [x] 16.2 Create POST /admin/catalog/policies/dry-run endpoint
    - Accept proposed policy and DryRunOptions
    - Call DryRunService.execute()
    - Return summary
    - _Requirements: 9.1-9.4, 9.6_

  - [ ]* 16.3 Write integration test: Dry-Run Immutability
    - Execute dry-run, verify media_catalog_evaluations unchanged (count, hash, updatedAt)
    - **Validates: Requirements 9.6**

  - [ ]* 16.4 Write property test: Dry-Run Consistency
    - For N random items: dry-run result == evaluateEligibility(input, policy)
    - In-memory comparison, no DB writes
    - **Property 12: Dry-Run Consistency**
    - **Validates: Requirements 9.7**

  - [ ]* 16.5 Write property test: Dry-Run Mode Item Selection
    - **Property 15: Dry-Run Mode Item Selection**
    - Verify byType returns only specified type, byCountry returns only specified country
    - **Validates: Requirements 9.3**

  - [x] 16.6 Implement diff mode
    - Compare proposed policy against current active
    - Show newlyEligible, newlyIneligible, unchanged, statusChanges
    - _Requirements: 9.5_

- [ ] 17. Observability
  - **See detailed spec:** `.kiro/specs/catalog-observability/`
  - Implement Prometheus metrics and audit logging for catalog policy engine
  - Metrics: eligible/ineligible/pending counts, reason breakdown, policy version, evaluation duration
  - Audit logging: status changes, re-evaluations
  - _Requirements: 8.1-8.7_
  - _Spec: catalog-observability (requirements.md, design.md, tasks.md)_

- [x] 18. Create catalog-policy NestJS module
  - Create `apps/api/src/modules/catalog-policy/catalog-policy.module.ts`
  - Register all services, repositories, workers
  - Export PublicCatalogRepository for use by other modules
  - Import in app.module.ts
  - _Requirements: All_

- [ ] 19. Final Checkpoint
  - Run full test suite
  - Verify all property tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests
- Core property tests (4.5 Determinism, 4.10 Breakout Priority, 4.12 Relevance Range) are completed
- Optional property tests (6.2, 6.3, 6.5, 7.4, 16.3, 16.4, 16.5) can be added for additional coverage
- Unit tests (4.6-4.9) use explicit test cases (5-10 each) for readability
- Integration tests (11.2, 16.3) verify DB state
- Each property test should run minimum 100 iterations
- Use fast-check library for property-based testing in TypeScript
- STRICT eligibility mode is recommended as default
- policyVersion=0 means "no policy / pending seed"
- Default policy v1 seeded in migration 0013 provides working baseline
- Policy Activation Flow (Prepare → Promote) is implemented with DiffService

## Design Decisions Reference

- **DD-1**: Missing metadata → PENDING (not INELIGIBLE) - allows admin to distinguish "needs data" vs "blocked"
- **DD-2**: Active policy always exists after seed - NO_ACTIVE_POLICY is fallback only
- **DD-3**: INNER JOIN on evaluations in public view - ensures items without evaluation don't appear
- **DD-4**: Two reason metrics (Gauge + Counter) - avoids misleading graphs during RE_EVALUATE
- **DD-5**: MAJORITY mode tie-breaker - fallback to ANY for 1-2 countries
- **DD-6**: TABLESAMPLE for dry-run sample mode - performance optimization

## Implementation Status Summary

### Completed
- Database schema and migrations (1.1-1.7)
- Ingestion updates for origin data (2.1-2.5)
- Policy Engine domain module with all tests (4.1-4.13)
- Policy Repository and Service (6.1, 6.4, 6.6)
- Evaluation Repository and Service (7.1-7.3)
- Background Jobs (9.1-9.5)
- Policy Activation Flow (prepare, promote, cancel, diff)
- NestJS module setup (18)
- Public Catalog Repository (11.1, 11.3)
- Update Public API Endpoints (12.1-12.5)
- Admin API List Endpoints (14.6-14.8)

### In Progress / Remaining
- Run Status Model Migration (15.1-15.3)
- Dry-Run Feature (16.1-16.6)
- Observability (17.1-17.5)
- Optional property tests (6.2, 6.3, 6.5, 7.4, 11.2)
