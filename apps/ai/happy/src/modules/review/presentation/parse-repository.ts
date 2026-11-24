const REPOSITORY_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const DOT_SEGMENT = /^\.+$/;

export const parseRepository = (value: string): { owner: string; repo: string } | null => {
  const match = REPOSITORY_PATTERN.exec(value);
  const owner = match?.[1];
  const repo = match?.[2];
  if (owner === undefined || repo === undefined) return null;
  return DOT_SEGMENT.test(owner) || DOT_SEGMENT.test(repo) ? null : { owner, repo };
};
