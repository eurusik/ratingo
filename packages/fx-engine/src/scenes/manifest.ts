import type { FxEvent, FxPayloadSchema, FxSceneManifest } from '../types';

export function defineSceneManifest<TPayload extends FxEvent>(
  manifest: FxSceneManifest<TPayload>,
): FxSceneManifest<TPayload> {
  return manifest;
}

export function definePayloadSchema<TPayload extends FxEvent>(
  schema: FxPayloadSchema<TPayload>,
): FxPayloadSchema<TPayload> {
  return schema;
}
