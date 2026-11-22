module.exports = {
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  schemaFilter: ['ai'],
  migrations: { schema: 'ai', table: '__drizzle_migrations' },
  dbCredentials: { url: process.env.DATABASE_URL },
};
