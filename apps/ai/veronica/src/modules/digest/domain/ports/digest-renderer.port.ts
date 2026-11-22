import type { DigestBlock } from '../constants/digest-block.constants';
import type { Digest, DigestText, RenderedMessage } from '../entities/digest';

export interface DigestRenderInput {
  digest: Digest;
  text: DigestText | null;
  modelCostUsd: number | null;
}

export interface DigestRendererPort {
  render(input: DigestRenderInput): RenderedMessage;
  renderStatus(digest: Digest): RenderedMessage;
  renderBlocks(digest: Digest, blocks: readonly DigestBlock[]): RenderedMessage;
}

export const DIGEST_RENDERER_PORT = Symbol('DIGEST_RENDERER_PORT');
