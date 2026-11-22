import { ROOT_CONTEXT, defaultTextMapGetter } from '@opentelemetry/api';

import { ClientKindPropagator, clientKindOf } from './client-kind-propagator';

const extractFrom = (headers: Record<string, string | string[]>) =>
  clientKindOf(new ClientKindPropagator().extract(ROOT_CONTEXT, headers, defaultTextMapGetter));

describe('ClientKindPropagator', () => {
  it('stores the kind of the user agent in the context', () => {
    expect(extractFrom({ 'user-agent': 'ClaudeBot/1.0' })).toBe('ai_crawler');
    expect(extractFrom({ 'user-agent': 'Googlebot/2.1' })).toBe('bot');
    expect(extractFrom({ 'user-agent': 'Mozilla/5.0 Chrome/130' })).toBe('human');
  });

  it('uses the first value of a repeated header', () => {
    expect(extractFrom({ 'user-agent': ['curl/8.0', 'Mozilla/5.0'] })).toBe('bot');
  });

  it('treats a request without a user agent as human', () => {
    expect(extractFrom({})).toBe('human');
  });

  it('defaults to human when the context was never extracted', () => {
    expect(clientKindOf(ROOT_CONTEXT)).toBe('human');
  });

  it('does not write anything into outgoing carriers', () => {
    const carrier: Record<string, string> = {};
    new ClientKindPropagator().inject(ROOT_CONTEXT, carrier, {
      set: (target: Record<string, string>, key, value) => {
        target[key] = value;
      },
    });

    expect(carrier).toEqual({});
  });
});
