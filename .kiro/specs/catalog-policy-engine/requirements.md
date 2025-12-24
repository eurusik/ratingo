# Requirements Document

## Introduction

Catalog Policy Engine — система для керування публічним каталогом медіа-контенту з версіонованими політиками, детермінованим прийняттям рішень та повним аудитом. Система додає окремий policy/evaluation шар поверх існуючої моделі `media_items`, забезпечуючи прозорі правила фільтрації та можливість перерахунку без повторного ingestion.

Ключовий принцип: `media_items` залишається "warehouse" (всі дані з джерел), а публічний доступ — тільки через `public_media_items` view з eligibility фільтром.

## Glossary

- **Media_Items**: Існуюча таблиця-склад з даними з зовнішніх джерел (TMDB, Trakt, OMDb) — розширюється полями originCountries, originalLanguage
- **Media_Catalog_Evaluations**: Нова таблиця 1:1 до media_items з результатом застосування політики (status, reasons, relevanceScore, policyVersion)
- **Catalog_Policies**: Таблиця версіонованих політик фільтрації (країни, мови, провайдери, breakout-умови)
- **Public_Media_Items**: SQL view що джойнить media_items + media_stats + media_catalog_evaluations з WHERE status='ELIGIBLE'
- **Policy_Engine**: Доменний модуль з pure-функціями для детермінованого обчислення eligibility
- **Eligibility_Status**: Статус медіа в каталозі: PENDING (не оцінено), ELIGIBLE (публічний), INELIGIBLE (прихований), REVIEW (на перегляді)
- **Relevance_Score**: Числовий показник (0-100) релевантності медіа для homepage та featured секцій
- **Breakout_Condition**: Набір правил (BreakoutRule[]), за яких медіа допускається в каталог попри blocked country/language — кожне правило має id, priority, requirements
- **Global_Provider**: Стрімінг-платформа з глобальним покриттям (Netflix, Max, AppleTV, Prime, Disney)
- **Global_Signals**: Формалізовані метрики для визначення "глобальної релевантності": minImdbVotes, minTraktVotes, minQualityScore, requireAnyOfProviders, requireAnyOfRatingsPresent
- **Evaluation_Reason**: Ключ-причина рішення політики (BLOCKED_COUNTRY, BREAKOUT_ALLOWED, MISSING_GLOBAL_SIGNALS, тощо) — зберігається як ключ, людські описи в i18n
- **Catalog_Evaluation_Run**: Запис про виконання RE_EVALUATE_CATALOG job з progress tracking, counters, resumability — статуси: RUNNING, PREPARED, PROMOTED, CANCELED, FAILED
- **Policy_Status**: Статус політики в lifecycle: draft (чернетка), active (активна), archived (зарезервовано для майбутнього)
- **Run_Status**: Статус evaluation run: running (виконується), prepared (готовий до promote), promoted (активовано), canceled (скасовано), failed (помилка)
- **Admin API**: REST API endpoints для адміністративного інтерфейсу з повним доступом до policies та runs
- **Backend Driven Permission**: Логіка дозволів (canPromote, canCancel) обчислюється на backend, UI не приймає рішення самостійно

## Requirements

### Requirement 1: Розширення Media_Items та Evaluation Layer

**User Story:** As a platform architect, I want to extend media_items with origin metadata and add a separate evaluation layer, so that I can apply eligibility rules without breaking existing functionality.

#### Acceptance Criteria

1. THE System SHALL extend media_items table with fields: originCountries (jsonb string[]), originalLanguage (text iso_639_1)
2. THE System SHALL create media_catalog_evaluations table with fields: mediaItemId (PK, FK to media_items), status (enum: PENDING/ELIGIBLE/INELIGIBLE/REVIEW), reasons (text[]), relevanceScore (int 0-100), policyVersion (int), breakoutRuleId (text nullable), evaluatedAt (timestamp)
3. THE System SHALL maintain 1:1 relationship between media_items and media_catalog_evaluations via mediaItemId
4. WHEN media data is ingested from external sources, THE System SHALL create media_catalog_evaluations record with status=PENDING
5. THE System SHALL create indexes on media_catalog_evaluations: status, (status, relevanceScore), policyVersion
6. THE System SHALL set status=PENDING for all existing media_items during initial migration

