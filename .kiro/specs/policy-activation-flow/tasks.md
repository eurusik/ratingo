# Implementation Plan: Policy Activation Flow

## Overview

Поетапна імплементація двофазної активації policy (Prepare → Promote). Розбито на 3 фази для швидкого MVP.

## Prerequisites

- Catalog Policy Engine base implementation (migrations, policy engine, evaluation service)
- BullMQ or similar job queue configured
- Existing catalog_evaluation_runs table

---

## Phase A: MVP (1-2 days) — "Prepare/Promote працює"

Мета: можна створити policy v2, зробити Prepare, побачити counters, зробити Promote.

- [ ] A1. Database Schema Updates
  - [x] A1.1 Create migration: Extend catalog_evaluation_runs table
    - Add target_policy_id (uuid, FK to catalog_policies)
    - Add target_policy_version (integer)
    - Add total_ready_snapshot (integer), snapshot_cutoff (timestamp)
    - Add eligible, ineligible, pending, errors (integer counters)
    - Add error_sample (jsonb array)
    - Add promoted_at (timestamp), promoted_by (text)
    - Update status enum: rename 'completed' to 'success', add 'cancelled', 'promoted'
    - _Requirements: 1.1, 6.1_

  - [x] A1.2 Create migration: Add unique index for running runs
    - Create partial unique index on (target_policy_id) WHERE status='running'
    - Prevents concurrent runs for same policy at DB level
    - _Requirements: 6.6_

  - [x] A1.3 Create migration: Update media_catalog_evaluations for multi-version
    - Change primary key from (media_item_id) to (media_item_id, policy_version)
    - Add index on policy_version
    - _Requirements: 10.1, 10.2_

  - [x] A1.4 Create migration: Update public_media_items view
    - Join catalog_policies WHERE is_active=true
    - Filter evaluations by active policy version
    - _Requirements: 10.4_

  - [x] A1.5 Update Drizzle schema.ts
    - Add new columns to catalogEvaluationRuns
    - Update runStatusEnum with new values
    - Update mediaCatalogEvaluations with composite key
    - _Requirements: 1.1, 6.1, 10.1_

- [ ] A2. PolicyActivationService Core
  - [x] A2.1 Create PolicyActivationService class
    - Create `apps/api/src/modules/catalog-policy/application/services/policy-activation.service.ts`
    - Inject CatalogPolicyRepository, CatalogEvaluationRunRepository, job queue
    - _Requirements: 2.1, 3.1_

  - [x] A2.2 Implement preparePolicy method
    - Verify policy exists and is not already active
    - Check no RUNNING run exists for this policy
    - Calculate totalReadySnapshot and snapshotCutoff at run start
    - Create run with status=RUNNING
    - Queue RE_EVALUATE_ALL job (TODO: Phase A3)
    - Return { runId, status }
    - _Requirements: 1.2, 2.1, 2.2, 6.6_

  - [x] A2.3 Implement getRunStatus method
    - Fetch run by ID
    - Calculate coverage = processed / totalReadySnapshot
    - Calculate readyToPromote flag
    - Calculate blockingReasons array
    - _Requirements: 3.9, 9.2_

  - [x] A2.4 Implement promoteRun method
    - Verify run status=SUCCESS
    - Check coverage threshold (default 100%)
    - Check error threshold (default 0)
    - Execute in transaction: deactivate old → activate new → set promotedAt
    - Return { success, error? }
    - _Requirements: 3.1-3.8_

