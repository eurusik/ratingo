import { GoogleAnalyticsMcpKey, type McpEnvValues } from '@ratingo/ai-core';

import type { AnalyticsMcpConfig } from '../../config/config.constants';

import { PrivateCredentialsFile } from './private-credentials-file';
import { checkServiceAccountKey, isGaPropertyId } from './service-account-key.policy';

const CREDENTIALS_DIR_PREFIX = 'veronica-ga-';

export const AnalyticsMcpSkip = {
  NO_CREDENTIALS: 'GA_CREDENTIALS_JSON is not set',
  NO_PROPERTY: 'GA_PROPERTY_ID is not set',
  BAD_PROPERTY: 'GA_PROPERTY_ID is not a numeric GA4 property id',
  KEY_FILE_NOT_WRITTEN: 'the private key file could not be written',
} as const;

export interface PreparedMcpEnv {
  values: McpEnvValues;
  credentialsFile?: PrivateCredentialsFile;
  skipped: readonly string[];
}

const credentialsProblem = (config: AnalyticsMcpConfig): string | undefined => {
  if (config.credentialsJson === undefined) {
    return AnalyticsMcpSkip.NO_CREDENTIALS;
  }
  const check = checkServiceAccountKey(config.credentialsJson);
  return check.valid
    ? undefined
    : `GA_CREDENTIALS_JSON is not a service account key (${check.problem})`;
};

const propertyProblem = (config: AnalyticsMcpConfig): string | undefined => {
  if (config.propertyId === undefined) {
    return AnalyticsMcpSkip.NO_PROPERTY;
  }
  return isGaPropertyId(config.propertyId) ? undefined : AnalyticsMcpSkip.BAD_PROPERTY;
};

const writeCredentials = async (json: string): Promise<PrivateCredentialsFile | undefined> => {
  try {
    return await PrivateCredentialsFile.write(json, CREDENTIALS_DIR_PREFIX);
  } catch {
    return undefined;
  }
};

export async function prepareAnalyticsMcpEnv(config: AnalyticsMcpConfig): Promise<PreparedMcpEnv> {
  const skipped = [credentialsProblem(config), propertyProblem(config)].filter(
    (problem): problem is string => problem !== undefined,
  );
  if (skipped.length > 0 || config.credentialsJson === undefined) {
    return { values: {}, skipped };
  }
  const credentialsFile = await writeCredentials(config.credentialsJson);
  if (credentialsFile === undefined) {
    return { values: {}, skipped: [AnalyticsMcpSkip.KEY_FILE_NOT_WRITTEN] };
  }
  return {
    values: {
      [GoogleAnalyticsMcpKey.CREDENTIALS_FILE]: credentialsFile.path,
      [GoogleAnalyticsMcpKey.PROPERTY_ID]: config.propertyId,
    },
    credentialsFile,
    skipped,
  };
}
