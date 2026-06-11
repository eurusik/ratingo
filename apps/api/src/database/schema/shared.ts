import { customType } from 'drizzle-orm/pg-core';

// Define custom tsvector type since Drizzle ORM core doesn't support it natively yet
export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});
