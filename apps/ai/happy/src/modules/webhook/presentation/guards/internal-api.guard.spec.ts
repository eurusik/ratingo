import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import type { ReviewConfig } from '../../../../config/config.constants';

import { InternalApiGuard } from './internal-api.guard';

const TOKEN = 'a-service-token-of-24-chars!';

const contextWith = (headers: Record<string, string>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const guardFor = (serviceToken: string | undefined): InternalApiGuard =>
  new InternalApiGuard({
    allowedRepositories: [],
    allowedAuthors: [],
    mentionHandle: 'happy-on-duty',
    serviceToken,
  } as ReviewConfig);

const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

describe('InternalApiGuard', () => {
  it('lets the right bearer token through', () => {
    expect(guardFor(TOKEN).canActivate(contextWith(bearer(TOKEN)))).toBe(true);
  });

  it.each([
    ['no header', {}],
    ['an empty token', { authorization: 'Bearer ' }],
    ['a wrong token', bearer('wrong')],
    ['a longer token', bearer(`${TOKEN}x`)],
    ['another scheme', { authorization: `Basic ${TOKEN}` }],
    ['the old header', { 'x-service-token': TOKEN }],
  ])('rejects %s with 401', (_name, headers) => {
    expect(() => guardFor(TOKEN).canActivate(contextWith(headers))).toThrow(UnauthorizedException);
  });

  it('is disabled with 404 when no token is configured, even for a matching header', () => {
    expect(() => guardFor(undefined).canActivate(contextWith(bearer(TOKEN)))).toThrow(
      NotFoundException,
    );
    expect(() => guardFor(undefined).canActivate(contextWith({}))).toThrow(NotFoundException);
  });

  it.each(['x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'cf-connecting-ip', 'forwarded'])(
    'answers 404 to a request that carries the public proxy header %s',
    (header) => {
      expect(() =>
        guardFor(TOKEN).canActivate(contextWith({ ...bearer(TOKEN), [header]: '1.2.3.4' })),
      ).toThrow(NotFoundException);
    },
  );
});
