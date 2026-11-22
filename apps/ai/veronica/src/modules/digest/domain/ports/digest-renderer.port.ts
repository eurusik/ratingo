import type { Digest, DigestText, RenderedMessage } from '../entities/digest';

export interface DigestRenderInput {
  digest: Digest;
  text: DigestText | null;
  modelCostUsd: number | null;
}

export interface DigestRendererPort {
  render(input: DigestRenderInput): RenderedMessage;
}

export const DIGEST_RENDERER_PORT = Symbol('DIGEST_RENDERER_PORT');
