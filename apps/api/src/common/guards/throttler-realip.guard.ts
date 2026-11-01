import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Extracts real client IP from request, handling Cloudflare and proxy chains.
 */
function extractRealIp(req: FastifyRequest): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  // Standard proxy chain
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();

  // Fastify computed IP
  if (req.ip) return req.ip;

  // Fallback to raw socket
  const rawSocket = (req.raw as { socket?: { remoteAddress?: string } })?.socket;
  return rawSocket?.remoteAddress ?? 'unknown';
}

const ONE_MINUTE_MS = 60_000;

/**
 * Names of route-scoped throttler tiers. They are skipped everywhere except on routes that
 * opt in via `@Throttle({ <tier>: { limit, ttl } })`.
 */
export const ROUTE_THROTTLE_TIER = {
  /** Credential endpoints: register, login, OAuth code exchange. */
  AUTH: 'auth',
  /** Refresh-token rotation. */
  REFRESH: 'refresh',
} as const;

/** Metadata key prefix `@Throttle()` uses for a tier's limit (not exported by @nestjs/throttler). */
const THROTTLER_LIMIT_METADATA = 'THROTTLER:LIMIT';

/**
 * Builds a `skipIf` that skips a tier unless the handler (or controller) opted in with
 * `@Throttle({ [tier]: ... })`.
 *
 * Needed because @nestjs/throttler applies a tier's module-level `skipIf` even when a route
 * overrides that tier via `@Throttle()`, so overrides of a skipped tier never take effect.
 */
export function skipUnlessRouteOptsIn(tier: string): (context: ExecutionContext) => boolean {
  const metadataKey = THROTTLER_LIMIT_METADATA + tier;
  return (context) => {
    const optedIn =
      Reflect.getMetadata(metadataKey, context.getHandler()) !== undefined ||
      Reflect.getMetadata(metadataKey, context.getClass()) !== undefined;
    return !optedIn;
  };
}

/**
 * Builds the application throttler tiers.
 *
 * - `default`: reads (GET/HEAD/OPTIONS), shared per IP
 * - `strict`: mutations (POST/PUT/PATCH/DELETE), shared per IP
 * - `auth` / `refresh`: only on routes that opt in with `@Throttle()`, counted per route
 *
 * @param {number} defaultLimit - Requests per minute for the `default` tier
 * @returns {ThrottlerOptions[]} Throttler tier definitions
 */
export function buildThrottlerTiers(defaultLimit: number): ThrottlerOptions[] {
  return [
    {
      name: 'default',
      ttl: ONE_MINUTE_MS,
      limit: defaultLimit, // browsing
      // Skip 'default' tier for mutation methods (they use 'strict')
      skipIf: (context) => {
        const req = context.switchToHttp().getRequest();
        return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      },
    },
    {
      name: 'strict',
      ttl: ONE_MINUTE_MS,
      limit: 120, // 120 req/min - mutations (POST/PATCH/DELETE)
      // Skip 'strict' tier for read methods (they use 'default')
      skipIf: (context) => {
        const req = context.switchToHttp().getRequest();
        return ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      },
    },
    {
      name: ROUTE_THROTTLE_TIER.AUTH,
      ttl: ONE_MINUTE_MS,
      limit: 10, // register/login/oauth exchange
      skipIf: skipUnlessRouteOptsIn(ROUTE_THROTTLE_TIER.AUTH),
    },
    {
      name: ROUTE_THROTTLE_TIER.REFRESH,
      ttl: ONE_MINUTE_MS,
      limit: 30,
      skipIf: skipUnlessRouteOptsIn(ROUTE_THROTTLE_TIER.REFRESH),
    },
  ];
}

const ROUTE_SCOPED_TIERS: ReadonlySet<string> = new Set(Object.values(ROUTE_THROTTLE_TIER));

/**
 * Custom ThrottlerGuard that:
 * 1. Extracts real client IP from Cloudflare/proxy headers
 * 2. Adds rate limit headers and detailed logging on 429
 *
 * Note: Method-based tier selection (GET→default, mutations→strict) is handled
 * via skipIf in ThrottlerModule config (see {@link buildThrottlerTiers}). Auth routes opt
 * in to the dedicated `auth`/`refresh` tiers with `@Throttle({ auth: { limit, ttl } })`.
 */
@Injectable()
export class ThrottlerRealIpGuard extends ThrottlerGuard {
  protected readonly logger = new Logger(ThrottlerRealIpGuard.name);

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const fastifyReq = req as unknown as FastifyRequest;
    return Promise.resolve(extractRealIp(fastifyReq));
  }

  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = extractRealIp(req);
    const key = `${name}:${ip}:${suffix}`;
    // Route-scoped tiers keep a separate counter per route
    if (ROUTE_SCOPED_TIERS.has(name)) {
      return `${key}:${context.getClass().name}.${context.getHandler().name}`;
    }
    return key;
  }

  /**
   * Override to add rate limit headers and detailed logging on 429.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const { limit, timeToExpire, key, tracker } = throttlerLimitDetail;

    // Extract tier name from key (format: "tierName:ip:suffix")
    const tier = key.split(':')[0] || 'unknown';
    const ip = extractRealIp(req);

    // Add debug headers
    response.header('X-RateLimit-Limit', limit.toString());
    response.header('X-RateLimit-Remaining', '0');
    response.header('X-RateLimit-Tier', tier);
    response.header('X-RateLimit-Key', key);
    response.header('Retry-After', Math.ceil(timeToExpire / 1000).toString());

    // Detailed log for debugging
    this.logger.warn(
      `Rate limit exceeded: ${req.method} ${req.url} | tier=${tier} key=${key} ip=${ip} tracker=${tracker} limit=${limit} resetIn=${Math.ceil(timeToExpire / 1000)}s`,
    );

    // Call parent to throw the exception
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
