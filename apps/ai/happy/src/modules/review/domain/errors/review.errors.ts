export class RepositoryNotAllowedError extends Error {
  constructor(repository: string) {
    super(`Repository ${repository} is not on the review allowlist`);
    this.name = 'RepositoryNotAllowedError';
  }
}
