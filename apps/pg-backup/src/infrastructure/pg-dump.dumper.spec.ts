import { connectionEnv } from './pg-dump.dumper';

describe('connectionEnv', () => {
  it('passes the connection through libpq variables so the password stays out of argv', () => {
    expect(
      connectionEnv('postgresql://postgres:p%40ss@postgres.railway.internal:5432/railway'),
    ).toEqual({
      PGHOST: 'postgres.railway.internal',
      PGPORT: '5432',
      PGUSER: 'postgres',
      PGPASSWORD: 'p@ss',
      PGDATABASE: 'railway',
    });
  });

  it('keeps the sslmode and leaves the default port to libpq', () => {
    expect(connectionEnv('postgres://u:p@db.example.com/app?sslmode=require')).toEqual({
      PGHOST: 'db.example.com',
      PGPORT: undefined,
      PGUSER: 'u',
      PGPASSWORD: 'p',
      PGDATABASE: 'app',
      PGSSLMODE: 'require',
    });
  });
});