### Requirement 2: Версіонована політика каталогу

**User Story:** As a product manager, I want catalog policies to be versioned, so that I can track policy changes and understand why decisions were made at any point in time.

#### Acceptance Criteria

1. THE System SHALL store catalog policies in catalog_policies table with fields: id, version (int), isActive (boolean), policy (jsonb containing allowedCountries[], blockedCountries[], allowedLanguages[], blockedLanguages[], globalProviders[], breakoutRules[], globalSignals config, homepageConfig), createdAt, activatedAt
2. THE System SHALL maintain exactly one active policy (isActive=true) using partial unique index on isActive WHERE isActive=true
3. WHEN a new policy is activated, THE System SHALL execute in transaction: deactivate old policy → activate new policy → record activatedAt timestamp
4. THE System SHALL expose policy configuration via admin API endpoint for viewing and updating
5. WHEN policy is created, THE System SHALL auto-increment version number based on max existing version
6. THE System SHALL store breakoutRules as array with fields: id, priority, name, requirements (minImdbVotes, minQualityScore, requireGlobalProvider, etc.)

### Requirement 3: Детермінований Policy Engine

**User Story:** As a developer, I want eligibility decisions to be deterministic, so that the same input always produces the same output regardless of when or where it runs.

#### Acceptance Criteria

1. THE Policy_Engine SHALL implement evaluateEligibility(mediaItem: MediaItem, stats: MediaStats, policy: CatalogPolicy) as a pure function returning Evaluation result with status, reasons, and breakoutRuleId
2. THE Policy_Engine SHALL implement computeRelevance(mediaItem: MediaItem, stats: MediaStats, policy: CatalogPolicy) as a pure function returning relevanceScore (0-100)
3. THE Policy_Engine SHALL implement getReasonDescriptions(reasons: string[], locale: string) returning human-readable descriptions from i18n dictionary
4. WHEN evaluating eligibility, THE Policy_Engine SHALL apply rules in order: missingDataChecks → blockedChecks → breakoutChecks → neutralChecks → allowedChecks
5. FOR ALL MediaItem+MediaStats combinations with identical data and policy version, THE Policy_Engine SHALL produce identical Evaluation results
6. WHEN media country/language is neither in allowed nor blocked lists (neutral), THE Policy_Engine SHALL return INELIGIBLE status with NEUTRAL_COUNTRY or NEUTRAL_LANGUAGE reason

### Requirement 4: Правила фільтрації та Breakout умови

**User Story:** As a content curator, I want flexible filtering rules with breakout conditions, so that high-quality content can bypass geographic restrictions.

#### Acceptance Criteria

1. WHEN media originCountries is empty or null, THE Policy_Engine SHALL return INELIGIBLE status with MISSING_ORIGIN_COUNTRY reason
2. WHEN media originalLanguage is empty or null, THE Policy_Engine SHALL return INELIGIBLE status with MISSING_ORIGINAL_LANGUAGE reason
3. WHEN media originCountries contains any blockedCountry AND no breakout rule matches, THE Policy_Engine SHALL return INELIGIBLE status with BLOCKED_COUNTRY reason
4. WHEN media originalLanguage is in blockedLanguages AND no breakout rule matches, THE Policy_Engine SHALL return INELIGIBLE status with BLOCKED_LANGUAGE reason
5. WHEN media matches any breakout rule requirements (including globalSignals), THE Policy_Engine SHALL return ELIGIBLE status with BREAKOUT_ALLOWED reason and breakoutRuleId
6. THE System SHALL support multiple breakout rules with priority ordering: GLOBAL_HIT, FESTIVAL_AWARDS, UA_RELEVANCE, etc.
7. THE System SHALL define globalSignals in breakout rules with fields: minImdbVotes, minTraktVotes, minQualityScoreNormalized (0-1 scale), requireAnyOfProviders[], requireAnyOfRatingsPresent[]
8. THE System SHALL support blockedCountryMode in policy: 'ANY' (default, strict) or 'MAJORITY' (for co-productions)

