import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';

import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { type ApiSuccessResponse } from '../interfaces/api-response.interface';

/**
 * Global interceptor that wraps successful responses in a standardized format.
 * Transforms: data → { success: true, data }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
      })),
    );
  }
}
