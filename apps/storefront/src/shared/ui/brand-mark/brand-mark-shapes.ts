export const BRAND_MARK_VIEW_BOX = '0 0 100 100';

export const BRAND_MARK_SHAPES = {
  leg: { d: 'M46 52C56 52 61 54 65 60L78 79H63L53 64C51 61 49 60 46 60Z', strokeWidth: 6 },
  body: { d: 'M30 22H55C69 22 77 31 77 41C77 51 69 58 57 58H45V78H30Z', strokeWidth: 8 },
  cutout: { d: 'M44 30.5L63 41L44 51.5Z', strokeWidth: 6 },
} as const;

export type BrandMarkShape = keyof typeof BRAND_MARK_SHAPES;

export const BRAND_MARK_COLORS = {
  body: '#0485f7',
  leg: '#0359a8',
} as const;
