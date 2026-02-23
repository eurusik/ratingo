# Auth Module

The **Auth Module** handles all authentication and authorization in Ratingo: local email/password registration, multi-provider OAuth (Google, Facebook), token management, account linking/unlinking, and password changes.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Module Structure](#module-structure)
- [Data Flows](#data-flows)
- [Endpoints](#endpoints)
- [Testing](#testing)
- [Integration Points](#integration-points)

## Overview

### Responsibilities

- **Registration & Login** — Email/password with bcrypt hashing and password policy enforcement
- **Multi-Provider OAuth** — Google and Facebook login with auto-linking by email
- **Token Management** — JWT access tokens + rotated refresh tokens with reuse detection
- **Account Linking** — Attach/detach OAuth providers from settings page
- **Exchange Codes** — One-time HMAC codes for secure OAuth-to-client token handoff
- **CSRF Protection** — Signed state cookies (HMAC-SHA256) for OAuth flows

### Key Features

- **Conditional providers** — Google/Facebook strategies only instantiated if configured (prevents Passport errors at startup)
- **Token rotation** — Each refresh invalidates the previous token
- **Reuse detection** — Hash-based comparison catches stolen refresh tokens
- **Last auth method protection** — Cannot unlink last OAuth provider if no password set
- **Auto-linking** — OAuth login auto-links to existing user by email match
- **Username generation** — Deterministic from profile name with collision handling

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                      │
│                                                            │
│  AuthController (16 endpoints)                             │
│                                                            │
│  DTOs (11)  │  Filters  │  Mappers  │  Validators          │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                    APPLICATION LAYER                       │
│                                                            │
│  AuthService:                                              │
│  • register / login / refresh / logout                     │
│  • loginWithOAuth / linkOAuth / unlinkOAuth                │
│  • changePassword / generateExchangeCode                   │
│  • exchangeCodeForTokens                                   │
│                                                            │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                      DOMAIN LAYER                          │
│                                                            │
│  Entities:         Repositories (interfaces):              │
│  • OAuthAccount    • IRefreshTokensRepository              │
│  • RefreshToken    • IOAuthAccountsRepository              │
│                    • IExchangeCodesRepository              │
│                                                            │
│  Services:         Types │ Constants                       │
│  • PasswordHasher                                          │
│                                                            │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│                   INFRASTRUCTURE LAYER                     │
│                                                            │
│  Strategies:          Guards:                              │
│  • JwtStrategy        • JwtAuthGuard                       │
│  • LocalStrategy      • LocalAuthGuard                     │
│  • GoogleStrategy     • AdminJwtGuard                      │
│  • FacebookStrategy   • OptionalJwtAuthGuard               │
│                       • GoogleAuthGuard (BaseOAuth)        │
│  Repositories:        • FacebookAuthGuard (BaseOAuth)      │
│  • DrizzleRefreshTokens                                    │
│  • DrizzleOAuthAccounts  Adapters:                         │
│  • DrizzleExchangeCodes  • BcryptPasswordHasher            │
│                                                            │
│  Jobs:                                                     │
│  • CleanupExchangeCodesJob (scheduled)                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Core Concepts

### OAuth State Machine

OAuth flows use a signed cookie-based state machine to prevent CSRF attacks:

```
1. User clicks "Sign in with Google"
2. Guard generates state: { nonce, returnTo, provider, exp, mode }
3. State signed with HMAC-SHA256, stored in httpOnly cookie
4. User redirected to provider
5. Callback: guard reads cookie, verifies signature + expiry
6. On success: generate exchange code, redirect to frontend
7. Frontend exchanges code for JWT tokens (POST /auth/oauth/exchange)
```

State also supports **link mode** (`mode: 'link'`, `linkUserId`) for attaching providers to existing accounts.

### Token Lifecycle

```
Register/Login → { accessToken (15m), refreshToken (7d) }
                        │                    │
                   API calls            POST /auth/refresh
                                             │
                                    Revoke old token
                                    Issue new pair
                                             │
                                    Reuse detection:
                                    if old token reused → revoke ALL
```

Refresh tokens are stored as bcrypt hashes — even a DB leak doesn't expose valid tokens.

### Exchange Code Pattern

OAuth callbacks can't return JWTs directly (browser redirect). Instead:

```
OAuth callback → Generate one-time code (HMAC-SHA256, 60s TTL)
              → Redirect to frontend: /auth/callback?code=abc&provider=google
              → Frontend POSTs code to /auth/oauth/exchange
              → Server atomically consumes code, returns JWT pair
```

Atomic `UPDATE...RETURNING` prevents double-use race conditions.

### Account Linking

Authenticated users can link OAuth providers from settings:

```
Settings page → GET /auth/link/google?token=<jwt>&returnTo=/settings
             → OAuth flow with mode='link'
             → Callback: linkOAuthAccount(userId, oauthPayload)
             → Redirect to /settings?linked=google (or ?linkError=ALREADY_LINKED)
```

**Safety rules:**
- Cannot link provider already linked to another user (`ConflictException`)
- Cannot link provider already linked to this user (`ConflictException`)
- Cannot unlink last auth method if no password set (`ForbiddenException`)

### Username Generation

OAuth users get auto-generated usernames:

```
Profile name → normalize (ASCII, lowercase, underscores)
            → check DB uniqueness
            → collision? append random suffix
            → empty? use email prefix
            → still empty? random fallback: "user_<random>"
```

## Module Structure

```
auth/
├── presentation/                # HTTP layer
│   ├── controllers/             # AuthController (16 endpoints)
│   ├── dto/                     # 11 DTOs (login, register, tokens, me, OAuth, etc.)
│   ├── filters/                 # OAuthExceptionFilter (redirect vs JSON errors)
│   ├── mappers/                 # MeMapper (User entity → MeDto)
│   └── validators/              # PASSWORD_REGEX, PASSWORD_MESSAGE
│
├── application/                 # Business logic orchestration
│   └── auth.service.ts          # 14 methods (register, OAuth, tokens, link/unlink)
│
├── domain/                      # Pure business logic (zero Nest/Drizzle deps)
│   ├── entities/                # OAuthAccount, RefreshToken
│   ├── repositories/            # 3 repository interfaces
│   ├── services/                # PasswordHasher interface
│   └── types/                   # AuthTokens, JwtPayload, OAuthUserPayload, OAuthStatePayload
│
├── infrastructure/              # External integrations
│   ├── adapters/                # BcryptPasswordHasher
│   ├── decorators/              # @CurrentUser() param decorator
│   ├── guards/                  # 6 guards (JWT, Local, Admin, Optional, Google, Facebook)
│   ├── jobs/                    # CleanupExchangeCodesJob (scheduled)
│   ├── repositories/            # 3 Drizzle ORM implementations
│   ├── strategies/              # 4 Passport strategies (JWT, Local, Google, Facebook)
│   └── types/                   # Infrastructure-specific OAuth types
│
├── auth.module.ts               # NestJS module wiring
└── auth.constants.ts            # OAuth URLs, scopes, error codes, TTLs
```

## Data Flows

### Email/Password Login

```
POST /auth/login { email, password }

1. LocalAuthGuard → LocalStrategy.validate()
   → Find user by email
   → PasswordHasher.compare(password, hash)
   → Attach user to request

2. AuthService.loginValidatedUser(user, clientMeta)
   → Issue JWT access token (15m)
   → Issue refresh token (7d), store hash in DB
   → Return { accessToken, refreshToken }
```

### OAuth Login (Google)

```
GET /auth/google

1. GoogleAuthGuard.canActivate()
   → Generate state: { nonce, returnTo, provider: 'google', mode: 'login' }
   → Sign state (HMAC-SHA256)
   → Set state cookie (httpOnly, signed)
   → Redirect to Google OAuth URL

--- User authenticates at Google ---

GET /auth/google/callback?code=xxx&state=yyy

2. GoogleAuthGuard.canActivate()
   → Read state cookie, verify signature + expiry
   → Passport exchanges code for profile
   → GoogleStrategy.validate() → OAuthUserPayload

3. AuthController.handleOAuthCallback()
   → AuthService.loginWithOAuth(payload)
     ├─ Find by provider+accountId → existing user
     ├─ Find by email → auto-link provider to existing user
     └─ Not found → create new user + link provider

4. AuthService.generateExchangeCode(userId)
   → HMAC-SHA256 code, 60s TTL, stored in DB

5. Redirect → /auth/callback/google?code=abc

--- Frontend ---

6. POST /auth/oauth/exchange { code }
   → AuthService.exchangeCodeForTokens(code, clientMeta)
   → Atomic consume (UPDATE...RETURNING)
   → Return { accessToken, refreshToken }
```

### Account Linking

```
GET /auth/link/google?token=<jwt>&returnTo=/settings

1. Controller verifies JWT from query param
2. GoogleAuthGuard.buildSignedStateForLink(userId, returnTo)
3. Set state cookie, redirect to Google

--- User authenticates ---

GET /auth/google/callback?code=xxx&state=yyy

4. Guard validates state → mode='link', linkUserId set
5. AuthService.linkOAuthAccount(userId, oauthPayload)
   → Check: provider not linked to another user
   → Check: user doesn't already have this provider
   → Create oauth_accounts record

6. Redirect → /settings?linked=google
   (or ?linkError=ALREADY_LINKED on conflict)
```

### Account Unlinking

```
DELETE /auth/providers/google   (JwtAuthGuard)

1. AuthService.unlinkOAuthAccount(userId, 'google')
   → Check: user has password OR multiple OAuth providers
   → Delete oauth_accounts record
   → Return 204 No Content

Error case: last auth method
   → 403 Forbidden: "Cannot remove last authentication method"
```

## Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | - | Register (rate limited) |
| `POST` | `/auth/login` | LocalAuthGuard | Login with email/password |
| `POST` | `/auth/refresh` | - | Rotate refresh token |
| `POST` | `/auth/logout` | JwtAuthGuard | Revoke all refresh tokens |
| `PATCH` | `/auth/password` | JwtAuthGuard | Change password |
| `GET` | `/auth/me` | JwtAuthGuard | Current user profile + stats |

### OAuth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/google` | GoogleAuthGuard | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | GoogleAuthGuard | Google callback |
| `GET` | `/auth/facebook` | FacebookAuthGuard | Initiate Facebook OAuth |
| `GET` | `/auth/facebook/callback` | FacebookAuthGuard | Facebook callback |
| `POST` | `/auth/oauth/exchange` | - | Exchange one-time code for tokens |
| `GET` | `/auth/config` | - | Enabled OAuth providers |

### Account Linking

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/link/google` | Token in query | Link Google to existing account |
| `GET` | `/auth/link/facebook` | Token in query | Link Facebook to existing account |
| `GET` | `/auth/providers` | JwtAuthGuard | List linked OAuth accounts |
| `DELETE` | `/auth/providers/:provider` | JwtAuthGuard | Unlink provider (204) |

## Testing

```bash
# Run all auth tests
npm test -- src/modules/auth

# Run specific layer
npm test -- src/modules/auth/domain
npm test -- src/modules/auth/application
npm test -- src/modules/auth/infrastructure
npm test -- src/modules/auth/presentation
```

### Test Coverage

| Layer | Test Files | Focus |
|-------|-----------|-------|
| Application | `auth.service.spec.ts` + 3 property specs | Service orchestration, OAuth flows, token rotation, username generation |
| Infrastructure | `*-repository.spec.ts`, `*-guard.spec.ts`, `*-strategy.spec.ts`, `*-hasher.spec.ts` | DB operations, CSRF validation, Passport integration, bcrypt |
| Presentation | `auth.controller.spec.ts`, `*-filter.spec.ts`, `*-mapper.spec.ts`, `*-dto.spec.ts` | Endpoints, error redirects, DTO mapping, password validation |

### Key Test Patterns

- **Property-based tests** — JWT expiry edge cases, exchange code entropy, username normalization (fast-check)
- **Token reuse detection** — Verifies revocation cascade on refresh token reuse
- **OAuth state tampering** — Modified nonce, expired state, wrong signature → rejected
- **Last auth method** — Cannot unlink when it's the only way to log in
- **Conditional providers** — Tests pass even when Google/Facebook is disabled

## Integration Points

### With Other Modules

| Module | Direction | Integration |
|--------|-----------|-------------|
| `users` | auth → users | User CRUD (find by email, create, update profile) |
| `user-media` | auth → user-media | Stats for MeDto (movies rated, watchlist count) |
| `catalog` | catalog → auth | `OptionalJwtAuthGuard` for enriched responses |
| `home` | home → auth | `OptionalJwtAuthGuard` for personalized homepage |

### Exported Providers

Other modules import from `AuthModule`:

| Export | Consumer |
|--------|----------|
| `AuthService` | - |
| `PASSWORD_HASHER` | Users module (password validation) |
| `REFRESH_TOKENS_REPOSITORY` | - |
| `EXCHANGE_CODES_REPOSITORY` | - |

### Guards (Available globally via `AuthModule` import)

| Guard | Usage |
|-------|-------|
| `JwtAuthGuard` | Protected endpoints |
| `OptionalJwtAuthGuard` | Optional enrichment (catalog, home) |
| `AdminJwtGuard` | Admin-only endpoints |
| `LocalAuthGuard` | Login endpoint |

## Constraints

- **Domain purity** — Zero Nest/Drizzle imports in `domain/` layer
- **Conditional strategies** — Google/Facebook providers are `null` if not configured (provider key filtering in module)
- **CSRF via cookies** — OAuth state in signed httpOnly cookies, not Passport's built-in (incompatible with Fastify)
- **Token in query for linking** — JWT passed as query param because `localStorage` tokens can't be sent via browser navigation; mitigated by short TTL + HTTPS
- **Exchange code atomicity** — Single `UPDATE...RETURNING` prevents race conditions on code consumption
- **Password policy** — Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number (enforced by `PASSWORD_REGEX`)
