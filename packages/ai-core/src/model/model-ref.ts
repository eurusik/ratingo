export interface ModelRef {
  provider: string;
  model: string;
}

export type ModelAliases = Readonly<Record<string, readonly string[]>>;

const MODEL_REF_SEPARATOR = ':';

export class InvalidModelRefError extends Error {
  constructor(value: string) {
    super(`Invalid model reference "${value}", expected "provider:model"`);
    this.name = 'InvalidModelRefError';
  }
}

export class EmptyModelAliasError extends Error {
  constructor(alias: string) {
    super(`Model alias "${alias}" has no models configured`);
    this.name = 'EmptyModelAliasError';
  }
}

export class UnknownModelAliasError extends Error {
  constructor(alias: string) {
    super(`Unknown model alias "${alias}"`);
    this.name = 'UnknownModelAliasError';
  }
}

export function parseModelRef(value: string): ModelRef {
  const separatorIndex = value.indexOf(MODEL_REF_SEPARATOR);
  if (separatorIndex <= 0) {
    throw new InvalidModelRefError(value);
  }
  const provider = value.slice(0, separatorIndex).trim();
  const model = value.slice(separatorIndex + 1).trim();
  if (provider === '' || model === '') {
    throw new InvalidModelRefError(value);
  }
  return { provider, model };
}

export function formatModelRef(ref: ModelRef): string {
  return `${ref.provider}${MODEL_REF_SEPARATOR}${ref.model}`;
}

export function resolveModelChain(aliasOrRef: string, aliases: ModelAliases): ModelRef[] {
  const configured = Object.hasOwn(aliases, aliasOrRef) ? aliases[aliasOrRef] : undefined;
  if (configured !== undefined) {
    if (configured.length === 0) {
      throw new EmptyModelAliasError(aliasOrRef);
    }
    return configured.map(parseModelRef);
  }
  if (aliasOrRef.includes(MODEL_REF_SEPARATOR)) {
    return [parseModelRef(aliasOrRef)];
  }
  throw new UnknownModelAliasError(aliasOrRef);
}
