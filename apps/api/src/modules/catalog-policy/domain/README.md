# Catalog Policy Engine

## What is this?

The Policy Engine is the brain of Ratingo's content catalog. It decides which movies and TV shows appear in the catalog and which don't.

**The problem it solves:** Ratingo aggregates content from many sources (TMDB, JustWatch, etc.), but not everything should be shown to Ukrainian users. We need to filter out:
- Content from sanctioned countries (Russia, Belarus)
- Content without proper metadata (missing title, country, language)
- Low-quality content without ratings or reviews
- Content that's not readable for Ukrainian audience (e.g., Japanese titles without translation)

**The solution:** A multi-stage filtering system with escape hatches (breakout rules) for exceptional content like global hits.

## Glossary

| Term | Meaning |
|------|---------|
| **Gate** | A validation checkpoint. Content must pass all gates to be eligible. Like airport security — fail any check, you don't get through. |
| **Breakout Rule** | An escape hatch. Allows exceptional content to bypass certain restrictions. Example: "Squid Game" is Korean (normally blocked), but has 1M+ IMDb votes, so it breaks out. |
| **SOFT Filter** | A restriction that breakout rules CAN override. Example: anime content class exclusion. |
| **HARD Filter** | A restriction that breakout rules CANNOT override. Example: Russian origin country block. |
| **Context** | Where the content will be displayed. Different surfaces have different requirements. Homepage needs overview text, "Now Playing" doesn't. |
| **Eligibility** | The final verdict: ELIGIBLE (show it) or INELIGIBLE (hide it). |

## Real-World Example

Let's trace how "Squid Game" (Korean series) gets evaluated:

```
Input:
  - originCountries: ['KR']
  - originalLanguage: 'ko'
  - title: 'Squid Game'
  - voteCountImdb: 1,200,000
  - contentClass: 'mainstream'

Policy:
  - allowedCountries: ['US', 'GB', 'UA', ...]
  - blockedCountries: ['RU', 'BY']
  - allowedLanguages: ['en', 'uk']
  - blockedLanguages: ['ru']
  - breakoutRules: [{ id: 'global-hit', minImdbVotes: 500000 }]

Evaluation:
  ✓ STEP 1: Data Integrity — originCountries, language, title present
  ✓ STEP 2: Display Gates — title is readable (Latin chars)
  ✓ STEP 3: Content Class — 'mainstream' not excluded
  ✓ STEP 4: Blocked Check — Korea not in blocked list
  ✓ STEP 5: Global Gate — 1.2M votes > required threshold
  ? STEP 6: Neutral Check — Korea not in allowed list → NEUTRAL

  Korea is NEUTRAL (not allowed, not blocked).
  But wait! Check breakout rules...
  ✓ 'global-hit' rule matches (1.2M > 500K votes)

Result: ELIGIBLE via breakout rule 'global-hit'
```

Now let's see a Russian film that gets blocked:

```
Input:
  - originCountries: ['RU']
  - originalLanguage: 'ru'
  - title: 'Some Russian Movie'
  - voteCountImdb: 50,000

Evaluation:
  ✓ STEP 1: Data Integrity — all present
  ✓ STEP 2: Display Gates — title readable
  ✓ STEP 3: Content Class — not excluded
  ✗ STEP 4: Blocked Check — Russia IS in blocked list → BLOCKED

  Try breakout? No — blocked country is a HARD filter.
  Even with breakout rule, Russian content stays blocked.

Result: INELIGIBLE (BLOCKED_COUNTRY)
```

## Architecture Overview

```
policy-engine.ts (Orchestrator)
       │
       ├── gates/           → Validation gates (pass/fail checks)
       │   ├── data-integrity.gate.ts    → Required fields present?
       │   ├── display.gate.ts           → Title readable? Overview exists?
       │   ├── country-language.gate.ts  → Blocked? Neutral? Allowed?
       │   └── global-requirements.gate.ts → Quality signals present?
       │
       ├── evaluators/      → Breakout rule matching
       │   ├── requirement-matchers.ts   → Individual requirement checks
       │   └── breakout-rule.evaluator.ts → Find matching rule by priority
       │
       └── utils/           → Pure utility functions
           ├── title-readability.ts      → CJK/Latin detection
           └── offer-filter.ts           → Streaming offer filtering
```

## Evaluation Flow

The engine processes media items through 6 sequential steps:

