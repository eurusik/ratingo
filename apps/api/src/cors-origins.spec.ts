import * as fc from 'fast-check';

import { resolveCorsOrigins, VERCEL_PREVIEW_DEPLOYMENT_ORIGIN } from './cors-origins';

const allows = (origins: (string | RegExp)[], origin: string): boolean =>
  origins.some((allowed) =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin),
  );

describe('resolveCorsOrigins', () => {
  it('falls back to the default origins when CORS_ORIGIN is unset', () => {
    expect(resolveCorsOrigins({})).toEqual([
      'http://localhost:3002',
      'http://localhost:3000',
      'https://new.ratingo.top',
      'https://ratingo.top',
    ]);
  });

  it('splits and trims CORS_ORIGIN', () => {
    expect(resolveCorsOrigins({ CORS_ORIGIN: 'https://a.test, https://b.test' })).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('does not allow Vercel previews unless CORS_ALLOW_VERCEL_PREVIEWS is "true"', () => {
    const preview = 'https://ratingo-f4wpg7gzz-eurusik.vercel.app';

    expect(allows(resolveCorsOrigins({}), preview)).toBe(false);
    expect(allows(resolveCorsOrigins({ CORS_ALLOW_VERCEL_PREVIEWS: 'false' }), preview)).toBe(
      false,
    );
    expect(allows(resolveCorsOrigins({ CORS_ALLOW_VERCEL_PREVIEWS: '1' }), preview)).toBe(false);
    expect(allows(resolveCorsOrigins({ CORS_ALLOW_VERCEL_PREVIEWS: 'true' }), preview)).toBe(true);
  });

  it('keeps the explicit origins when previews are allowed', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGIN: 'https://dev.ratingo.top',
      CORS_ALLOW_VERCEL_PREVIEWS: 'true',
    });

    expect(allows(origins, 'https://dev.ratingo.top')).toBe(true);
  });
});

describe('VERCEL_PREVIEW_DEPLOYMENT_ORIGIN', () => {
  const deploymentHash = fc.stringMatching(/^[a-z0-9]{9}$/);

  it('matches every deployment URL of the ratingo project in the eurusik scope', () => {
    fc.assert(
      fc.property(deploymentHash, (hash) =>
        VERCEL_PREVIEW_DEPLOYMENT_ORIGIN.test(`https://ratingo-${hash}-eurusik.vercel.app`),
      ),
    );
  });

  it('rejects other projects, scopes, schemes and suffixes', () => {
    fc.assert(
      fc.property(deploymentHash, fc.stringMatching(/^[a-z0-9-]{1,20}$/), (hash, other) => {
        const lookalikes = [
          `https://ratingo-${hash}-${other}-eurusik.vercel.app`,
          `https://ratingo-${hash}-eurusik-${other}.vercel.app`,
          `https://${other}-ratingo-${hash}-eurusik.vercel.app`,
          `https://ratingo-${hash}-eurusik.vercel.app.${other}.test`,
          `http://ratingo-${hash}-eurusik.vercel.app`,
          `https://ratingo-git-${other}-eurusik.vercel.app`,
        ];
        return lookalikes.every((origin) => !VERCEL_PREVIEW_DEPLOYMENT_ORIGIN.test(origin));
      }),
    );
  });
});
