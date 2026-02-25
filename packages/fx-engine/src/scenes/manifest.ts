import type { FxEvent, FxPayloadSchema, FxSceneManifest, FxScenePlayerContext } from '../types';

export function defineSceneManifest<
  TPayload extends FxEvent,
  TContext extends FxScenePlayerContext = FxScenePlayerContext,
>(manifest: FxSceneManifest<TPayload, TContext>): FxSceneManifest<TPayload, TContext> {
  return manifest;
}

export function definePayloadSchema<TPayload extends FxEvent>(
  schema: FxPayloadSchema<TPayload>,
): FxPayloadSchema<TPayload> {
  return schema;
}
