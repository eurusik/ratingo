export const ServiceAccountKeyProblem = {
  NOT_JSON: 'not_json',
  NOT_A_SERVICE_ACCOUNT: 'not_a_service_account',
  MISSING_FIELDS: 'missing_fields',
} as const;
export type ServiceAccountKeyProblem =
  (typeof ServiceAccountKeyProblem)[keyof typeof ServiceAccountKeyProblem];

export type ServiceAccountKeyCheck =
  { valid: true } | { valid: false; problem: ServiceAccountKeyProblem };

const SERVICE_ACCOUNT_TYPE = 'service_account';
const REQUIRED_FIELDS = ['client_email', 'private_key', 'token_uri'] as const;
const PROPERTY_ID_PATTERN = /^\d{1,20}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

export function checkServiceAccountKey(raw: string): ServiceAccountKeyCheck {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) {
    return { valid: false, problem: ServiceAccountKeyProblem.NOT_JSON };
  }
  if (parsed.type !== SERVICE_ACCOUNT_TYPE) {
    return { valid: false, problem: ServiceAccountKeyProblem.NOT_A_SERVICE_ACCOUNT };
  }
  const complete = REQUIRED_FIELDS.every(
    (field) => typeof parsed[field] === 'string' && (parsed[field] as string).length > 0,
  );
  return complete
    ? { valid: true }
    : { valid: false, problem: ServiceAccountKeyProblem.MISSING_FIELDS };
}

export const isGaPropertyId = (value: string): boolean => PROPERTY_ID_PATTERN.test(value);
