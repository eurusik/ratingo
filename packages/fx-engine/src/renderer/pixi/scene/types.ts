import type { Container, Graphics, Text } from 'pixi.js';

export interface BackdropLayers {
  focusVeil: Graphics;
  tint: Graphics;
  vignette: Graphics;
  scanline: Graphics;
  noiseDots: Graphics;
  flash: Graphics;
  glitchBands: Graphics;
  interferenceStrips: Graphics;
  signalStatic: Graphics;
  cutPulse: Graphics;
  smokeContainer: Container;
  shockwave?: Graphics;
  shockwave2?: Graphics;
  aura?: Graphics;
}

export interface AchievementCardNodes {
  medalRoot: Container;
  coldShadow: Graphics;
  keyLight: Graphics;
  glowSweep: Graphics;
  ribbonWidth: number;
  effectWidth: number;
  effectHeight: number;
  labelBaseY: number;
  titleBaseY: number;
  subtitleBaseY: number;
  label: Text;
  titleGlow: Text;
  title: Text;
  subtitleGlow: Text;
  subtitle: Text;
  titleGhostR: Text;
  titleGhostC: Text;
  labelGhostR: Text;
  labelGhostC: Text;
}
