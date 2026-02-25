export interface FxFrameState {
  elapsedMs: number;
  deltaFrames: number;
  fadeOutT: number;
}

export interface FxPlugin {
  update(frame: FxFrameState): void;
}
