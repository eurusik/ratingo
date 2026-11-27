import {
  findViolations,
  tableKey,
  ViolationKind,
  type ExplorerGrants,
  type PgType,
  type ReadableColumn,
} from './explorer-access.guard';
import {
  ALLOWED_DEFINER_VIEWS,
  ALLOWED_FREE_FORM_COLUMNS,
  ALLOWED_MATERIALIZED_VIEWS,
  ALLOWED_SENSITIVE_COLUMNS,
  ALLOWED_SENSITIVE_TABLE_NAMES,
  CLOSED_COLUMNS,
  PRIVATE_TABLES,
} from './explorer-access.rules';

const Oid = {
  UUID: 1,
  TEXT: 2,
  VARCHAR: 3,
  JSONB: 4,
  INT4: 5,
  TEXT_ARRAY: 6,
  STATUS: 7,
  SHORT_TEXT: 8,
  TSVECTOR: 9,
  FAKE_INTERVAL: 10,
};

const type = (oid: number, name: string, extra: Partial<PgType> = {}): PgType => ({
  oid,
  name,
  kind: 'b',
  baseOid: 0,
  elementOid: 0,
  category: 'U',
  system: true,
  ...extra,
});

const TYPES: PgType[] = [
  type(Oid.UUID, 'uuid'),
  type(Oid.TEXT, 'text', { category: 'S' }),
  type(Oid.VARCHAR, 'varchar', { category: 'S' }),
  type(Oid.JSONB, 'jsonb'),
  type(Oid.INT4, 'int4', { category: 'N' }),
  type(Oid.TEXT_ARRAY, '_text', { category: 'A', elementOid: Oid.TEXT }),
  type(Oid.STATUS, 'status', { kind: 'e', category: 'E', system: false }),
  type(Oid.SHORT_TEXT, 'short_text', {
    kind: 'd',
    category: 'S',
    baseOid: Oid.TEXT,
    system: false,
  }),
  type(Oid.FAKE_INTERVAL, 'interval', { category: 'T', system: false }),
  type(Oid.TSVECTOR, 'tsvector'),
];

const column = (
  qualifiedTable: string,
  name: string,
  extra: Partial<ReadableColumn> = {},
): ReadableColumn => {
  const [schema = 'public', table = ''] = qualifiedTable.includes('.')
    ? qualifiedTable.split('.')
    : ['public', qualifiedTable];
  return { schema, table, column: name, kind: 'r', options: '', typeOid: Oid.UUID, ...extra };
};

const textColumn = (table: string, name: string): ReadableColumn =>
  column(table, name, { typeOid: Oid.TEXT });

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

const kindsOf = (readable: ReadableColumn[], extra: Partial<ExplorerGrants> = {}) => {
  const all = [...everyAllowListEntryInUse, ...readable];
  return findViolations({ readable: all, direct: all, types: TYPES, ...extra }).map(
    (item) => item.kind,
  );
};

