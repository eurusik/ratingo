# Requirements Document

## Introduction

Policy Activation Flow — production-grade система для безпечної активації catalog policies з двофазною архітектурою (Prepare → Promote). Система забезпечує ідемпотентність, прогрес-трекінг, diff-аналіз та rollback без ризику показати "напів-v2/напів-v1" стан каталогу.

Ключові принципи:
- Ніколи не показувати змішаний стан (v1/v2) в публічному каталозі
- Активація policy має бути ідемпотентна (повторний клік не створює хаосу)
- Прогрес + статус для адмінки ("рахуємо 37%")
- Dry-run / diff до перемикання ("скільки стане eligible/ineligible")
- Rollback за 1 клік (evaluations v1 не затираються)
- Кероване навантаження (батчі, паралельність, rate limit)

## Glossary

- **Catalog_Evaluation_Run**: Запис про виконання RE_EVALUATE_ALL job з progress tracking, counters, статусами (RUNNING/SUCCESS/FAILED/CANCELLED/PROMOTED)
- **Prepare_Phase**: Фаза 1 — обчислення evaluations для нової policy version без зміни active policy
- **Promote_Phase**: Фаза 2 — переключення active policy після успішного завершення Prepare
- **Target_Policy**: Policy, для якої виконується Prepare (ще не active)
- **Active_Policy**: Поточна активна policy, яка визначає public_media_items view
- **Run_Status**: Статус evaluation run: RUNNING, SUCCESS, FAILED, CANCELLED, PROMOTED
- **Ready_To_Promote**: Derived flag — run is SUCCESS AND passes coverage/error thresholds
- **Total_Ready**: Кількість items з ingestion_status='ready' AND deleted_at IS NULL (база для coverage threshold)
- **Coverage_Threshold**: Мінімальний відсоток оброблених items для дозволу Promote
- **Error_Sample**: Перші N помилок для діагностики (зберігаються в run)
- **Diff_Report**: Порівняння v1↔v2: eligible→ineligible (регресії), ineligible→eligible (покращення)
- **Idempotent_Job**: Job, який при повторному запуску не створює дублікатів роботи

## Requirements

### Requirement 1: Розширення Catalog Evaluation Runs

**User Story:** As a system operator, I want comprehensive run tracking with progress and status, so that I can monitor policy activation and handle failures gracefully.

#### Acceptance Criteria

1. THE System SHALL extend catalog_evaluation_runs table with fields: targetPolicyId (FK to catalog_policies), targetPolicyVersion (int), status (enum: RUNNING/SUCCESS/FAILED/CANCELLED/PROMOTED), totalReadySnapshot (int, frozen at start), snapshotCutoff (timestamp), processed (int), eligible (int), ineligible (int), pending (int), errors (int), errorSample (jsonb array of first 10 errors), startedAt, finishedAt, promotedAt, promotedBy
2. WHEN a Prepare phase starts, THE System SHALL create catalog_evaluation_run with status=RUNNING, totalReadySnapshot=count of evaluable items at that moment, and snapshotCutoff=current timestamp
3. WHILE Prepare phase is running, THE System SHALL update processed, eligible, ineligible, pending, errors counters after each batch
4. WHEN Prepare phase completes successfully, THE System SHALL set status=SUCCESS and finishedAt timestamp
5. IF Prepare phase fails, THE System SHALL set status=FAILED, preserve cursor for resumability, and store error details in errorSample
6. THE System SHALL calculate totalReadySnapshot as count of items WHERE ingestion_status='ready' AND deleted_at IS NULL AND updated_at <= snapshotCutoff (frozen at run start)

### Requirement 2: Prepare Phase (Evaluate New Policy)

**User Story:** As a product manager, I want to prepare policy activation by pre-computing all evaluations, so that the actual switch is instant and safe.

#### Acceptance Criteria

1. WHEN admin calls POST /admin/catalog-policies/:id/prepare, THE System SHALL create catalog_evaluation_run with targetPolicyId and status=RUNNING
2. THE System SHALL start RE_EVALUATE_ALL job that evaluates all items under targetPolicyVersion
3. WHILE RE_EVALUATE_ALL is running, THE System SHALL write new evaluation rows with policy_version=targetPolicyVersion (NOT overwriting current active version rows)
4. THE System SHALL NOT change active policy during Prepare phase — public_media_items view continues showing current active policy
5. WHEN RE_EVALUATE_ALL completes, THE System SHALL set run status=SUCCESS
6. THE System SHALL support batch processing with configurable batch size (default: 500)
7. THE System SHALL support configurable concurrency for EVALUATE_CATALOG_ITEM jobs (default: 10)

### Requirement 3: Promote Phase (Activate Policy)

**User Story:** As a product manager, I want to promote a prepared policy only after successful evaluation, so that the catalog never shows incomplete data.

#### Acceptance Criteria

1. WHEN admin calls POST /admin/catalog-policy-runs/:runId/promote, THE System SHALL verify run status=SUCCESS
2. IF run status is not SUCCESS, THE System SHALL return 400 Bad Request with error message
3. THE System SHALL support optional coverage threshold: processed >= totalReadySnapshot * threshold (default: 100%)
4. THE System SHALL calculate totalReadySnapshot as frozen count at run start WHERE ingestion_status='ready' AND deleted_at IS NULL AND updated_at <= snapshotCutoff
5. THE System SHALL support optional error threshold: errors <= maxErrors (default: 0)
6. WHEN promote is called and thresholds pass, THE System SHALL execute in transaction: deactivate old policy → activate target policy → set run promotedAt and promotedBy
7. AFTER promote completes, THE public_media_items view SHALL show evaluations from newly active policy
8. THE System SHALL NOT allow promote for runs with status=FAILED, CANCELLED, or already PROMOTED
9. THE System SHALL expose readyToPromote derived flag: status=SUCCESS AND coverage >= threshold AND errors <= maxErrors

