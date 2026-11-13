import { isNotFoundError } from '@ratingo/web-core/api';

export async function orNullWhenNotFound<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (await isNotFoundError(error)) return null;
    throw error;
  }
}