describe('findViolations', () => {
  it('passes when only innocent columns and reviewed exceptions are readable', () => {
    expect(kindsOf([column('genres', 'tmdb_id', { typeOid: Oid.INT4 })])).toEqual([]);
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

  it('does not confuse a table of the same name in another schema with a protected one', () => {
    expect(kindsOf([column('other.refresh_tokens', 'id')])).not.toContain(
      ViolationKind.PRIVATE_TABLE_READABLE,
    );
  });

  describe('free-form columns in a table linked to users', () => {
    const unreviewed = (type: number, name = 'extra') => [
      column('opaque_tickets', 'author_id'),
      column('opaque_tickets', name, { typeOid: type }),
    ];

    it.each([
      ['text', Oid.TEXT],
      ['varchar', Oid.VARCHAR],
      ['jsonb', Oid.JSONB],
      ['an array of text', Oid.TEXT_ARRAY],
      ['a domain over text', Oid.SHORT_TEXT],
      ['tsvector', Oid.TSVECTOR],
    ])('flags %s that nobody reviewed', (_label, type) => {
      expect(kindsOf(unreviewed(type))).toEqual([ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE]);
    });

    it.each([
      ['an integer', Oid.INT4],
      ['an enum', Oid.STATUS],
      ['a uuid', Oid.UUID],
    ])('leaves %s alone', (_label, type) => {
      expect(kindsOf(unreviewed(type))).toEqual([]);
    });

    it('does not trust a user type that borrows the name of a system type', () => {
      expect(kindsOf(unreviewed(Oid.FAKE_INTERVAL))).toEqual([
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
      ]);
    });

    it.each([
      'uid',
      'creator_id',
      'submitted_by',
      'approved_by',
      'sender',
      'recipient_id',
      'assignee',
      'customer_id',
      'Reviewer_Id',
    ])('finds the user link by the wider name %s', (link) => {
      expect(kindsOf([column('opaque', link), textColumn('opaque', 'topic')])).toContain(
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
      );
    });

    it('flags a type the catalog does not know, because it needs a review', () => {
      expect(kindsOf(unreviewed(9999))).toEqual([ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE]);
    });

    it('finds the user link through a foreign key, whatever the column is called', () => {
      const kinds = kindsOf([
        column('feedback', 'created_by', { linksToUsers: true }),
        column('feedback', 'who', { linksToUsers: true }),
        textColumn('feedback', 'topic'),
      ]);

      expect(kinds).toEqual([ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE]);
    });

    it.each([
      'created_by',
      'account_id',
      'profile_id',
      'owner_id',
      'viewer_id',
      'follower_id',
      'x_user_id',
    ])('finds the user link by the name %s', (link) => {
      expect(kindsOf([column('opaque', link), textColumn('opaque', 'topic')])).toContain(
        ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
      );
    });

    it('leaves a table without a user link alone', () => {
      expect(kindsOf([textColumn('genres', 'name')])).toEqual([]);
    });
  });

  describe('views', () => {
    it('flags a view that runs with its owner rights', () => {
      expect(kindsOf([column('leaky_view', 'id', { kind: 'v' })])).toEqual([
        ViolationKind.VIEW_WITHOUT_SECURITY_INVOKER,
      ]);
    });

    it.each(['{security_invoker=true}', '{security_invoker=on}', '{security_invoker=1}'])(
      'accepts a view with %s',
      (options) => {
        expect(kindsOf([column('invoker_view', 'id', { kind: 'v', options })])).toEqual([]);
      },
    );

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
            signature: 'public.leaky_function()',
            securityDefiner: true,
            dangerous: false,
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
            signature: 'pg_logical_emit_message(boolean,text,text)',
            securityDefiner: false,
            dangerous: true,
          },
        ],
      });

      expect(kinds).toEqual([ViolationKind.DANGEROUS_FUNCTION_EXECUTABLE]);
    });

    it('prints the signature once', () => {
      const [violation] = findViolations({
        readable: everyAllowListEntryInUse,
        direct: everyAllowListEntryInUse,
        types: TYPES,
        functions: [
          {
            schema: 'ps',
            signature: 'ps.f()',
            securityDefiner: true,
            dangerous: false,
          },
        ],
      });

      expect(violation?.target).toBe('ps.f()');
    });
  });

  it('flags a membership of the role in any other role', () => {
    expect(kindsOf([], { memberships: ['pg_read_all_stats'] })).toEqual([
      ViolationKind.ROLE_MEMBERSHIP,
    ]);
  });

  it('keys every rule by schema and table, so a table of another schema is never confused with it', () => {
    const keys = [
      ...PRIVATE_TABLES,
      ...CLOSED_COLUMNS.map((entry) => entry.table),
      ...ALLOWED_SENSITIVE_TABLE_NAMES.map((entry) => entry.table),
      ...ALLOWED_SENSITIVE_COLUMNS.map((entry) => entry.table),
      ...ALLOWED_FREE_FORM_COLUMNS.map((entry) => entry.table),
      ...ALLOWED_DEFINER_VIEWS.map((entry) => entry.table),
      ...ALLOWED_MATERIALIZED_VIEWS.map((entry) => entry.table),
    ];

    expect(keys.filter((key) => !/^[a-z_]+\.[a-z0-9_]+$/.test(key))).toEqual([]);
    expect(tableKey({ schema: 'public', table: 'users' })).toBe('public.users');
  });

  it('flags access that does not come from a grant to the role itself', () => {
    const readable = [
      ...everyAllowListEntryInUse,
      column('genres', 'tmdb_id', { typeOid: Oid.INT4 }),
    ];
    const kinds = findViolations({ readable, direct: everyAllowListEntryInUse, types: TYPES }).map(
      (item) => item.kind,
    );

    expect(kinds).toEqual([ViolationKind.READABLE_WITHOUT_DIRECT_GRANT]);
  });

  it('flags a table-wide grant on a table that has closed columns', () => {
    const readable = [
      ...everyAllowListEntryInUse,
      column('genres', 'tmdb_id', { typeOid: Oid.INT4 }),
    ];
    const kinds = findViolations({
      readable,
      direct: readable,
      types: TYPES,
      tableGrants: [
        { schema: 'public', table: 'genres' },
        { schema: 'public', table: 'users' },
        { schema: 'other', table: 'users' },
      ],
    }).map((item) => item.kind);

    expect(kinds).toEqual([ViolationKind.TABLE_GRANT_ON_PROTECTED_TABLE]);
  });

  it('flags every allow-list entry that matches nothing', () => {
    const readable = [column('genres', 'tmdb_id', { typeOid: Oid.INT4 })];
    const kinds = findViolations({ readable, direct: readable, types: TYPES }).map(
      (item) => item.kind,
    );

    expect(kinds).toEqual(Array(allowListEntryCount).fill(ViolationKind.STALE_ALLOW_LIST_ENTRY));
  });
});
