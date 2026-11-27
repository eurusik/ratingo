import {
  ALLOWED_DEFINER_VIEWS,
  ALLOWED_FREE_FORM_COLUMNS,
  ALLOWED_MATERIALIZED_VIEWS,
  ALLOWED_SENSITIVE_COLUMNS,
  ALLOWED_SENSITIVE_TABLE_NAMES,
  CLOSED_COLUMNS,
  PRIVATE_TABLES,
} from './explorer-access.rules';
import { sensitivePatternIn } from './sensitive-columns';

export interface ReadableColumn {
  schema: string;
  table: string;
  column: string;
  kind?: string;
  options?: string;
  typeOid?: number;
  linksToUsers?: boolean;
}

export interface PgType {
  oid: number;
  name: string;
  kind: string;
  baseOid: number;
  elementOid: number;
  category: string;
}

export interface TableGrant {
  schema: string;
  table: string;
}

export interface ExecutableFunction {
  schema: string;
  signature: string;
  securityDefiner: boolean;
  systemFunction: boolean;
}

export interface ExplorerGrants {
  readable: readonly ReadableColumn[];
  direct: readonly ReadableColumn[];
  tableGrants?: readonly TableGrant[];
  functions?: readonly ExecutableFunction[];
  types?: readonly PgType[];
}

export const ViolationKind = {
  PRIVATE_TABLE_READABLE: 'private_table_readable',
  CLOSED_COLUMN_READABLE: 'closed_column_readable',
  SENSITIVE_COLUMN_READABLE: 'sensitive_column_readable',
  SENSITIVE_TABLE_READABLE: 'sensitive_table_readable',
  FREE_FORM_COLUMN_IN_USER_TABLE: 'free_form_column_in_user_table',
  VIEW_WITHOUT_SECURITY_INVOKER: 'view_without_security_invoker',
  MATERIALIZED_VIEW_READABLE: 'materialized_view_readable',
  SECURITY_DEFINER_FUNCTION_EXECUTABLE: 'security_definer_function_executable',
  DANGEROUS_FUNCTION_EXECUTABLE: 'dangerous_function_executable',
  READABLE_WITHOUT_DIRECT_GRANT: 'readable_without_direct_grant',
  TABLE_GRANT_ON_PROTECTED_TABLE: 'table_grant_on_protected_table',
  STALE_ALLOW_LIST_ENTRY: 'stale_allow_list_entry',
} as const;
export type ViolationKind = (typeof ViolationKind)[keyof typeof ViolationKind];

export interface Violation {
  kind: ViolationKind;
  target: string;
  detail: string;
}

const USER_LINK_COLUMN =
  /^(user_id|reporter_id|author_id|moderator_id|created_by|account_id|profile_id|owner_id|viewer_id|follower_id|.+_user_id)$/;
const SAFE_TYPE_NAMES = new Set([
  'uuid',
  'int2',
  'int4',
  'int8',
  'float4',
  'float8',
  'numeric',
  'money',
  'bool',
  'date',
  'time',
  'timetz',
  'timestamp',
  'timestamptz',
  'interval',
  'oid',
]);
const ENUM_KIND = 'e';
const DOMAIN_KIND = 'd';
const ARRAY_CATEGORY = 'A';
const SECURITY_INVOKER = /security_invoker=(true|on|1)/;
const VIEW = 'v';
const MATERIALIZED_VIEW = 'm';
const MAX_TYPE_DEPTH = 8;

const qualified = (item: ReadableColumn): string => `${item.schema}.${item.table}.${item.column}`;

const tableKey = (item: { schema: string; table: string }): string =>
  `${item.schema}.${item.table}`;

const sameColumn = (left: ReadableColumn, right: ReadableColumn): boolean =>
  tableKey(left) === tableKey(right) && left.column === right.column;

const tableNamed = (item: ReadableColumn, table: string): boolean => tableKey(item) === table;

const tablesOf = (readable: readonly ReadableColumn[]): string[] => [
  ...new Set(readable.map(tableKey)),
];

const isSafeType = (
  oid: number | undefined,
  types: ReadonlyMap<number, PgType>,
  depth = 0,
): boolean => {
  const type = oid === undefined ? undefined : types.get(oid);
  if (type === undefined || depth > MAX_TYPE_DEPTH) return false;
  if (type.kind === ENUM_KIND) return true;
  if (type.kind === DOMAIN_KIND) return isSafeType(type.baseOid, types, depth + 1);
  if (type.category === ARRAY_CATEGORY) return isSafeType(type.elementOid, types, depth + 1);
  return SAFE_TYPE_NAMES.has(type.name);
};

