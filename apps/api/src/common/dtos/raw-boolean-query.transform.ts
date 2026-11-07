import { Transform, type TransformFnParams } from 'class-transformer';

export function isRawQueryTrue(source: unknown, key: string): boolean {
  if (typeof source !== 'object' || source === null) return false;
  const raw = (source as Record<string, unknown>)[key];
  return raw === 'true' || raw === true;
}

export function TransformRawQueryBoolean(): PropertyDecorator {
  return Transform(({ obj, key }: TransformFnParams) => isRawQueryTrue(obj, key));
}
