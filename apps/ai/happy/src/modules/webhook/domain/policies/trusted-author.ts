export interface AuthorshipFacts {
  headRepository: string | null;
  authorLogin: string;
}

export const isTrustedAuthor = (
  facts: AuthorshipFacts,
  repositoryName: string,
  allowedAuthors: readonly string[],
): boolean =>
  facts.headRepository?.toLowerCase() === repositoryName.toLowerCase() ||
  allowedAuthors.includes(facts.authorLogin);
