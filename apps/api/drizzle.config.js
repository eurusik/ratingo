/** @type {import('drizzle-kit').Config} */
module.exports = {
  dialect: 'postgresql',
  out: './drizzle_v2',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
