export const POST_TYPE_VALUES = ['update', 'explanation', 'fix', 'roadmap'] as const;

export type PostType = (typeof POST_TYPE_VALUES)[number];

export function isValidPostType(value: unknown): value is PostType {
  return typeof value === 'string' && POST_TYPE_VALUES.includes(value as PostType);
}
