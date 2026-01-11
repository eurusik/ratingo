import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';

import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SLOW_REQUEST_THRESHOLD_MS = 500;

/**
 * Logs requests that exceed the slow threshold.
 * Includes method, URL, duration, status, and requestId for correlation.
 */
@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;

        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          const requestId = req.id || 'unknown';
          const ua = req.headers['user-agent'] || '-';

          this.logger.warn(
            `${req.method} ${req.url} ${duration}ms status=${res.statusCode} requestId=${requestId} ua=${ua}`,
          );
        }
      }),
    );
  }
}
