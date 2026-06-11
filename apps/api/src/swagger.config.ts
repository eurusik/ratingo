import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Shared Swagger/OpenAPI metadata used by both the runtime docs endpoint
 * (main.ts) and the offline contract generator (scripts/generate-openapi.ts).
 *
 * Tag taxonomy: Auth → Public (no auth) → Me (Bearer JWT) → Admin (admin role).
 * Tags render in registration order, so keep this list grouped by audience.
 */
export const buildSwaggerConfig = (): Omit<OpenAPIObject, 'paths'> =>
  new DocumentBuilder()
    .setTitle('Ratingo API')
    .setDescription(
      'REST API for Ratingo mobile and web clients.\n\n' +
        'Endpoints are grouped by audience: **Public** (no auth), ' +
        '**Me** (authenticated user, Bearer JWT), **Admin** (admin role required).\n\n' +
        'All responses are wrapped: `{ success: true, data }` on success, ' +
        '`{ success: false, error: { code, message } }` on failure.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('Auth', 'Registration, login, OAuth, token refresh')
    .addTag('Public: Catalog', 'Movies, shows, search, providers, sitemap')
    .addTag('Public: Home', 'Homepage sections')
    .addTag('Public: Users', 'Public user profiles')
    .addTag('Public: Reviews', 'Reviews for a title')
    .addTag('Public: Journal', 'Editorial posts')
    .addTag('Public: Stats', 'Watchers and drop-off stats for a title')
    .addTag('Public: Insights', 'Trends and movements')
    .addTag('Me: Profile', 'Own profile and avatar')
    .addTag('Me: Library', 'Watch states and ratings')
    .addTag('Me: Lists', 'Watchlist, history, favorites')
    .addTag('Me: Episode Progress', 'Per-episode watch progress')
    .addTag('Me: Reviews', 'Own reviews')
    .addTag('Me: Subscriptions', 'Show subscriptions and triggers')
    .addTag('Me: Saved Items', 'Saved items')
    .addTag('Me: Notifications', 'Notification feed')
    .addTag('Admin: Journal', 'Editorial post management')
    .addTag('Admin: Reviews', 'Review moderation')
    .addTag('Admin: Providers', 'Watch-provider mappings')
    .addTag('Admin: Policy', 'Catalog policy configuration and dry-runs')
    .addTag('Admin: Ingestion', 'Sync and backfill jobs')
    .addTag('Admin: Stats', 'Stats sync, recalculation, backfills')
    .build();
