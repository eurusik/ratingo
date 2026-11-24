import * as fc from 'fast-check';

import {
  ServiceAccountKeyProblem,
  checkServiceAccountKey,
  isGaPropertyId,
} from './service-account-key.policy';

const VALID_KEY = {
  type: 'service_account',
  project_id: 'demo',
  client_email: 'reader@demo.iam.gserviceaccount.com',
  private_key: 'not-a-real-key',
  token_uri: 'https://oauth2.googleapis.com/token',
};

describe('checkServiceAccountKey', () => {
  it('accepts a service account key', () => {
    expect(checkServiceAccountKey(JSON.stringify(VALID_KEY))).toEqual({ valid: true });
  });

  it.each([
    ['text that is not JSON', 'not json', ServiceAccountKeyProblem.NOT_JSON],
    ['a JSON array', '[1]', ServiceAccountKeyProblem.NOT_JSON],
    [
      'a user credential',
      JSON.stringify({ ...VALID_KEY, type: 'authorized_user' }),
      ServiceAccountKeyProblem.NOT_A_SERVICE_ACCOUNT,
    ],
    [
      'a key without private_key',
      JSON.stringify({ ...VALID_KEY, private_key: '' }),
      ServiceAccountKeyProblem.MISSING_FIELDS,
    ],
  ])('rejects %s', (_label, raw, problem) => {
    expect(checkServiceAccountKey(raw)).toEqual({ valid: false, problem });
  });

  it('never echoes the input in its verdict', () => {
    fc.assert(
      fc.property(fc.string(), (suffix) => {
        const raw = `KEY-MATERIAL-${suffix}`;
        const verdict = JSON.stringify(checkServiceAccountKey(raw));
        expect(verdict.includes(raw)).toBe(false);
      }),
    );
  });
});

describe('isGaPropertyId', () => {
  it.each([
    ['515589933', true],
    ['G-Y3TXZS9VBK', false],
    ['properties/515589933', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isGaPropertyId(value)).toBe(expected);
  });
});