### Requirement 5: Evaluation Pipeline та Jobs

**User Story:** As a system operator, I want automated evaluation jobs, so that catalog stays in sync with policy changes and new data.

#### Acceptance Criteria

1. WHEN media data is updated in media_items (via SYNC_MOVIE/SYNC_SHOW jobs), THE System SHALL queue EVALUATE_CATALOG_ITEM job for that media
2. WHEN policy version changes (new policy activated), THE System SHALL queue RE_EVALUATE_CATALOG job to process all media_items in batches
3. THE EVALUATE_CATALOG_ITEM job SHALL read media_items + media_stats, apply current active policy via Policy_Engine, and upsert result to media_catalog_evaluations
4. THE RE_EVALUATE_CATALOG job SHALL create catalog_evaluation_runs record with fields: id, policyVersion, status, startedAt, finishedAt, cursor, counters (processed, eligibleDelta, ineligibleDelta, reasonBreakdown)
5. THE RE_EVALUATE_CATALOG job SHALL process items in configurable batch sizes (default: 1000) with cursor-based resumability
6. WHEN evaluation completes, THE System SHALL update media_catalog_evaluations.evaluatedAt timestamp

### Requirement 6: Public Media View та Safe API Access

**User Story:** As a frontend developer, I want all public endpoints to return only eligible content by default, so that users never see inappropriate or low-quality content.

#### Acceptance Criteria

1. THE System SHALL create public_media_items SQL view that joins media_items + media_stats + media_catalog_evaluations with WHERE status = 'ELIGIBLE' AND ingestion_status = 'ready' AND deleted_at IS NULL
2. WHEN /trending endpoint is called, THE System SHALL query only from public_media_items view
3. WHEN /search endpoint is called, THE System SHALL query only from public_media_items view
4. WHEN /discover endpoint is called, THE System SHALL query only from public_media_items view
5. WHEN /homepage endpoint is called, THE System SHALL query from public_media_items view with additional filter: relevanceScore >= policy.homepage.minRelevanceScore
6. WHEN /details/:id endpoint is called for INELIGIBLE or PENDING media, THE System SHALL return 404 Not Found

### Requirement 7: Repository Separation

**User Story:** As a developer, I want separate repositories for public and admin access, so that I cannot accidentally expose raw or ineligible content.

#### Acceptance Criteria

1. THE System SHALL implement PublicCatalogRepository that reads only from public_media_items view
2. THE System SHALL implement AdminCatalogRepository that reads from media_items with full access (including INELIGIBLE)
3. WHEN public endpoint controller needs media data, THE System SHALL inject PublicCatalogRepository
4. WHEN admin endpoint controller needs full data, THE System SHALL inject AdminCatalogRepository
5. THE PublicCatalogRepository SHALL NOT expose any method to bypass eligibility filtering
6. THE System SHALL define PublicMediaItemRow DTO type as single source of truth for select columns from public_media_items view

### Requirement 8: Аудит та Observability

**User Story:** As a platform operator, I want comprehensive metrics and audit logs, so that I can understand what content is being filtered and why.

#### Acceptance Criteria

