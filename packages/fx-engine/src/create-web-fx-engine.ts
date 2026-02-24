import { WebAudioFxService } from './audio';
import { FxEngine, type FxEngineConfig } from './engine';
import { PixiFxRenderer } from './pixi-renderer';

export function createWebFxEngine(host: HTMLElement, config: FxEngineConfig = {}): FxEngine {
  const renderer = new PixiFxRenderer(host);
  const audio = new WebAudioFxService();
  return new FxEngine(renderer, audio, config);
}
