import type { FxAudioService, FxMode, FxRarity } from './types';

const RARITY_PROFILE: Record<FxRarity, { base: number; peak: number; gain: number }> = {
  common: { base: 180, peak: 260, gain: 0.05 },
  rare: { base: 210, peak: 340, gain: 0.065 },
  epic: { base: 240, peak: 420, gain: 0.08 },
  legendary: { base: 260, peak: 480, gain: 0.09 },
};

export class WebAudioFxService implements FxAudioService {
  private audioContext: AudioContext | null = null;
  private unlocked = false;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.audioContext) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.audioContext = new Ctx();
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    this.unlocked = true;
  }

  playSting(rarity: FxRarity, mode: FxMode): void {
    if (mode === 'off') return;
    this.unlock();
    if (!this.audioContext || !this.unlocked) return;

    const profile = RARITY_PROFILE[rarity];
    const gainValue = mode === 'lite' ? profile.gain * 0.7 : profile.gain;
    const startAt = this.audioContext.currentTime + 0.005;
    const duration = mode === 'lite' ? 0.22 : 0.34;

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(profile.base, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(profile.peak, startAt + duration * 0.5);
    oscillator.frequency.exponentialRampToValueAtTime(profile.base * 0.88, startAt + duration);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  dispose(): void {
    if (!this.audioContext) return;
    void this.audioContext.close();
    this.audioContext = null;
    this.unlocked = false;
  }
}