const typeNameOf = (item: ReadableColumn, types: ReadonlyMap<number, PgType>): string =>
  types.get(item.typeOid ?? 0)?.name ?? 'unknown type';

const typeIndex = (types: readonly PgType[] | undefined): ReadonlyMap<number, PgType> =>
  new Map((types ?? []).map((type) => [type.oid, type]));

const privateTableViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  PRIVATE_TABLES.flatMap((table) => {
    const open = readable.filter((item) => tableNamed(item, table));
    return open.length === 0
      ? []
      : [
          {
            kind: ViolationKind.PRIVATE_TABLE_READABLE,
            target: table,
            detail: `${open.length} column(s) readable: ${open.map((item) => item.column).join(', ')}`,
          },
        ];
  });

const closedColumnViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  CLOSED_COLUMNS.flatMap(({ table, columns }) =>
    readable
      .filter((item) => tableNamed(item, table) && columns.includes(item.column))
      .map((item) => ({
        kind: ViolationKind.CLOSED_COLUMN_READABLE,
        target: qualified(item),
        detail: 'this column is on the closed list',
      })),
  );

const sensitiveTableViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  tablesOf(readable).flatMap((table) => {
    const pattern = sensitivePatternIn(table.slice(table.indexOf('.') + 1));
    const allowed = ALLOWED_SENSITIVE_TABLE_NAMES.some((entry) => entry.table === table);
    return pattern === null || allowed
      ? []
      : [
          {
            kind: ViolationKind.SENSITIVE_TABLE_READABLE,
            target: table,
            detail: `table name matches "${pattern}" and is not on the allow-list`,
          },
        ];
  });

const sensitiveColumnViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  readable.flatMap((item) => {
    const pattern = sensitivePatternIn(item.column);
    const allowed = ALLOWED_SENSITIVE_COLUMNS.some(
      (entry) => entry.table === tableKey(item) && entry.column === item.column,
    );
    return pattern === null || allowed
      ? []
      : [
          {
            kind: ViolationKind.SENSITIVE_COLUMN_READABLE,
            target: qualified(item),
            detail: `column name matches "${pattern}" and is not on the allow-list`,
          },
        ];
  });

const linksToUsers = (readable: readonly ReadableColumn[], table: string): boolean =>
  readable.some(
    (item) =>
      tableNamed(item, table) && (item.linksToUsers === true || USER_LINK_COLUMN.test(item.column)),
  );

const freeFormViolations = (
  readable: readonly ReadableColumn[],
  types: ReadonlyMap<number, PgType>,
): Violation[] =>
  tablesOf(readable)
    .filter((table) => linksToUsers(readable, table))
    .flatMap((table) =>
      readable
        .filter((item) => tableNamed(item, table) && !isSafeType(item.typeOid, types))
        .filter(
          (item) =>
            !ALLOWED_FREE_FORM_COLUMNS.some(
              (entry) => entry.table === table && entry.columns.includes(item.column),
            ),
        )
        .map((item) => ({
          kind: ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
          target: qualified(item),
          detail: `a ${typeNameOf(item, types)} column in a table linked to users must be reviewed and added to the free-form allow-list`,
        })),
    );

const viewViolations = (readable: readonly ReadableColumn[]): Violation[] => {
  const views = new Map<string, ReadableColumn>();
  for (const item of readable) {
    if (item.kind === VIEW || item.kind === MATERIALIZED_VIEW) views.set(tableKey(item), item);
  }
  return [...views.values()].flatMap((view): Violation[] => {
    const name = tableKey(view);
    if (view.kind === MATERIALIZED_VIEW) {
      return ALLOWED_MATERIALIZED_VIEWS.some((entry) => entry.table === name)
        ? []
        : [
            {
              kind: ViolationKind.MATERIALIZED_VIEW_READABLE,
              target: name,
              detail:
                'a materialized view runs with its owner rights and cannot be security_invoker; review it and add it to the allow-list',
            },
          ];
    }
    const invoker = SECURITY_INVOKER.test(view.options ?? '');
    const allowed = ALLOWED_DEFINER_VIEWS.some((entry) => entry.table === name);
    return invoker || allowed
      ? []
      : [
          {
            kind: ViolationKind.VIEW_WITHOUT_SECURITY_INVOKER,
            target: name,
            detail:
              'a view runs with its owner rights and bypasses the column grants; create it WITH (security_invoker = true)',
          },
        ];
  });
};

