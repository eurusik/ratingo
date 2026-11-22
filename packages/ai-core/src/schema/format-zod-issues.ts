import type { ZodError } from 'zod';

const ROOT_PATH_LABEL = '(root)';

export function formatZodIssues(error: ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || ROOT_PATH_LABEL}: ${issue.message}`,
  );
}
