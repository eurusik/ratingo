import { EvalKind, type EvalCase } from '../eval-case';
import { MIGRATION_JOURNAL_PATH, migrationJournal } from '../journal';

export const MIGRATION_PROD_STATE_SAFE_CASES: readonly EvalCase[] = [
  {
    id: 'migration-prod-state-safe--positive',
    kind: EvalKind.POSITIVE,
    checkId: 'migration-prod-state-safe',
    source:
      'e68d7741~1:apps/api/drizzle_v2/0029_catalog_integrity_indexes.sql (comments dropped, other statements guarded)',
    title: 'Catalog integrity indexes',
    path: 'apps/api/drizzle_v2/0029_catalog_integrity_indexes.sql',
    lines: [
      'DO $$',
      'BEGIN',
      '  IF EXISTS (SELECT 1 FROM "catalog_policies" GROUP BY "version" HAVING count(*) > 1) THEN',
      "    RAISE EXCEPTION 'catalog_policies has duplicate versions; resolve them before applying 0029';",
      '  END IF;',
      '  IF (SELECT count(*) FROM "catalog_policies" WHERE "is_active" = true) > 1 THEN',
      "    RAISE EXCEPTION 'catalog_policies has more than one active policy; deactivate extras before applying 0029';",
      '  END IF;',
      'END $$;--> statement-breakpoint',
      '',
      'DROP INDEX IF EXISTS "catalog_policies_version_idx";--> statement-breakpoint',
      '-- squawk-ignore require-concurrent-index-creation',
      'CREATE UNIQUE INDEX IF NOT EXISTS "catalog_eval_runs_single_running" ON "catalog_evaluation_runs" USING btree ("target_policy_id") WHERE "catalog_evaluation_runs"."status" = \'running\';--> statement-breakpoint',
      '-- squawk-ignore require-concurrent-index-creation',
      'CREATE UNIQUE INDEX IF NOT EXISTS "catalog_policies_version_uniq" ON "catalog_policies" USING btree ("version");--> statement-breakpoint',
      '-- squawk-ignore require-concurrent-index-creation',
      'CREATE UNIQUE INDEX "catalog_policies_single_active" ON "catalog_policies" USING btree ("is_active") WHERE "catalog_policies"."is_active" = true;',
    ],
    extraFiles: {
      [MIGRATION_JOURNAL_PATH]: migrationJournal(['0027_spicy_kate_bishop', '0028_tidy_havok']),
    },
    expectation: {
      defectId: 'migration-index-not-idempotent',
      markerLine: 'CREATE UNIQUE INDEX "catalog_policies_single_active"',
    },
  },
  {
    id: 'migration-prod-state-safe--protected',
    kind: EvalKind.PROTECTED_NEGATIVE,
    checkId: 'migration-prod-state-safe',
    source:
      'e68d7741:apps/api/drizzle_v2/0030_users_case_insensitive_unique.sql (comments dropped, squawk directives added)',
    title: 'Case-insensitive user indexes',
    path: 'apps/api/drizzle_v2/0030_users_case_insensitive_unique.sql',
    lines: [
      'DO $$',
      'DECLARE',
      '  dup_emails integer;',
      '  dup_usernames integer;',
      'BEGIN',
      '  SELECT count(*) INTO dup_emails',
      '  FROM (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) d;',
      '  SELECT count(*) INTO dup_usernames',
      '  FROM (SELECT 1 FROM "users" GROUP BY lower("username") HAVING count(*) > 1) d;',
      '',
      '  IF dup_emails > 0 OR dup_usernames > 0 THEN',
      "    RAISE EXCEPTION 'users has % email(s) and % username(s) that differ only by case; resolve them before applying 0030',",
      '      dup_emails, dup_usernames;',
      '  END IF;',
      'END $$;--> statement-breakpoint',
      '',
      '-- squawk-ignore require-concurrent-index-creation',
      'CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_uniq" ON "users" USING btree (lower("email"));--> statement-breakpoint',
      '-- squawk-ignore require-concurrent-index-creation',
      'CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_uniq" ON "users" USING btree (lower("username"));',
    ],
    extraFiles: {
      [MIGRATION_JOURNAL_PATH]: migrationJournal([
        '0028_tidy_havok',
        '0029_catalog_integrity_indexes',
      ]),
    },
  },
];
