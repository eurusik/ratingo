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
  typeName?: string;
  typeCategory?: string;
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

const USER_LINK_COLUMN = /^(user_id|reporter_id|author_id|moderator_id|.+_user_id)$/;
const FREE_FORM_TYPES = new Set([
  'text',
  'varchar',
  'bpchar',
  'json',
  'jsonb',
  'inet',
  'cidr',
  'bytea',
  'xml',
  'citext',
  'name',
]);
const ARRAY_CATEGORY = 'A';
const SECURITY_INVOKER = /security_invoker=(true|on)/;
const VIEW = 'v';
const MATERIALIZED_VIEW = 'm';

const qualified = (item: ReadableColumn): string => `${item.schema}.${item.table}.${item.column}`;

const sameColumn = (left: ReadableColumn, right: ReadableColumn): boolean =>
  left.schema === right.schema && left.table === right.table && left.column === right.column;

const tableNamed = (item: ReadableColumn, table: string): boolean => item.table === table;

const isFreeForm = (item: ReadableColumn): boolean =>
  FREE_FORM_TYPES.has(item.typeName ?? '') || item.typeCategory === ARRAY_CATEGORY;

const tablesOf = (readable: readonly ReadableColumn[]): string[] => [
  ...new Set(readable.map((item) => item.table)),
];

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
    const pattern = sensitivePatternIn(table);
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
      (entry) => entry.table === item.table && entry.column === item.column,
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

const freeFormViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  tablesOf(readable)
    .filter((table) =>
      readable.some((item) => tableNamed(item, table) && USER_LINK_COLUMN.test(item.column)),
    )
    .flatMap((table) =>
      readable
        .filter((item) => tableNamed(item, table) && isFreeForm(item))
        .filter(
          (item) =>
            !ALLOWED_FREE_FORM_COLUMNS.some(
              (entry) => entry.table === table && entry.columns.includes(item.column),
            ),
        )
        .map((item) => ({
          kind: ViolationKind.FREE_FORM_COLUMN_IN_USER_TABLE,
          target: qualified(item),
          detail: `a ${item.typeName ?? 'free-form'} column in a table linked to users must be reviewed and added to the free-form allow-list`,
        })),
    );

const viewViolations = (readable: readonly ReadableColumn[]): Violation[] => {
  const views = new Map<string, ReadableColumn>();
  for (const item of readable) {
    if (item.kind === VIEW || item.kind === MATERIALIZED_VIEW) {
      views.set(`${item.schema}.${item.table}`, item);
    }
  }
  return [...views.values()].flatMap((view): Violation[] => {
    const name = `${view.schema}.${view.table}`;
    if (view.kind === MATERIALIZED_VIEW) {
      return ALLOWED_MATERIALIZED_VIEWS.some((entry) => entry.table === view.table)
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
    const allowed = ALLOWED_DEFINER_VIEWS.some((entry) => entry.table === view.table);
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
          target: `${item.schema}.${item.signature}`,
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
    .filter((grant) => protectedTables.has(grant.table))
    .map((grant) => ({
      kind: ViolationKind.TABLE_GRANT_ON_PROTECTED_TABLE,
      target: `${grant.schema}.${grant.table}`,
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
          !readable.some(
            (item) => tableNamed(item, entry.table) && item.column === column && isFreeForm(item),
          ),
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
  ...freeFormViolations(grants.readable),
  ...viewViolations(grants.readable),
  ...functionViolations(grants.functions ?? []),
  ...withoutDirectGrantViolations(grants),
  ...tableGrantViolations(grants),
  ...staleAllowListViolations(grants.readable),
];

export const describeViolations = (violations: readonly Violation[]): string =>
  violations.map((item) => `${item.kind}: ${item.target} (${item.detail})`).join('\n');
