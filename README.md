<div align="center">

# Ratingo

**What the world is watching right now — and whether it's worth it**

A Ukrainian-language service that shows what the world is watching right now:\
movies, TV shows, their ratings, where to stream them legally, and when new episodes drop.

[new.ratingo.top](https://new.ratingo.top)

</div>

---

## Why Ratingo?

Every streaming platform tells you everything is a must-watch. We don't.

Ratingo exists to give you the full picture — fast. What's trending, what's actually good, where to watch it, and whether it's worth your time. No pirate links, no clickbait, no algorithmic chaos. Just content that matters, with honest ratings from multiple sources in one place.

Ukrainian by default. Built for clarity, not for clicks.

## What's Inside

- **Trending movies & shows** — tracked over 30 and 90 days, based on real viewer activity
- **Aggregated ratings** — TMDB, Trakt, IMDb, Metacritic — compared side by side
- **Rich content cards** — descriptions, cast, trailers, Ukrainian translations
- **Streaming availability** — legal platforms for Ukraine and the US
- **Episode calendar** — know exactly when the next episode drops
- **Ratingo Score** — our own composite rating that balances quality, popularity, and freshness so a classic and a new release compete fairly
- **Honest verdicts** — if a show scores 5.8, we won't pretend it's great
- **Drop-off analysis** — see where viewers stop watching a show before you start

## How We Pick Content

Data comes from open movie databases and is updated regularly. Random videos, fan projects, and questionable releases don't make it in — only proper movies and TV shows. The catalog is governed by a versioned policy engine, not manual curation or hardcoded lists.

## Principles

- **Ukrainian first** — default language, built for Ukrainian-speaking audiences
- **Clarity over engagement** — designed to be useful, not addictive
- **Legal sources only** — streaming links point to legitimate platforms
- **Less noise, more signal** — every screen element earns its place
- **Honesty before hype** — the verdict engine doesn't sugarcoat bad ratings

## Status

Actively developed. The catalog is steadily growing, new features are being added, and data quality is continuously improving.

---

## Under the Hood

For those who care about how the sausage is made.

### Architecture

Turborepo monorepo. Clean Architecture with four layers per module (Presentation → Application → Domain → Infrastructure). Domain layer has zero framework dependencies — pure functions, pure logic.

```
ratingo/
├── apps/
│   ├── api/             NestJS + Fastify + Drizzle ORM + PostgreSQL
│   └── web-client/      Next.js 16 + React 19 + TanStack Query
├── packages/
│   └── api-contract/    Shared OpenAPI types (auto-generated)
```

### Three Core Engines

| Engine | What it does |
|--------|-------------|
| **Policy Engine** | Pure-function rules that decide what enters the catalog — country/language filters, content classification, breakout rules for exceptions |
| **Score Calculator** | Computes the Ratingo Score from multiple rating sources with normalization, confidence gates, and freshness decay |
| **Verdict Engine** | Generates user-facing recommendations — "honesty before hype" is the design DNA |

Background processing runs on **BullMQ** with Redis — trending sync, stats enrichment, policy evaluation, drop-off analysis. All jobs are idempotent.

### Tech Stack

| Layer | Tech |
|-------|------|
| Backend | NestJS, Fastify, Drizzle ORM, BullMQ |
| Frontend | Next.js 16, React 19, TanStack Query, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL 16, Redis |
| Data sources | TMDB, Trakt, OMDb, TVMaze |
| Infra | Turborepo, Docker, GitHub Actions, Vercel |
| Quality | Jest (3 190+ tests), ESLint, Prettier, Commitlint |

### Getting Started

```bash
git clone https://github.com/eurusik/ratingo.git
cd ratingo && npm install

docker-compose up -d                          # PostgreSQL + Redis
cd apps/api && npm run db:migrate && cd ../..  # apply migrations

npm run dev:api      # localhost:3001
npm run dev:client   # localhost:3002
```

<details>
<summary>More commands</summary>

```bash
npm run build:all          # Build everything (Turborepo)
npm run test:api           # Run backend tests (3 190+)
npm run lint:api           # Lint backend
npm run contracts:update   # Regenerate OpenAPI types after API changes
```

</details>

---

## Feedback

Something broken? Missing a feature? Have an idea? — [open an issue](https://github.com/eurusik/ratingo/issues). Feedback directly shapes what gets built next.

If Ratingo feels useful — a star on the repo or a recommendation to a friend goes a long way.

## License

All rights reserved.
