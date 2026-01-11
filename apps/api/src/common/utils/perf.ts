/**
 * Simple performance timing helper for debugging slow endpoints.
 * Tracks marks and generates a report with durations between marks.
 *
 * @example
 * const perf = new Perf();
 * perf.mark('before_db');
 * await db.query();
 * perf.mark('after_db');
 * console.log(perf.report()); // "before_db=0ms after_db=150ms total=150ms"
 */
export class Perf {
  private readonly marks: Array<{ name: string; time: number }> = [];
  private readonly t0 = Date.now();

  /**
   * Records a timing mark with the given name.
   */
  mark(name: string): void {
    this.marks.push({ name, time: Date.now() });
  }

  /**
   * Generates a report string showing duration between each mark.
   * Format: "mark1=Xms mark2=Yms ... total=Zms"
   */
  report(): string {
    const parts: string[] = [];
    let prev = this.t0;

    for (const { name, time } of this.marks) {
      parts.push(`${name}=${time - prev}ms`);
      prev = time;
    }

    parts.push(`total=${Date.now() - this.t0}ms`);
    return parts.join(' ');
  }

  /**
   * Returns total elapsed time in milliseconds.
   */
  elapsed(): number {
    return Date.now() - this.t0;
  }
}
