export const HappyProbe = {
  UP: 'up',
  DOWN: 'down',
  SKIPPED: 'skipped',
} as const;
export type HappyProbe = (typeof HappyProbe)[keyof typeof HappyProbe];
