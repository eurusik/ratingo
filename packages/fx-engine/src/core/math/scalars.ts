export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function impactSpike(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  const mid = (start + end) * 0.5;
  if (t <= mid) return (t - start) / Math.max(0.0001, mid - start);
  return (end - t) / Math.max(0.0001, end - mid);
}

export function hash01(seed: number): number {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}