- [ ] A3. RE_EVALUATE_ALL Job Handler
  - [x] A3.1 Create RE_EVALUATE_ALL job handler
    - Create `apps/api/src/modules/catalog-policy/application/workers/catalog-policy.worker.ts`
    - Accept payload: { runId, policyVersion, batchSize, cursor? }
    - Generate jobId: `reeval:${policyVersion}:${runId}`
    - _Requirements: 4.1, 5.1_

  - [x] A3.2 Implement batch fetching logic
    - Query media_items WHERE ingestion_status='ready' AND deleted_at IS NULL
    - Filter by updated_at <= snapshotCutoff
    - ORDER BY id, use cursor for pagination
    - Fetch batchSize items per iteration (default: 500)
    - _Requirements: 5.1, 5.5_

  - [x] A3.3 Implement job dispatching
    - Dispatch EVALUATE_CATALOG_ITEM jobs for batch
    - JobId: `eval:${policyVersion}:${mediaItemId}`
    - Wait for batch completion before next batch
    - _Requirements: 5.2_

  - [x] A3.4 Implement counter updates
    - After each batch, update run counters atomically
    - Update cursor to last processed item id
    - _Requirements: 1.3, 5.4_

  - [x] A3.5 Implement completion handling
    - When all items processed, set status=SUCCESS
    - Set finishedAt timestamp
    - _Requirements: 1.4, 2.5_

  - [x] A3.6 Implement failure handling
    - On error, set status=FAILED
    - Preserve cursor for resume
    - Store error in errorSample (max 10)
    - _Requirements: 1.5_

- [ ] A4. EVALUATE_CATALOG_ITEM Job Updates
  - [x] A4.1 Update EVALUATE_CATALOG_ITEM job handler
    - Accept policyVersion and runId in payload
    - Generate jobId: `eval:${policyVersion}:${mediaItemId}`
    - Write evaluation with specified policyVersion
    - _Requirements: 4.2, 2.3_

  - [x] A4.2 Implement upsert semantics
    - Use ON CONFLICT (media_item_id, policy_version) DO UPDATE
    - Handle retries gracefully
    - _Requirements: 4.6_

- [ ] A5. Admin API Endpoints (Minimal)
  - [x] A5.1 Create POST /admin/catalog-policies/:id/prepare endpoint
    - Validate policy exists
    - Call PolicyActivationService.preparePolicy
    - Return 202 Accepted with runId
    - _Requirements: 9.1_

  - [x] A5.2 Create GET /admin/catalog-policy-runs/:runId endpoint
    - Call PolicyActivationService.getRunStatus
    - Return run with progress and readyToPromote
    - _Requirements: 9.2_

  - [x] A5.3 Create POST /admin/catalog-policy-runs/:runId/promote endpoint
    - Accept optional coverageThreshold, maxErrors
    - Call PolicyActivationService.promoteRun
    - Return 200 OK or 400 Bad Request
    - _Requirements: 9.3_

- [ ] A6. Checkpoint - MVP Complete
  - Test full flow: create policy v2 → prepare → check counters → promote
  - Verify public_media_items shows new policy version
  - Ensure all tests pass, ask the user if questions arise

---

## Phase B: Diff / Cancel / Resume

Мета: можна побачити diff перед promote, скасувати running job, відновити failed job.

- [ ] B1. DiffService
  - [ ] B1.1 Create DiffService class
    - Create `apps/api/src/modules/catalog-policy/application/services/diff.service.ts`
    - _Requirements: 7.1_

  - [ ] B1.2 Implement computeDiff method
    - Verify run status=SUCCESS
    - Execute aggregated SQL for counts
    - Execute sampled SQL for top items (by trendingScore)
    - Return DiffReport
    - _Requirements: 7.2-7.5_

  - [ ] B1.3 Create GET /admin/catalog-policy-runs/:runId/diff endpoint
    - Call DiffService.computeDiff
    - Return DiffReport
    - _Requirements: 9.5_

- [ ] B2. Cancel / Resume
  - [ ] B2.1 Implement cancelRun method
    - Verify run status=RUNNING
    - Set status=CANCELLED
    - Preserve cursor and counters
    - _Requirements: 8.1-8.5_

  - [ ] B2.2 Implement resumeRun method
    - Verify run status=FAILED
    - Verify targetPolicyVersion unchanged
    - Set status=RUNNING
    - Queue RE_EVALUATE_ALL with cursor
    - _Requirements: 4.4, 4.5, 6.4_

  - [ ] B2.3 Add cancellation check in RE_EVALUATE_ALL
    - Before each batch, check if run status changed to CANCELLED
    - If cancelled, stop processing gracefully
    - _Requirements: 8.2_

  - [ ] B2.4 Create POST /admin/catalog-policy-runs/:runId/cancel endpoint
    - Call PolicyActivationService.cancelRun
    - Return 200 OK
    - _Requirements: 9.4_

  - [ ] B2.5 Create GET /admin/catalog-policy-runs endpoint
    - Support query params: status, policyId, limit, offset
    - Call PolicyActivationService.listRuns
    - Return paginated list
    - _Requirements: 9.6_

