export type AllowedOrigin = string | RegExp;

export const matchesAllowedOrigin = (
  origin: string,
  allowList: readonly AllowedOrigin[],
): boolean =>
  allowList.some((allowed) =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin),
  );