```
┌─────────────────────────────────────────────────────────────────┐
│                    evaluateEligibility()                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STEP 1: Data Integrity                                         │
│  ├── Origin countries present?                                  │
│  ├── Original language present?                                 │
│  └── Title present?                                             │
│       ↓ FAIL → INELIGIBLE (MISSING_REQUIRED_METADATA)           │
│                                                                 │
│  STEP 2: Display Gates (context-aware)                          │
│  ├── Title readable for UA audience?                            │
│  └── Overview present? (required for trending/homepage)         │
│       ↓ FAIL → INELIGIBLE (MISSING_TRANSLATED_TITLE/OVERVIEW)   │
│                                                                 │
│  STEP 3: Content Class Exclusion (SOFT filter)                  │
│  └── Is content class excluded? (anime, reality, etc.)          │
│       ↓ YES → Try breakout rules (can override)                 │
│                                                                 │
│  STEP 4: Blocked Checks (HARD filter)                           │
│  ├── Country in blocked list?                                   │
│  └── Language in blocked list?                                  │
│       ↓ YES → INELIGIBLE (breakout cannot override)             │
│                                                                 │
│  STEP 5: Global Quality Gate (context-aware)                    │
│  ├── Minimum quality score?                                     │
│  ├── Required ratings present?                                  │
│  └── Minimum votes threshold?                                   │
│       ↓ FAIL → INELIGIBLE (MISSING_GLOBAL_SIGNALS)              │
│                                                                 │
│  STEP 6: Neutral/Allowed Checks (with breakout opportunity)     │
│  ├── Country/language in allowed list? → ELIGIBLE               │
│  ├── Neutral + RELAXED mode? → Check if either is allowed       │
│  └── Neutral + STRICT mode? → Try breakout rules first          │
│       ↓ Breakout matches → ELIGIBLE                             │
│       ↓ No breakout → INELIGIBLE (NEUTRAL_COUNTRY/LANGUAGE)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why SOFT vs HARD Filters?

**SOFT filters** exist for content we generally don't want, but exceptions are okay:
- Anime is excluded by default (niche audience)
- But "Attack on Titan" with 1M+ votes? Let it through via breakout.
- Neutral countries (Korea, Japan) are not in allowed list
- But "Squid Game" with 1.2M votes? Global hit, let it through.

**HARD filters** exist for content we NEVER want, regardless of popularity:
- Russian propaganda film with 10M views? Still blocked.
- This is a business/ethical decision, not a quality decision.

```
SOFT filter (content class exclusion):
  Excluded anime + breakout rule match → ELIGIBLE ✓

SOFT filter (neutral country):
  Korean film + breakout rule match → ELIGIBLE ✓  (Squid Game case)

HARD filter (blocked country):
  Russian film + breakout rule match → Still INELIGIBLE ✗
```

## Context-Aware Evaluation

Different display surfaces have different requirements:

| Context | Global Gate | Overview Required | Use Case |
|---------|-------------|-------------------|----------|
| `catalog` | Yes | No | Main catalog listing |
| `homepage` | Yes | Yes (60+ chars) | Featured on homepage |
| `trending` | Yes | Yes (60+ chars) | Trending section |
| `search` | Yes | No | Search results |
| `now_playing` | No | No | Currently in theaters |
| `new_digital` | No | No | New digital releases |

**Why?** New releases (`now_playing`, `new_digital`) may not have enough votes/ratings yet, so we skip the global quality gate for them.

```typescript
// Same content, different results based on context
evaluateEligibility(input, policy, { context: 'catalog' });     // May fail global gate
evaluateEligibility(input, policy, { context: 'now_playing' }); // Skips global gate
```

## Title Readability

Ukrainian users need to be able to read titles. Pure CJK titles are not readable:

| Title | Readable? | Why |
|-------|-----------|-----|
| `The Matrix` | ✓ Yes | Latin characters |
| `Матриця` | ✓ Yes | Cyrillic characters |
| `ファイナルファンタジー` | ✗ No | Japanese only, no translation |
| `千と千尋の神隠し (Spirited Away)` | ✓ Yes | Has Latin suffix |
| `功夫` | ✗ No | CJK-only, no Latin/Cyrillic hint |
| `2001` | ✓ Yes | Numbers only, no CJK |

The rule: **2+ Latin/Cyrillic characters → readable. Any CJK without Latin/Cyrillic → not readable.**

No exceptions for short titles. `功夫` (Kung Fu) is not readable for UA users without translation.

> **Future improvement:** Titles with known global aliases (e.g. 功夫 → Kung Fu) may be allowed if alias resolution is available.

## Breakout Rules

Breakout rules are evaluated by priority (lowest number = highest priority):

```typescript
breakoutRules: [
  {
    id: 'global-phenomenon',
    priority: 0,  // Checked first
    requirements: { minImdbVotes: 500000 }
  },
  {
    id: 'quality-hit',
    priority: 1,  // Checked second
    requirements: { minImdbVotes: 100000, minQualityScoreNormalized: 0.7 }
  },
  {
    id: 'ukrainian-content',
    priority: 2,  // Checked last
    requirements: { originCountries: ['UA'], minImdbVotes: 1000 }
  },
]
```

**Important:** Global quality gate must pass BEFORE breakout rules are evaluated. This prevents low-quality content from breaking out just because it meets vote thresholds.

## Code Examples

### Basic Usage

```typescript
import { evaluateEligibility, computeRelevance } from './policy-engine';

