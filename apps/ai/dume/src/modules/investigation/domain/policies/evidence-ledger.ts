interface LineInterval {
  start: number;
  end: number;
}

export class EvidenceLedger {
  private readonly byPath = new Map<string, LineInterval[]>();

  record(path: string, startLine: number, endLine: number): void {
    if (endLine < startLine) return;
    const intervals = [...(this.byPath.get(path) ?? []), { start: startLine, end: endLine }].sort(
      (left, right) => left.start - right.start,
    );
    const merged: LineInterval[] = [];
    for (const interval of intervals) {
      const last = merged[merged.length - 1];
      if (last !== undefined && interval.start <= last.end + 1) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
    this.byPath.set(path, merged);
  }

  covers(path: string, startLine: number, endLine: number): boolean {
    return (this.byPath.get(path) ?? []).some(
      (interval) => interval.start <= startLine && endLine <= interval.end,
    );
  }

  pathsRead(): string[] {
    return [...this.byPath.keys()].sort();
  }
}
