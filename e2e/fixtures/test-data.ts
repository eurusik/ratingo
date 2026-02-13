export const API_URL = process.env.API_URL || 'http://localhost:3001/api';
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
export const TEST_EMAIL = 'e2e@ratingo.test';
export const TEST_PASSWORD = 'TestPass1234';
export const AUTH_FILE = './e2e/.auth/user.json';

/** Show slug used for auto-subscribe flow test. Must NOT be in the seed subscriptions. */
export const SUBSCRIBE_TEST_SHOW_SLUG = '9-1-1';