1. THE System SHALL expose metric catalog_eligible_total with count of ELIGIBLE items
2. THE System SHALL expose metric catalog_ineligible_total with count of INELIGIBLE items
3. THE System SHALL expose metric catalog_reason_count with labels for each Evaluation_Reason
4. THE System SHALL expose metric catalog_policy_version_active with current active version
5. THE System SHALL expose metric catalog_evaluation_duration_ms for evaluation job performance
6. WHEN eligibility status changes for any media, THE System SHALL log the change with mediaId, oldStatus, newStatus, reasons, policyVersion
7. WHEN media is re-evaluated under new policyVersion without status change, THE System SHALL log "re-evaluated under policy N" event

### Requirement 9: Dry-Run та Policy Preview

**User Story:** As a product manager, I want to preview policy changes before activation, so that I can understand the impact on the catalog.

#### Acceptance Criteria

1. THE System SHALL implement dry-run evaluation endpoint that applies proposed policy without persisting results
2. WHEN dry-run is executed, THE System SHALL return summary: totalEvaluated, newlyEligible, newlyIneligible, unchanged, reasonBreakdown
3. THE System SHALL support dry-run modes: sample (random N items), top (by trendingScore), byType (movie/show), byCountry
4. THE System SHALL enforce dry-run limits: max 10000 items per request, timeout 60 seconds
5. THE System SHALL support diff mode comparing proposed policy against current active policyVersion
6. WHEN dry-run completes, THE System SHALL NOT modify media_catalog_evaluations table
7. THE dry-run SHALL use the same Policy_Engine and input data (media_items + media_stats) as production evaluation jobs

### Requirement 10: Serialization Round-Trip

**User Story:** As a developer, I want policy and evaluation data to serialize correctly, so that I can store and retrieve them without data loss.

#### Acceptance Criteria

1. FOR ALL valid CatalogPolicy objects, serializing to JSON then deserializing SHALL produce an equivalent object
2. FOR ALL valid Evaluation objects, serializing to JSON then deserializing SHALL produce an equivalent object
3. THE System SHALL validate policy JSON against schema before activation
4. THE System SHALL pretty-print CatalogPolicy objects back to valid JSON format

### Requirement 11: Evaluation Run Tracking

**User Story:** As a system operator, I want to track re-evaluation job runs, so that I can monitor progress, resume failed runs, and audit policy changes.

#### Acceptance Criteria

1. THE System SHALL create catalog_evaluation_runs table with fields: id, policyVersion, status (enum: RUNNING/PREPARED/PROMOTED/CANCELED/FAILED), startedAt, finishedAt, cursor (text for resumability), counters (jsonb: processed, eligible, ineligible, review, reasonBreakdown)
2. WHEN RE_EVALUATE_CATALOG job starts, THE System SHALL create catalog_evaluation_runs record with status=RUNNING
3. WHEN RE_EVALUATE_CATALOG job processes a batch, THE System SHALL update cursor and counters in catalog_evaluation_runs
4. IF RE_EVALUATE_CATALOG job fails, THE System SHALL set status=FAILED and preserve cursor for resumability
5. WHEN RE_EVALUATE_CATALOG job completes successfully, THE System SHALL set status=PREPARED and finishedAt timestamp
6. THE System SHALL expose admin endpoint to view evaluation run history and trigger resume for failed runs

### Requirement 12: Admin API - Catalog Policies Listing

**User Story:** As an admin user, I want to view and filter catalog policies, so that I can navigate between policies, select policies for preparation, and understand policy status without loading heavy details.

#### Acceptance Criteria

