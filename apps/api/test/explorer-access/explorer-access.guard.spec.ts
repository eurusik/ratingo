import { findViolations, ViolationKind, type ReadableColumn } from './explorer-access.guard';

const column = (table: string, name: string, schema = 'public'): ReadableColumn => ({
  schema,
  table,
  column: name,
});

const grantedDirectly = (readable: ReadableColumn[]) => ({ readable, direct: readable });

const kindsOf = (readable: ReadableColumn[]) =>
  findViolations(grantedDirectly(readable)).map((item) => item.kind);

const ALLOWED_PRESENT = [
  column('user_media_actions', 'reason_key'),
  column('user_saved_items', 'reason_key'),
  column('user_subscriptions', 'last_notified_episode_key'),
  column('key_health_checks', 'status'),
];

describe('findViolations', () => {
  it('passes when only innocent columns and allow-listed names are readable', () => {
    expect(kindsOf([column('genres', 'name'), ...ALLOWED_PRESENT])).toEqual([]);
  });

  it('flags a readable column whose name looks sensitive', () => {
    expect(kindsOf([column('contacts', 'contact_email'), ...ALLOWED_PRESENT])).toEqual([
      ViolationKind.SENSITIVE_COLUMN_READABLE,
    ]);
  });

  it('flags a readable table whose name looks sensitive', () => {
    expect(kindsOf([column('user_sessions', 'id'), ...ALLOWED_PRESENT])).toEqual([
      ViolationKind.SENSITIVE_TABLE_READABLE,
    ]);
  });

  it('flags any readable column of a private table', () => {
    expect(kindsOf([column('refresh_tokens', 'id'), ...ALLOWED_PRESENT])).toContain(
      ViolationKind.PRIVATE_TABLE_READABLE,
    );
  });

  it('flags a closed column that became readable', () => {
    expect(kindsOf([column('user_media_state', 'notes'), ...ALLOWED_PRESENT])).toEqual([
      ViolationKind.CLOSED_COLUMN_READABLE,
    ]);
  });

  it('flags access that does not come from a grant to the role itself', () => {
    const readable = [column('genres', 'name'), ...ALLOWED_PRESENT];
    const kinds = findViolations({ readable, direct: ALLOWED_PRESENT }).map((item) => item.kind);
    expect(kinds).toEqual([ViolationKind.READABLE_WITHOUT_DIRECT_GRANT]);
  });

  it('flags allow-list entries that match nothing', () => {
    const kinds = kindsOf([column('genres', 'name')]);
    expect(kinds).toEqual([
      ViolationKind.STALE_ALLOW_LIST_ENTRY,
      ViolationKind.STALE_ALLOW_LIST_ENTRY,
      ViolationKind.STALE_ALLOW_LIST_ENTRY,
      ViolationKind.STALE_ALLOW_LIST_ENTRY,
    ]);
  });
});
