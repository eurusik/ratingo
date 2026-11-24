export const ModelErrorCategory = {
  TRANSPORT: 'transport',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  CLIENT: 'client',
  PROTOCOL: 'protocol',
} as const;
export type ModelErrorCategory = (typeof ModelErrorCategory)[keyof typeof ModelErrorCategory];

export class ModelError extends Error {
  constructor(
    readonly category: ModelErrorCategory,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

const FALLBACK_ELIGIBLE_CATEGORIES: readonly ModelErrorCategory[] = [
  ModelErrorCategory.TRANSPORT,
  ModelErrorCategory.RATE_LIMIT,
  ModelErrorCategory.SERVER,
];

export function isFallbackEligible(error: unknown): boolean {
  return error instanceof ModelError && FALLBACK_ELIGIBLE_CATEGORIES.includes(error.category);
}
