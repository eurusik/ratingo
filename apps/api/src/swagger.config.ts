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

// ---------------------------------------------------------------------------
// Standard error responses
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

interface OperationLike {
  tags?: string[];
  security?: unknown[];
  parameters?: Array<{ in?: string }>;
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

const ERROR_RESPONSE_SCHEMA_NAME = 'ErrorResponse';

const errorResponseSchema = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message', 'statusCode'],
      properties: {
        code: {
          type: 'string',
          description: 'Machine-readable error code (see ErrorCode enum)',
          example: 'VALIDATION_ERROR',
        },
        message: { type: 'string', example: 'Validation failed' },
        statusCode: { type: 'integer', example: 400 },
        details: {
          type: 'object',
          additionalProperties: true,
          description: 'Optional structured context for the error',
        },
      },
    },
  },
} as const;

const errorContent = {
  content: {
    'application/json': {
      schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
    },
  },
};

const hasAudience = (op: OperationLike, prefix: string): boolean =>
  (op.tags ?? []).some((t) => t === prefix || t.startsWith(`${prefix}:`));

/**
 * Post-processes the OpenAPI document to document the error contract produced
 * by AllExceptionsFilter (`{ success: false, error: { code, message, statusCode } }`).
 *
 * Error responses are derived from the operation shape and the tag taxonomy
 * instead of per-endpoint decorators:
 * - 500 — every operation
 * - 400 — operations that accept input (request body or parameters)
 * - 401 — operations with bearer security or tagged `Me:*` / `Admin:*`
 * - 403 — operations tagged `Admin:*`
 * - 404 — operations with path parameters
 *
 * Explicitly declared responses are never overwritten.
 */
export const applyStandardErrorResponses = (doc: OpenAPIObject): void => {
  doc.components = doc.components ?? {};
  doc.components.schemas = {
    [ERROR_RESPONSE_SCHEMA_NAME]: errorResponseSchema as never,
    ...doc.components.schemas,
  };

  const operations = Object.values(doc.paths ?? {}).flatMap((pathItem) =>
    HTTP_METHODS.map((m) => (pathItem as Record<string, OperationLike | undefined>)[m]).filter(
      (op): op is OperationLike => Boolean(op),
    ),
  );

  for (const op of operations) {
    const responses = (op.responses = op.responses ?? {});
    const addIfMissing = (status: string, description: string) => {
      responses[status] = responses[status] ?? { description, ...errorContent };
    };

    const hasInput = Boolean(op.requestBody) || (op.parameters?.length ?? 0) > 0;
    const hasPathParams = (op.parameters ?? []).some((p) => p.in === 'path');
    const isSecured =
      (op.security?.length ?? 0) > 0 || hasAudience(op, 'Me') || hasAudience(op, 'Admin');

    if (hasInput) addIfMissing('400', 'Validation failed or malformed input');
    if (isSecured) addIfMissing('401', 'Missing or invalid access token');
    if (hasAudience(op, 'Admin')) addIfMissing('403', 'Admin role required');
    if (hasPathParams) addIfMissing('404', 'Resource not found');
    addIfMissing('500', 'Internal server error');
  }
};
