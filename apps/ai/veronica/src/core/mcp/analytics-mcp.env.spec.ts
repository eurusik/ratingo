import { stat } from 'node:fs/promises';

import { GoogleAnalyticsMcpKey } from '@ratingo/ai-core';

import { AnalyticsMcpSkip, prepareAnalyticsMcpEnv } from './analytics-mcp.env';
import { PrivateCredentialsFile } from './private-credentials-file';

const KEY = JSON.stringify({
  type: 'service_account',
  client_email: 'reader@demo.iam.gserviceaccount.com',
  private_key: 'secret-material-for-the-test',
  token_uri: 'https://oauth2.googleapis.com/token',
});
const OWNER_ONLY = 0o600;
const PERMISSION_BITS = 0o777;

describe('prepareAnalyticsMcpEnv', () => {
  it('writes the key to a private file and passes only its path', async () => {
    const prepared = await prepareAnalyticsMcpEnv({
      credentialsJson: KEY,
      propertyId: '515589933',
    });
    try {
      const file = prepared.values[GoogleAnalyticsMcpKey.CREDENTIALS_FILE];
      expect(prepared.skipped).toEqual([]);
      expect(prepared.values[GoogleAnalyticsMcpKey.PROPERTY_ID]).toBe('515589933');
      expect(file).toBe(prepared.credentialsFile?.path);
      expect(((await stat(file!)).mode & PERMISSION_BITS).toString(8)).toBe(OWNER_ONLY.toString(8));
      expect(JSON.stringify(prepared.values)).not.toContain('secret-material');
    } finally {
      await prepared.credentialsFile?.remove();
    }
  });

  it('removes the whole private directory', async () => {
    const prepared = await prepareAnalyticsMcpEnv({ credentialsJson: KEY, propertyId: '1' });
    await prepared.credentialsFile?.remove();
    await expect(stat(prepared.credentialsFile!.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    [{}, [AnalyticsMcpSkip.NO_CREDENTIALS, AnalyticsMcpSkip.NO_PROPERTY]],
    [{ credentialsJson: KEY, propertyId: 'G-Y3TXZS9VBK' }, [AnalyticsMcpSkip.BAD_PROPERTY]],
    [
      { credentialsJson: '{"type":"authorized_user"}', propertyId: '1' },
      ['GA_CREDENTIALS_JSON is not a service account key (not_a_service_account)'],
    ],
  ])('writes nothing and gives the reason for %j', async (config, skipped) => {
    const prepared = await prepareAnalyticsMcpEnv(config);
    expect(prepared).toEqual({ values: {}, skipped });
  });

  it('stays off instead of failing when the key file cannot be written', async () => {
    const write = jest
      .spyOn(PrivateCredentialsFile, 'write')
      .mockRejectedValueOnce(new Error('EROFS: read-only file system'));
    try {
      await expect(
        prepareAnalyticsMcpEnv({ credentialsJson: KEY, propertyId: '1' }),
      ).resolves.toEqual({
        values: {},
        skipped: [AnalyticsMcpSkip.KEY_FILE_NOT_WRITTEN],
      });
    } finally {
      write.mockRestore();
    }
  });

  it('never puts key material in a skip reason', async () => {
    const prepared = await prepareAnalyticsMcpEnv({
      credentialsJson: 'secret-material {',
      propertyId: '1',
    });
    expect(prepared.skipped.join(' ')).not.toContain('secret-material');
  });
});
