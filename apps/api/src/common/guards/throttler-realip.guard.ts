import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
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

/**
 * Custom ThrottlerGuard that:
 * 1. Extracts real client IP from Cloudflare/proxy headers
 * 2. Adds rate limit headers and detailed logging on 429
 *
 * Note: Method-based tier selection (GET→default, mutations→strict) is handled
 * via skipIf in ThrottlerModule config. Explicit @Throttle() decorators override this.
 */
@Injectable()
export class ThrottlerRealIpGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ThrottlerRealIpGuard.name);

  protected getTracker(req: Record<string, any>): Promise<string> {
    const fastifyReq = req as FastifyRequest;
    return Promise.resolve(extractRealIp(fastifyReq));
  }

  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = extractRealIp(req);
    return `${name}:${ip}:${suffix}`;
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
