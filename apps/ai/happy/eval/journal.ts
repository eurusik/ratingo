export const migrationJournal = (tags: readonly string[]): string[] =>
  JSON.stringify(
    {
      version: '7',
      dialect: 'postgresql',
      entries: tags.map((tag, index) => ({
        idx: Number(tag.slice(0, 4)) || index,
        version: '7',
        tag,
        breakpoints: true,
      })),
    },
    null,
    2,
  ).split('\n');

export const MIGRATION_JOURNAL_PATH = 'apps/api/drizzle_v2/meta/_journal.json';
