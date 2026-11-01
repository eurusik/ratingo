export class DatabaseDumpError extends Error {
  constructor(
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(`pg_dump exited with code ${exitCode}: ${stderr}`);
    this.name = 'DatabaseDumpError';
  }
}
