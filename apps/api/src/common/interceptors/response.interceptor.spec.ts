import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('should wrap data into success response', async () => {
    const interceptor = new ResponseInterceptor();

    const data = { ok: true };
    const next: CallHandler = { handle: () => of(data) };
    const ctx = {} as ExecutionContext;

    const res = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(res).toEqual({ success: true, data });
  });
});
