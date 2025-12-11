import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('should wrap data into success response', (done) => {
    const interceptor = new ResponseInterceptor();

    const data = { ok: true };
    const next: CallHandler = { handle: () => of(data) };
    const ctx = {} as ExecutionContext;

    interceptor.intercept(ctx, next).subscribe((res) => {
      expect(res).toEqual({ success: true, data });
      done();
    });
  });
});
