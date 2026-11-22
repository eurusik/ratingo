export interface Measured {
  current: number;
  baseline: number | null;
}

export const measured = (current: number, baseline: number | null = null): Measured => ({
  current,
  baseline,
});
