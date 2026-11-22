import {
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
  createContextKey,
} from '@opentelemetry/api';

import { classifyClientKind } from './client-kind';
import { CLIENT_KIND, type ClientKind, USER_AGENT_HEADER } from './constants';

const CLIENT_KIND_CONTEXT_KEY = createContextKey('ratingo.client_kind');

export const clientKindOf = (context: Context): ClientKind =>
  (context.getValue(CLIENT_KIND_CONTEXT_KEY) as ClientKind | undefined) ?? CLIENT_KIND.HUMAN;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export class ClientKindPropagator implements TextMapPropagator {
  inject(_context: Context, _carrier: unknown, _setter: TextMapSetter): void {}

  extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
    const userAgent = firstValue(getter.get(carrier, USER_AGENT_HEADER));
    return context.setValue(CLIENT_KIND_CONTEXT_KEY, classifyClientKind(userAgent));
  }

  fields(): string[] {
    return [];
  }
}
