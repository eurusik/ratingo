import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

const logger = new Logger('GoogleConfig');

/**
 * Google OAuth Configuration.
 * Feature is disabled when required env vars are missing.
 */
export default registerAs('google', () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  const enabled = !!(clientId && clientSecret && callbackUrl);

  if (!enabled) {
    logger.warn(
      'Google OAuth is disabled: missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_CALLBACK_URL',
    );
  }

  return {
    clientId: clientId || '',
    clientSecret: clientSecret || '',
    callbackUrl: callbackUrl || '',
    enabled,
  };
});
