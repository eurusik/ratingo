const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const NO_NEWLINE_MARKER = '\\';

export interface DiffLines {
  commentable: ReadonlySet<number>;
  added: ReadonlySet<number>;
}

export const parseDiffLines = (patch: string): DiffLines => {
  const commentable = new Set<number>();
  const added = new Set<number>();
  let newLine = 0;
  let insideHunk = false;
  for (const line of patch.split('\n')) {
    const header = HUNK_HEADER.exec(line);
    if (header !== null) {
      newLine = Number(header[1]);
      insideHunk = true;
    } else if (insideHunk && !line.startsWith(NO_NEWLINE_MARKER)) {
      const marker = line.charAt(0);
      if (marker === '+') {
        commentable.add(newLine);
        added.add(newLine);
        newLine += 1;
      } else if (marker !== '-') {
        commentable.add(newLine);
        newLine += 1;
      }
    }
  }
  return { commentable, added };
};

export const toLineRanges = (lines: ReadonlySet<number>): string => {
  const ranges: [number, number][] = [];
  for (const line of [...lines].sort((left, right) => left - right)) {
    const last = ranges[ranges.length - 1];
    if (last !== undefined && last[1] + 1 === line) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(',');
};
