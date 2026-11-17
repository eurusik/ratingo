const SHORT_COMMIT_SHA_LENGTH = 7;
const LOCAL_SERVICE_VERSION = 'local';

export const toServiceVersion = (commitSha: string | undefined): string =>
  commitSha?.slice(0, SHORT_COMMIT_SHA_LENGTH) ?? LOCAL_SERVICE_VERSION;
