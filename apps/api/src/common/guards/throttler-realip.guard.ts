import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

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
 * Custom ThrottlerGuard that extracts real client IP from Cloudflare/proxy headers.
 * This ensures rate limiting works correctly behind reverse proxies.
 */
@Injectable()
export class ThrottlerRealIpGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const fastifyReq = req as FastifyRequest;
    return Promise.resolve(extractRealIp(fastifyReq));
  }

  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = extractRealIp(req);
    return `${name}:${ip}:${suffix}`;
  }
}