### Requirement 4: Idempotent Job Execution

**User Story:** As a system operator, I want job execution to be idempotent, so that retries and restarts don't create duplicate work or inconsistent state.

#### Acceptance Criteria

1. THE RE_EVALUATE_ALL job SHALL have unique jobId format: reeval:{policyVersion}:{runId}
2. THE EVALUATE_CATALOG_ITEM job SHALL have unique jobId format: eval:{policyVersion}:{mediaItemId}
3. WHEN a job with existing jobId is queued, THE System SHALL skip or deduplicate the job
4. WHEN RE_EVALUATE_ALL is restarted after failure, THE System SHALL resume from cursor position
5. WHEN resuming a failed run, THE System SHALL NOT allow changing targetPolicyVersion — resume must use original policy
6. THE System SHALL use upsert semantics for media_catalog_evaluations to handle retries

### Requirement 5: Controlled Load Management

**User Story:** As a system operator, I want controlled batch processing and concurrency, so that policy activation doesn't overwhelm the database.

#### Acceptance Criteria

1. THE RE_EVALUATE_ALL job SHALL dispatch items in configurable batches (default: 500 items per batch)
2. THE System SHALL limit concurrent EVALUATE_CATALOG_ITEM workers (default: 10)
3. THE System SHALL support rate limiting between batches (optional delay)
4. WHEN processing a batch, THE System SHALL update run counters atomically after batch completion
5. THE System SHALL support pause/resume for long-running evaluations via cursor

### Requirement 6: Run Status Management

**User Story:** As a system operator, I want clear run statuses, so that I can understand the state of policy activation at any time.

#### Acceptance Criteria

1. THE System SHALL support run statuses: RUNNING (in progress), SUCCESS (completed, ready for promote), FAILED (error occurred), CANCELLED (manually stopped), PROMOTED (policy activated)
2. WHEN run is RUNNING, THE System SHALL allow cancel operation
3. WHEN run is SUCCESS, THE System SHALL allow promote operation
4. WHEN run is FAILED, THE System SHALL allow resume operation (restart from cursor)
5. WHEN run is PROMOTED, THE System SHALL NOT allow any further operations on that run
6. THE System SHALL prevent starting new Prepare for same policy while another run is RUNNING

### Requirement 7: Diff Report (v1 vs v2 Comparison)

**User Story:** As a product manager, I want to see the impact of policy change before promoting, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN admin calls GET /admin/catalog-policy-runs/:runId/diff, THE System SHALL return comparison between current active policy and target policy evaluations
2. THE diff report SHALL include aggregated counts: eligibleToIneligible (regressions), ineligibleToEligible (improvements), pendingToEligible, pendingToIneligible, unchanged
3. THE diff report SHALL include sampled items for each category (default: top 50 by trendingScore) with mediaItemId, title, type, oldStatus, newStatus, oldReasons, newReasons
4. THE System SHALL only allow diff for runs with status=SUCCESS
5. THE diff report SHALL be computed from stored evaluations via aggregated SQL (not re-evaluated on the fly)
6. THE diff endpoint SHALL NOT block API — use async computation with caching for large catalogs

### Requirement 8: Cancel Operation

**User Story:** As a system operator, I want to cancel a running evaluation, so that I can stop a problematic activation.

#### Acceptance Criteria

1. WHEN admin calls POST /admin/catalog-policy-runs/:runId/cancel, THE System SHALL set run status=CANCELLED
2. THE System SHALL signal running workers to stop gracefully
3. WHEN run is cancelled, THE System SHALL preserve cursor and counters for potential resume
4. THE System SHALL NOT allow cancel for runs that are not RUNNING
5. AFTER cancel, THE active policy SHALL remain unchanged

### Requirement 9: Admin API Endpoints

**User Story:** As a frontend developer, I want clear API endpoints for policy activation flow, so that I can build admin UI.

#### Acceptance Criteria

1. THE System SHALL expose POST /admin/catalog-policies/:id/prepare — creates run and starts RE_EVALUATE_ALL
2. THE System SHALL expose GET /admin/catalog-policy-runs/:runId — returns run status, progress, counters
3. THE System SHALL expose POST /admin/catalog-policy-runs/:runId/promote — activates policy if run is SUCCESS
4. THE System SHALL expose POST /admin/catalog-policy-runs/:runId/cancel — stops running evaluation
5. THE System SHALL expose GET /admin/catalog-policy-runs/:runId/diff — returns v1↔v2 comparison
6. THE System SHALL expose GET /admin/catalog-policy-runs — lists all runs with pagination and filtering by status

### Requirement 10: Evaluation History Preservation

**User Story:** As a system operator, I want evaluation history preserved, so that I can rollback to previous policy if needed.

#### Acceptance Criteria

1. THE System SHALL store evaluations with policy_version, allowing multiple versions to coexist
2. WHEN new policy is prepared, THE System SHALL NOT delete or overwrite evaluations from previous policy versions
3. THE System SHALL support querying evaluations by policy_version
4. THE public_media_items view SHALL filter by active policy version only
5. THE System SHALL support cleanup of old policy version evaluations via admin endpoint (optional, manual)

### Requirement 11: Serialization Round-Trip

**User Story:** As a developer, I want run data to serialize correctly, so that I can store and retrieve it without data loss.

#### Acceptance Criteria

1. FOR ALL valid CatalogEvaluationRun objects, serializing to JSON then deserializing SHALL produce an equivalent object
2. THE System SHALL validate run counters JSON against schema
3. THE errorSample array SHALL preserve error details including mediaItemId, error message, and stack trace (truncated)

