import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

const logger = new Logger('FacebookConfig');

/**
 * Facebook OAuth Configuration.
 * Feature is disabled when required env vars are missing.
 */
export default registerAs('facebook', () => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const callbackUrl = process.env.FACEBOOK_CALLBACK_URL;

  const enabled = !!(appId && appSecret && callbackUrl);

  if (!enabled) {
    logger.warn(
      'Facebook OAuth is disabled: missing FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, or FACEBOOK_CALLBACK_URL',
    );
  }

  return {
    appId: appId || '',
    appSecret: appSecret || '',
    callbackUrl: callbackUrl || '',
    enabled,
  };
});