const input: PolicyEngineInput = {
  mediaItem: {
    id: 'tt1234567',
    originCountries: ['US'],
    originalLanguage: 'en',
    title: 'The Matrix',
    overview: 'A computer hacker learns about the true nature of reality...',
    contentClass: 'mainstream',
    normalizedOffers: [],
    voteCountImdb: 1500000,
    ratingImdb: 8.7,
    // ...
  },
  stats: {
    qualityScore: 0.85,
    popularityScore: 0.92,
    freshnessScore: 0.3,
    ratingoScore: 87,
  },
};

const result = evaluateEligibility(input, policy, { context: 'catalog' });
// { status: 'ELIGIBLE', reasons: ['ALLOWED_COUNTRY', 'ALLOWED_LANGUAGE'], breakoutRuleId: null }

const relevance = computeRelevance(input, policy);
// 75 (0-100 score for homepage ranking)
```

### Using Individual Gates

```typescript
import { checkDataIntegrity } from './gates';
import { findMatchingBreakoutRule } from './evaluators';
import { isReadableTitle } from './utils';

// Check data integrity separately
const integrityResult = checkDataIntegrity(mediaItem);
if (!integrityResult.passes) {
  console.log('Missing data:', integrityResult.evaluation.reasons);
}

// Check title readability
if (!isReadableTitle(mediaItem.title)) {
  console.log('Title not readable for UA audience');
}

// Find matching breakout rule
const rule = findMatchingBreakoutRule(input, policy);
if (rule) {
  console.log('Breaks out via:', rule.id);
}
```

## Testing

```bash
# Run all domain tests (373 tests)
npm test -- src/modules/catalog-policy/domain/

# Run specific module tests
npm test -- src/modules/catalog-policy/domain/gates/
npm test -- src/modules/catalog-policy/domain/evaluators/
npm test -- src/modules/catalog-policy/domain/utils/

# Run property-based tests (edge cases)
npm test -- src/modules/catalog-policy/domain/policy-engine.property.spec.ts

# Run regression tests (real-world scenarios)
npm test -- src/modules/catalog-policy/domain/anime-breakout.regression.spec.ts
```

## File Structure

```
domain/
├── policy-engine.ts           # Main orchestrator (entry point)
├── classification.service.ts  # Content class detection
├── constants/
│   ├── evaluation.constants.ts # Status, reasons, contexts
│   └── breakout-rules.ts       # Predefined breakout rules
├── types/
│   └── policy.types.ts         # All TypeScript interfaces
├── gates/
│   ├── index.ts                # Barrel export
│   ├── data-integrity.gate.ts  # Required fields validation
│   ├── display.gate.ts         # Title/overview validation
│   ├── country-language.gate.ts # Geo/language filtering
│   └── global-requirements.gate.ts # Quality gate
├── evaluators/
│   ├── index.ts                # Barrel export
│   ├── requirement-matchers.ts # Individual requirement checks
│   └── breakout-rule.evaluator.ts # Rule matching logic
├── utils/
│   ├── index.ts                # Barrel export
│   ├── title-readability.ts    # CJK/Latin detection
│   └── offer-filter.ts         # Streaming offer filtering
├── validation/                 # Policy schema validation
├── errors/                     # Custom error types
└── ports/                      # Dependency injection ports
```

## Backward Compatibility

All original exports from `policy-engine.ts` still work:

```typescript
import {
  evaluateEligibility,
  computeRelevance,
  isReadableTitle,
  shouldApplyGlobalGate,
  getContextRequirements,
  getDefaultContextRequirements,
  checkContentClassExcluded,
  getReasonDescriptions,
} from './policy-engine';
```

These are re-exported from their new locations for compatibility.
