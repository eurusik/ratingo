import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import type { ServiceConfig } from '../../../../config/config.constants';

import { InternalApiGuard } from './internal-api.guard';

const TOKEN = 'a-service-token-of-24-chars!';

const contextWith = (headers: Record<string, string>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const guardFor = (serviceToken: string | undefined): InternalApiGuard =>
  new InternalApiGuard({
    port: 3006,
    maxInvestigationsPerDay: 10,
    ...(serviceToken === undefined ? {} : { serviceToken }),
  } as ServiceConfig);

const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

describe('InternalApiGuard', () => {
  it('lets the right bearer token through', () => {
    expect(guardFor(TOKEN).canActivate(contextWith(bearer(TOKEN)))).toBe(true);
  });

  it.each([
    ['no header', {}],
    ['a wrong token', bearer('wrong')],
    ['another scheme', { authorization: `Basic ${TOKEN}` }],
  ])('rejects %s with 401', (_name, headers) => {
    expect(() => guardFor(TOKEN).canActivate(contextWith(headers))).toThrow(UnauthorizedException);
  });

  it('answers 404 when no token is configured, even to a matching header', () => {
    expect(() => guardFor(undefined).canActivate(contextWith(bearer(TOKEN)))).toThrow(
      NotFoundException,
    );
  });

  it('answers 404 to a request that carries a public proxy header', () => {
    expect(() =>
      guardFor(TOKEN).canActivate(contextWith({ ...bearer(TOKEN), 'x-forwarded-for': '1.2.3.4' })),
    ).toThrow(NotFoundException);
  });
});
