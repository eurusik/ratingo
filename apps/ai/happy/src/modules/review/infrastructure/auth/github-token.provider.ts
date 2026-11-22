export interface GithubRepositoryRef {
  owner: string;
  repo: string;
}

export interface GithubTokenProvider {
  tokenFor(repository: GithubRepositoryRef): Promise<string>;
}

export class StaticTokenProvider implements GithubTokenProvider {
  constructor(private readonly token: string) {}

  async tokenFor(): Promise<string> {
    return this.token;
  }
}
