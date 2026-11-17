export const MovieReleaseDateKind = {
  THEATRICAL: 'theatrical',
  DIGITAL: 'digital',
} as const;

export type MovieReleaseDateKindType =
  (typeof MovieReleaseDateKind)[keyof typeof MovieReleaseDateKind];