1. THE System SHALL expose GET /api/admin/catalog-policies endpoint with query parameters: page (number, default 1), pageSize (number, default 20, max 100), search (string), status (enum: draft/active), sortBy (enum: updatedAt/createdAt/name, default updatedAt), order (enum: asc/desc, default desc)
2. WHEN request is valid, THE System SHALL return response with items array and pagination object containing page, pageSize, total
3. THE System SHALL include in each policy item: id, name, description, status, version, lastPreparedRunId (nullable), createdAt, updatedAt, updatedBy (object with id and name)
4. THE System SHALL set lastPreparedRunId to reference the most recent run with status prepared for this policy
5. THE System SHALL NOT include rules, conditions, or diff data in list response
6. WHEN search parameter is provided, THE System SHALL filter policies by name or description using case-insensitive partial match
7. WHEN status parameter is provided, THE System SHALL filter policies by exact status match (draft maps to isActive=false, active maps to isActive=true)
8. WHEN sortBy and order parameters are provided, THE System SHALL sort results accordingly
9. WHEN page or pageSize parameters are invalid (negative, zero, or pageSize > 100), THE System SHALL return 400 Bad Request
10. WHEN user lacks admin permissions, THE System SHALL return 401 Unauthorized or 403 Forbidden
11. THE System SHALL reserve archived status for future use (soft-delete feature)

### Requirement 13: Admin API - Evaluation Runs Listing

**User Story:** As an admin user, I want to view and filter evaluation runs, so that I can audit policy changes, track run progress, and quickly access run details for promote/cancel actions.

#### Acceptance Criteria

1. THE System SHALL expose GET /api/admin/catalog-policies/runs endpoint with query parameters: policyId (string), status (enum: prepared/promoted/canceled/failed/running), page (number, default 1), pageSize (number, default 20, max 100), sortBy (enum: createdAt/finishedAt, default createdAt), order (enum: asc/desc, default desc)
2. WHEN request is valid, THE System SHALL return response with items array and pagination object containing page, pageSize, total
3. THE System SHALL include in each run item: runId, policyId, policyName, policyVersion, status, createdAt, finishedAt (nullable), createdBy (object with id and name), hasDiff (boolean), canPromote (boolean), canCancel (boolean)
4. THE System SHALL compute hasDiff by checking if diff data exists for the run (not based on status alone)
5. THE System SHALL compute canPromote based on run status and business rules (backend-driven permission)
6. THE System SHALL set canCancel to true only when status is running or prepared
7. WHEN policyId parameter is provided, THE System SHALL filter runs by exact policy ID match
8. WHEN status parameter is provided, THE System SHALL filter runs by exact status match
9. WHEN finishedAt is null, THE Run SHALL be in running or prepared status
10. WHEN page, pageSize, or status parameters are invalid, THE System SHALL return 400 Bad Request
11. WHEN user lacks admin permissions, THE System SHALL return 401 Unauthorized or 403 Forbidden

### Requirement 14: Status Model Alignment

**User Story:** As a developer, I want consistent status enums across policy and run entities, so that I can build reliable state machines and UI components.

#### Acceptance Criteria

1. THE Catalog_Policy SHALL support status values: draft, active, archived
2. THE Catalog_Evaluation_Run SHALL support status values: running, prepared, promoted, canceled, failed
3. WHEN run status is running, THE System SHALL allow transition to prepared or failed
4. WHEN run status is prepared, THE System SHALL allow transition to promoted, canceled, or failed
5. THE System SHALL NOT allow direct transition from running to promoted
6. THE System SHALL enforce status transitions via application logic and database constraints
7. WHEN run completes successfully, THE System SHALL set status to prepared (not completed) to indicate readiness for promotion


### Requirement 15: Run Status Model Migration

**User Story:** As a developer, I want consistent run status enums across database and application layers, so that I can implement reliable state machines without confusion.

#### Acceptance Criteria

1. THE System SHALL migrate catalog_evaluation_runs.status enum from legacy values (pending, running, completed, failed) to new values (running, prepared, promoted, canceled, failed)
2. THE System SHALL remove pending status (runs start directly in running state)
3. THE System SHALL replace completed status with prepared status (indicates ready for promotion)
4. THE System SHALL add promoted status (terminal state after successful activation)
5. THE System SHALL add canceled status (terminal state after user cancellation)
6. THE System SHALL update all existing runs with status=completed to status=prepared during migration
7. THE System SHALL ensure no code references legacy status values after migration
8. THE System SHALL update database constraints and indexes to reflect new status enum