const functionViolations = (functions: readonly ExecutableFunction[]): Violation[] =>
  functions.map((item) =>
    item.systemFunction
      ? {
          kind: ViolationKind.DANGEROUS_FUNCTION_EXECUTABLE,
          target: item.signature,
          detail: 'ai_explorer must not be able to run this function; revoke it from PUBLIC',
        }
      : {
          kind: ViolationKind.SECURITY_DEFINER_FUNCTION_EXECUTABLE,
          target: item.signature,
          detail: 'a SECURITY DEFINER function runs with its owner rights and bypasses the grants',
        },
  );

const withoutDirectGrantViolations = (grants: ExplorerGrants): Violation[] =>
  grants.readable
    .filter((item) => !grants.direct.some((grant) => sameColumn(grant, item)))
    .map((item) => ({
      kind: ViolationKind.READABLE_WITHOUT_DIRECT_GRANT,
      target: qualified(item),
      detail: 'readable through PUBLIC or another role, not through a grant to ai_explorer',
    }));

const protectedTables = new Set([...PRIVATE_TABLES, ...CLOSED_COLUMNS.map(({ table }) => table)]);

const tableGrantViolations = (grants: ExplorerGrants): Violation[] =>
  (grants.tableGrants ?? [])
    .filter((grant) => protectedTables.has(tableKey(grant)))
    .map((grant) => ({
      kind: ViolationKind.TABLE_GRANT_ON_PROTECTED_TABLE,
      target: tableKey(grant),
      detail: 'a table-wide SELECT grant opens every column; grant the safe columns instead',
    }));

const stale = (target: string): Violation => ({
  kind: ViolationKind.STALE_ALLOW_LIST_ENTRY,
  target,
  detail: 'allow-list entry matches nothing the role can read; remove it',
});

const staleAllowListViolations = (readable: readonly ReadableColumn[]): Violation[] => [
  ...ALLOWED_SENSITIVE_TABLE_NAMES.filter(
    (entry) => !readable.some((item) => tableNamed(item, entry.table)),
  ).map((entry) => stale(`table ${entry.table}`)),
  ...ALLOWED_SENSITIVE_COLUMNS.filter(
    (entry) =>
      !readable.some((item) => tableNamed(item, entry.table) && item.column === entry.column),
  ).map((entry) => stale(`${entry.table}.${entry.column}`)),
  ...ALLOWED_FREE_FORM_COLUMNS.flatMap((entry) =>
    entry.columns
      .filter(
        (column) =>
          !readable.some((item) => tableNamed(item, entry.table) && item.column === column),
      )
      .map((column) => stale(`free-form ${entry.table}.${column}`)),
  ),
  ...ALLOWED_DEFINER_VIEWS.filter(
    (entry) => !readable.some((item) => tableNamed(item, entry.table) && item.kind === VIEW),
  ).map((entry) => stale(`view ${entry.table}`)),
  ...ALLOWED_MATERIALIZED_VIEWS.filter(
    (entry) =>
      !readable.some((item) => tableNamed(item, entry.table) && item.kind === MATERIALIZED_VIEW),
  ).map((entry) => stale(`materialized view ${entry.table}`)),
];

export const findViolations = (grants: ExplorerGrants): Violation[] => [
  ...privateTableViolations(grants.readable),
  ...closedColumnViolations(grants.readable),
  ...sensitiveTableViolations(grants.readable),
  ...sensitiveColumnViolations(grants.readable),
  ...freeFormViolations(grants.readable, typeIndex(grants.types)),
  ...viewViolations(grants.readable),
  ...functionViolations(grants.functions ?? []),
  ...withoutDirectGrantViolations(grants),
  ...tableGrantViolations(grants),
  ...staleAllowListViolations(grants.readable),
];

export const describeViolations = (violations: readonly Violation[]): string =>
  violations.map((item) => `${item.kind}: ${item.target} (${item.detail})`).join('\n');