- [ ] B3. Checkpoint - Phase B Complete
  - Test diff endpoint shows regressions/improvements
  - Test cancel stops running job
  - Test resume continues from cursor
  - Ensure all tests pass, ask the user if questions arise

---

## Phase C: Minimal Admin UI

Мета: технічна сторінка для керування policies без curl/Postman.

- [ ] C1. Admin UI Page
  - [ ] C1.1 Create /admin/policies page layout
    - Create `apps/web/app/admin/policies/page.tsx`
    - Simple table: policies with version, status, createdAt
    - "Prepare" button for inactive policies
    - _Requirements: 9.1_

  - [ ] C1.2 Create runs list component
    - Show runs for selected policy
    - Display: runId, status, progress %, startedAt
    - Color-code status
    - _Requirements: 9.2, 9.6_

  - [ ] C1.3 Create progress component
    - Progress bar: processed / totalReadySnapshot
    - Counters: eligible, ineligible, pending, errors
    - Auto-refresh while RUNNING (polling 5s)
    - _Requirements: 1.3, 9.2_

  - [ ] C1.4 Create diff view component
    - Aggregated counts: regressions, improvements
    - Collapsible sampled items (top 50)
    - _Requirements: 7.2, 7.3, 9.5_

  - [ ] C1.5 Create action buttons
    - "Promote" (enabled when readyToPromote)
    - "Cancel" (enabled when RUNNING)
    - Show blockingReasons
    - Confirmation modal
    - _Requirements: 9.3, 9.4_

- [ ] C2. Final Checkpoint
  - Full flow via UI: Prepare → Progress → Diff → Promote
  - Ensure all tests pass

---

## Must-Have Property Tests (run after Phase A)

- [ ] P1. Write property test: Ready To Promote Flag
  - **Property 12: Ready To Promote Flag**
  - readyToPromote = status=SUCCESS AND coverage >= threshold AND errors <= max
  - **Validates: Requirements 3.9**

- [ ] P2. Write property test: Promote Status Validation
  - **Property 7: Promote Status Validation**
  - Promote only allowed when status=SUCCESS
  - **Validates: Requirements 3.1, 3.2, 3.8**

- [ ] P3. Write property test: Counter Consistency
  - **Property 2: Counter Consistency**
  - eligible + ineligible + pending + errors = processed
  - **Validates: Requirements 1.3, 5.4**

- [ ] P4. Write property test: Evaluation Version Isolation
  - **Property 5: Evaluation Version Isolation**
  - Evaluations written with targetPolicyVersion, old versions unchanged
  - **Validates: Requirements 2.3, 10.1, 10.2**

---

## Notes

- Phase A is MVP — можна чистити каталог одразу після завершення
- Phase B додає diff/cancel/resume — nice to have для production
- Phase C — UI тільки коли бекенд стабільний
- Property tests P1-P4 — must-have, решта optional
- JobId для items: `eval:{policyVersion}:{mediaItemId}` (не runId!)

## Design Decisions Reference

- **DD-1**: Composite PK (media_item_id, policy_version) for multi-version evaluations
- **DD-2**: View joins active policy for atomic switch
- **DD-3**: 100% coverage threshold default
- **DD-4**: Unique index for preventing concurrent runs
- **DD-5**: Error sample limit (10 errors, 500 char stack)
- **DD-6**: Active policy version invariant - changes only through Promote
- **DD-7**: Snapshot-based total count - frozen at run start
- **DD-8**: Job ID = `eval:{policyVersion}:{mediaItemId}` for natural deduplication

## Dependencies

- `.kiro/specs/catalog-policy-engine/` - base policy engine
- Policy Engine pure functions (evaluateEligibility, computeRelevance)
- CatalogPolicyRepository, MediaCatalogEvaluationRepository
