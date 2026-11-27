import { findViolations, ViolationKind, type ReadableColumn } from './explorer-access.guard';
import {
  ALLOWED_DEFINER_VIEWS,
  ALLOWED_FREE_FORM_COLUMNS,
  ALLOWED_MATERIALIZED_VIEWS,
  ALLOWED_SENSITIVE_COLUMNS,
  ALLOWED_SENSITIVE_TABLE_NAMES,
} from './explorer-access.rules';

const column = (
  table: string,
  name: string,
  extra: Partial<ReadableColumn> = {},
): ReadableColumn => ({
  schema: 'public',
  table,
  column: name,
  kind: 'r',
  options: '',
  typeName: 'uuid',
  typeCategory: 'U',
  ...extra,
});

const textColumn = (table: string, name: string): ReadableColumn =>
  column(table, name, { typeName: 'text', typeCategory: 'S' });

const everyAllowListEntryInUse: ReadableColumn[] = [
  ...ALLOWED_SENSITIVE_TABLE_NAMES.map((entry) => column(entry.table, 'id')),
  ...ALLOWED_SENSITIVE_COLUMNS.map((entry) => textColumn(entry.table, entry.column)),
  ...ALLOWED_FREE_FORM_COLUMNS.flatMap((entry) =>
    entry.columns.map((name) => textColumn(entry.table, name)),
  ),
  ...ALLOWED_DEFINER_VIEWS.map((entry) => column(entry.table, 'id', { kind: 'v' })),
  ...ALLOWED_MATERIALIZED_VIEWS.map((entry) => column(entry.table, 'id', { kind: 'm' })),
];

const allowListEntryCount =
  ALLOWED_SENSITIVE_TABLE_NAMES.length +
  ALLOWED_SENSITIVE_COLUMNS.length +
  ALLOWED_FREE_FORM_COLUMNS.reduce((total, entry) => total + entry.columns.length, 0) +
  ALLOWED_DEFINER_VIEWS.length +
  ALLOWED_MATERIALIZED_VIEWS.length;

const kindsOf = (
  readable: ReadableColumn[],
  extra: { functions?: Parameters<typeof findViolations>[0]['functions'] } = {},
) => {
  const all = [...everyAllowListEntryInUse, ...readable];
  return findViolations({ readable: all, direct: all, ...extra }).map((item) => item.kind);
};

describe('findViolations', () => {
  it('passes when only innocent columns and reviewed exceptions are readable', () => {
    expect(kindsOf([column('genres', 'tmdb_id')])).toEqual([]);
  });

  it('flags a readable column whose name looks sensitive', () => {
    expect(kindsOf([textColumn('directory', 'contact_email')])).toEqual([
      ViolationKind.SENSITIVE_COLUMN_READABLE,
    ]);
  });

  it.each(['message', 'comment', 'note', 'body', 'nickname', 'contact', 'telegram', 'chat_id'])(
    'flags a readable column named %s',
    (name) => {
      expect(kindsOf([textColumn('feedback', name)])).toContain(
        ViolationKind.SENSITIVE_COLUMN_READABLE,
      );
    },
  );

  it('flags a readable table whose name looks sensitive', () => {
    expect(kindsOf([column('user_sessions', 'id')])).toEqual([
      ViolationKind.SENSITIVE_TABLE_READABLE,
    ]);
  });

  it('flags any readable column of a private table', () => {
    expect(kindsOf([column('refresh_tokens', 'id')])).toContain(
      ViolationKind.PRIVATE_TABLE_READABLE,
    );
  });

  it('flags a closed column that became readable', () => {
    expect(kindsOf([textColumn('user_media_state', 'notes')])).toContain(
      ViolationKind.CLOSED_COLUMN_READABLE,
    );
  });

  describe('free-form columns in a table linked to users', () => {
    it('flags text, varchar, json and array columns that nobody reviewed', () => {
      const kinds = kindsOf([
        column('opaque_tickets', 'author_id'),
        column('opaque_tickets', 'topic', { typeName: 'varchar', typeCategory: 'S' }),
        column('opaque_tickets', 'extra', { typeName: 'jsonb', typeCategory: 'U' }),
        column('opaque_tickets', 'labels', { typeName: '_text', typeCategory: 'A' }),
      ]);

      expect(kinds).toEqual([
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
      ]);
    });

    it('leaves a table without a user link alone', () => {
      expect(kindsOf([textColumn('genres', 'name')])).toEqual([]);
    });

    it('recognizes every user-linked column name', () => {
      for (const link of ['user_id', 'reporter_id', 'author_id', 'moderator_id', 'owner_user_id']) {
        expect(kindsOf([column('opaque', link), textColumn('opaque', 'topic')])).toContain(
          ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
        );
      }
    });
  });

  describe('views', () => {
    it('flags a view that runs with its owner rights', () => {
      expect(kindsOf([column('leaky_view', 'id', { kind: 'v' })])).toEqual([
        ViolationKind.VIEW_WITHOUT_SECURITY_INVOKER,
      ]);
    });

    it('accepts a security_invoker view', () => {
      expect(
        kindsOf([column('invoker_view', 'id', { kind: 'v', options: '{security_invoker=true}' })]),
      ).toEqual([]);
    });

    it('flags a materialized view that is not on the allow-list', () => {
      expect(kindsOf([column('leaky_matview', 'id', { kind: 'm' })])).toEqual([
        ViolationKind.MATERIALIZED_VIEW_READABLE,
      ]);
    });
  });

  describe('functions', () => {
    it('flags a security definer function the role can run', () => {
      const kinds = kindsOf([], {
        functions: [
          {
            schema: 'public',
            signature: 'leaky_function()',
            securityDefiner: true,
            systemFunction: false,
          },
        ],
      });

      expect(kinds).toEqual([ViolationKind.SECURITY_DEFINER_FUNCTION_EXECUTABLE]);
    });

    it('flags a dangerous system function the role can run', () => {
      const kinds = kindsOf([], {
        functions: [
          {
            schema: 'pg_catalog',
            signature: 'pg_terminate_backend(integer,bigint)',
            securityDefiner: false,
            systemFunction: true,
          },
        ],
      });

      expect(kinds).toEqual([ViolationKind.DANGEROUS_FUNCTION_EXECUTABLE]);
    });
  });

  it('flags access that does not come from a grant to the role itself', () => {
    const readable = [...everyAllowListEntryInUse, column('genres', 'tmdb_id')];
    const kinds = findViolations({ readable, direct: everyAllowListEntryInUse }).map(
      (item) => item.kind,
    );

    expect(kinds).toEqual([ViolationKind.READABLE_WITHOUT_DIRECT_GRANT]);
  });

  it('flags a table-wide grant on a table that has closed columns', () => {
    const readable = [...everyAllowListEntryInUse, column('genres', 'tmdb_id')];
    const kinds = findViolations({
      readable,
      direct: readable,
      tableGrants: [
        { schema: 'public', table: 'genres' },
        { schema: 'public', table: 'users' },
      ],
    }).map((item) => item.kind);

    expect(kinds).toEqual([ViolationKind.TABLE_GRANT_ON_PROTECTED_TABLE]);
  });

  it('flags every allow-list entry that matches nothing', () => {
    const kinds = findViolations({
      readable: [column('genres', 'tmdb_id')],
      direct: [column('genres', 'tmdb_id')],
    }).map((item) => item.kind);

    expect(kinds).toEqual(Array(allowListEntryCount).fill(ViolationKind.STALE_ALLOW_LIST_ENTRY));
  });
});
