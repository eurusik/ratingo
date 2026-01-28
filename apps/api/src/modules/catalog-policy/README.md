# Catalog Policy Module

The **Catalog Policy Module** is Ratingo's core eligibility engine that determines which movies and TV shows appear in the catalog. It filters content from multiple international sources against a configurable policy to ensure appropriate content for Ukrainian audiences.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Module Structure](#module-structure)
- [Policy Engine](#policy-engine)
- [Public API](#public-api)
- [Background Jobs](#background-jobs)
- [Testing](#testing)

## Overview

### Problem Statement

Ratingo aggregates content from TMDB, JustWatch, and other providers. Not all content should be shown to users. This module filters out:

- Content from sanctioned countries (Russia, Belarus)
- Content with missing or unreadable titles (CJK-only without translation)
- Low-quality content without ratings/reviews
- Content from neutral countries (unless they're global hits like "Squid Game")

### Key Features

- **Configurable policy rules** — Admin-editable eligibility criteria
- **Context-aware evaluation** — Different rules for trending, homepage, search
- **Breakout rules** — Escape hatches for exceptional content
- **Audit trail** — Every decision has an explicit reason
- **Dry-run simulation** — Test policy changes before activation
- **Batch re-evaluation** — Apply new policies to entire catalog

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                       │
│                                                               │
│   PolicyController   RunController   DryRunController         │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                      APPLICATION LAYER                        │
│                                                               │
│   Services:                                                   │
│   • CatalogEvaluationService    • PolicyActivationService     │
│   • BatchEvaluationService      • DryRunService               │
│   • CatalogPolicyService        • DiffService                 │
│                                                               │
│   Workers (BullMQ):                                           │
│   • ReEvaluateAllHandler                                      │
│   • EvaluateItemHandler                                       │
│   • WatchdogHandler                                           │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                        DOMAIN LAYER                           │
│                                                               │
│   ┌─────────────────────────────────────────────────────┐     │
│   │                   PolicyEngine                      │     │
│   │                                                     │     │
│   │   Gates:               Evaluators:                  │     │
│   │   • DataIntegrityGate  • BreakoutRuleEvaluator      │     │
│   │   • DisplayGate        • RequirementMatchers        │     │
│   │   • CountryLanguageGate                             │     │
│   │   • GlobalRequirementsGate                          │     │
│   └─────────────────────────────────────────────────────┘     │
│                                                               │
│   Types  │  Constants  │  Errors  │  Ports (Interfaces)       │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                    INFRASTRUCTURE LAYER                       │
│                                                               │
│   Repositories (Drizzle ORM):                                 │
│   • CatalogPolicyRepository                                   │
│   • MediaCatalogEvaluationRepository                          │
│   • CatalogEvaluationRunRepository                            │
│   • PolicyInputRepository                                     │
│   • DryRunRepository                                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Core Concepts

### SOFT vs HARD Filters

| Filter Type | Example                | Breakout Override? |
| ----------- | ---------------------- | ------------------ |
| **SOFT**    | Anime excluded         | Yes                |
| **SOFT**    | Neutral country        | Yes                |
| **HARD**    | Blocked country (RU)   | No                 |
| **HARD**    | Blocked language       | No                 |

### Breakout Rules

Escape hatches for exceptional content. Evaluated by priority (lower number = higher priority):

```typescript
{
  id: 'global-phenomenon',
  priority: 0,
  requirements: {
    minImdbVotes: 500000,
    excludeOriginCountries: ['RU']
  }
}
```

### Context-Aware Evaluation

Different surfaces have different requirements:

| Context       | Global Gate | Overview Required | Use Case            |
| ------------- | ----------- | ----------------- | ------------------- |
| `catalog`     | Yes         | No                | Main listing        |
| `homepage`    | Yes         | Yes (60+ chars)   | Featured content    |
| `trending`    | Yes         | Yes (60+ chars)   | Trending section    |
| `search`      | Yes         | No                | Search results      |
| `now_playing` | No          | No                | In theaters         |
| `new_digital` | No          | No                | New digital release |

### Title Readability

Titles must be readable for Ukrainian audience (Latin or Cyrillic characters):

| Title                              | Readable | Reason              |
| ---------------------------------- | -------- | ------------------- |
| `The Matrix`                       | Yes      | Latin characters    |
| `Матриця`                          | Yes      | Cyrillic            |
| `ファイナルファンタジー`           | No       | Japanese only       |
| `千と千尋の神隠し (Spirited Away)` | Yes      | Has Latin suffix    |

### Evaluation Status

```typescript
ELIGIBLE    // Content shown to users
INELIGIBLE  // Content hidden
REVIEW      // Manual review required (reserved)
```

### Evaluation Reasons

Every decision includes an explicit reason for audit:

```typescript
// Missing data
MISSING_REQUIRED_METADATA
MISSING_ORIGIN_COUNTRY
MISSING_ORIGINAL_LANGUAGE
MISSING_TITLE
MISSING_TRANSLATED_TITLE
MISSING_OVERVIEW

// Filtered
BLOCKED_COUNTRY
BLOCKED_LANGUAGE
NEUTRAL_COUNTRY
NEUTRAL_LANGUAGE
EXCLUDED_CONTENT_CLASS
MISSING_GLOBAL_SIGNALS

// Success
ALLOWED_COUNTRY
ALLOWED_LANGUAGE
BREAKOUT_ALLOWED
```

## Module Structure

```
catalog-policy/
├── presentation/           # HTTP layer
│   ├── controllers/        # PolicyController, RunController, DryRunController
│   ├── dtos/               # Request/response DTOs
│   ├── filters/            # Exception filters
│   └── utils/              # ErrorResponseBuilder
│
├── application/            # Business logic
│   ├── services/           # Core services
│   ├── workers/            # BullMQ worker
│   │   └── handlers/       # Job handlers (SRP)
│   ├── mappers/            # Entity ↔ DTO conversion
│   └── utils/              # OfferMapper, PolicyInputMapper
│
├── domain/                 # Pure business logic (zero dependencies)
│   ├── policy-engine.ts    # Main orchestrator
│   ├── gates/              # Validation checkpoints
│   ├── evaluators/         # Breakout rule matching
│   ├── types/              # TypeScript interfaces
│   ├── constants/          # Status, reasons, contexts
│   ├── errors/             # Domain errors
│   ├── ports/              # Repository interfaces
│   └── validation/         # Zod schemas
│
├── infrastructure/         # Database access
│   └── repositories/       # Drizzle ORM implementations
│
└── public/                 # Module exports for other modules
    └── index.ts
```

## Policy Engine

The core `PolicyEngine.evaluateEligibility()` runs a 6-step pipeline:

```
STEP 1: Data Integrity Gate
├─ Origin countries present?
├─ Original language present?
└─ Title present?
   └─ FAIL → INELIGIBLE (MISSING_REQUIRED_METADATA)

STEP 2: Display Gate (context-aware)
├─ Title readable? (Latin/Cyrillic)
└─ Overview present? (only for trending/homepage)
   └─ FAIL → INELIGIBLE (MISSING_TRANSLATED_TITLE)

STEP 3: Content Class Exclusion (SOFT)
└─ Is content class excluded? (anime, reality, etc.)
   └─ Try breakout rules (can override)

STEP 4: Blocked Check (HARD)
├─ Country in blocked list?
└─ Language in blocked list?
   └─ YES → INELIGIBLE (breakout CANNOT override)

STEP 5: Global Quality Gate (context-aware)
├─ Min quality score?
├─ Required ratings present?
└─ Min vote threshold?
   └─ FAIL → INELIGIBLE (MISSING_GLOBAL_SIGNALS)

STEP 6: Neutral/Allowed Check (with breakout)
├─ Country/language in allowed list? → ELIGIBLE
├─ Try RELAXED mode?
└─ Try breakout rules?
   └─ ELIGIBLE if match, else INELIGIBLE
```

### Example: "Squid Game"

```typescript
// Input
{
  originCountries: ['KR'],
  originalLanguage: 'ko',
  title: 'Squid Game',
  voteCountImdb: 1_200_000
}

// Evaluation flow
✓ Step 1: Data integrity passed
✓ Step 2: Title readable ("Squid Game" = Latin)
✓ Step 3: Not excluded (mainstream class)
✓ Step 4: Not blocked (Korea ≠ Russia/Belarus)
✓ Step 5: Global gate passed (1.2M votes)
? Step 6: Korea is NEUTRAL
  → Breakout rule 'global-phenomenon' matches
  → 1.2M > 500K required votes

// Result
ELIGIBLE via breakout rule 'global-phenomenon'
```

## Public API

Other modules should only import from `public/index.ts`:

```typescript
import {
  ContentClass,
  classifyContent,
  EligibilityStatus,
  EvaluationReason,
  EvaluationContext,
  CATALOG_POLICY_EVALUATOR,
  ICatalogPolicyEvaluator,
} from '@modules/catalog-policy/public';
```

### Using the Evaluator Port

```typescript
@Injectable()
export class IngestionService {
  constructor(
    @Inject(CATALOG_POLICY_EVALUATOR)
    private readonly policyEvaluator: ICatalogPolicyEvaluator,
  ) {}

  async processMedia(media: MediaInput) {
    const result = await this.policyEvaluator.evaluate(
      media,
      EvaluationContext.CATALOG,
    );

    if (result.status === EligibilityStatus.ELIGIBLE) {
      // Add to catalog
    }
  }
}
```

## Background Jobs

Queue: `catalog-policy-queue` (single-threaded to avoid race conditions)

| Job Type              | Handler                | Description                          |
| --------------------- | ---------------------- | ------------------------------------ |
| `RE_EVALUATE_ALL`     | ReEvaluateAllHandler   | Re-evaluate entire catalog           |
| `EVALUATE_CATALOG_ITEM` | EvaluateItemHandler  | Evaluate single media item           |
| `WATCHDOG`            | WatchdogHandler        | Monitor and finalize stale runs      |

All jobs are **idempotent** and can be safely retried.

## Testing

The module includes comprehensive test coverage:

```bash
# Run all module tests
npm test -- src/modules/catalog-policy

# Run specific test file
npm test -- src/modules/catalog-policy/domain/policy-engine.spec.ts

# Run with coverage
npm test -- --coverage src/modules/catalog-policy
```

### Test Types

- **Unit tests** — Individual functions and classes
- **Property-based tests** — Edge cases with fast-check (1000+ scenarios)
- **Regression tests** — Real-world scenarios (anime breakout, etc.)
- **Integration tests** — Full evaluation pipelines

### Key Test Files

| File                                        | Coverage                    |
| ------------------------------------------- | --------------------------- |
| `domain/policy-engine.spec.ts`              | Core evaluation logic       |
| `domain/gates/*.spec.ts`                    | Individual gate validation  |
| `domain/evaluators/*.spec.ts`               | Breakout rule matching      |
| `application/services/*.spec.ts`            | Service orchestration       |

## Integration Points

### With Other Modules

| Module      | Integration                                      |
| ----------- | ------------------------------------------------ |
| Ingestion   | Uses `CATALOG_POLICY_EVALUATOR` port             |
| Provider    | Resolves streaming offers to canonical IDs       |
| Public API  | Queries evaluated media by context               |
| Auth        | `AdminJwtGuard` protects policy endpoints        |

### Run Lifecycle

```
running → prepared → promoted | cancelled | failed
```

## Constraints

- **Single-threaded queue** — Sequential processing avoids race conditions
- **No direct domain imports** — Use `public/index.ts` exports only
- **Explicit reasons required** — Every decision needs an `EvaluationReason`
- **Hard filters are absolute** — Breakout rules cannot override blocked countries
