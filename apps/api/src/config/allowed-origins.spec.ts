import * as fc from 'fast-check';

import {
  resolveCorsOrigins,
  resolveOAuthReturnOrigins,
  VERCEL_PREVIEW_DEPLOYMENT_ORIGIN,
} from './allowed-origins';
import { type AllowedOrigin, matchesAllowedOrigin } from '../common/utils/allowed-origin.util';

const allows = (origins: AllowedOrigin[], origin: string): boolean =>
  matchesAllowedOrigin(origin, origins);

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

describe('resolveOAuthReturnOrigins', () => {
  it('allows nothing extra when OAUTH_RETURN_ORIGINS is unset', () => {
    expect(resolveOAuthReturnOrigins({})).toEqual([]);
  });

  it('splits and trims OAUTH_RETURN_ORIGINS and drops empty entries', () => {
    expect(
      resolveOAuthReturnOrigins({ OAUTH_RETURN_ORIGINS: ' https://a.test ,, https://b.test,' }),
    ).toEqual(['https://a.test', 'https://b.test']);
  });

  it('adds the Vercel preview rule only when OAUTH_ALLOW_VERCEL_PREVIEWS is "true"', () => {
    const preview = 'https://ratingo-storefront-f4wpg7gzz-eurusik.vercel.app';
    const env = { OAUTH_RETURN_ORIGINS: 'https://dev.ratingo.top' };

    expect(allows(resolveOAuthReturnOrigins(env), preview)).toBe(false);
    expect(
      allows(resolveOAuthReturnOrigins({ ...env, OAUTH_ALLOW_VERCEL_PREVIEWS: 'false' }), preview),
    ).toBe(false);
    expect(
      allows(resolveOAuthReturnOrigins({ ...env, OAUTH_ALLOW_VERCEL_PREVIEWS: 'true' }), preview),
    ).toBe(true);
  });

  it('ignores CORS_ALLOW_VERCEL_PREVIEWS so CORS previews do not receive OAuth codes', () => {
    const preview = 'https://ratingo-storefront-f4wpg7gzz-eurusik.vercel.app';

    expect(
      allows(resolveOAuthReturnOrigins({ CORS_ALLOW_VERCEL_PREVIEWS: 'true' } as never), preview),
    ).toBe(false);
  });
});

describe('VERCEL_PREVIEW_DEPLOYMENT_ORIGIN', () => {
  const deploymentHash = fc.stringMatching(/^[a-z0-9]{9}$/);
  const project = fc.constantFrom('ratingo', 'ratingo-storefront', 'ratingo-admin');

  it('matches every deployment URL of the ratingo, storefront and admin projects', () => {
    fc.assert(
      fc.property(project, deploymentHash, (name, hash) =>
        VERCEL_PREVIEW_DEPLOYMENT_ORIGIN.test(`https://${name}-${hash}-eurusik.vercel.app`),
      ),
    );
  });

  it('rejects other projects, scopes, schemes, suffixes and branch aliases', () => {
    fc.assert(
      fc.property(
        project,
        deploymentHash,
        fc.stringMatching(/^[a-z0-9-]{1,20}$/),
        (name, hash, other) => {
          const lookalikes = [
            `https://${name}-${hash}-${other}-eurusik.vercel.app`,
            `https://${name}-${hash}-eurusik-${other}.vercel.app`,
            `https://${other}-${name}-${hash}-eurusik.vercel.app`,
            `https://${name}-${hash}-eurusik.vercel.app.${other}.test`,
            `http://${name}-${hash}-eurusik.vercel.app`,
            `https://${name}-git-${other}-eurusik.vercel.app`,
            `https://${name}-${other}x-${hash}-eurusik.vercel.app`,
          ];
          return lookalikes.every((origin) => !VERCEL_PREVIEW_DEPLOYMENT_ORIGIN.test(origin));
        },
      ),
    );
  });

  it('rejects deployment URLs of unrelated projects that share the prefix', () => {
    const hash = 'f4wpg7gzz';
    [
      `https://ratingo-web-${hash}-eurusik.vercel.app`,
      `https://ratingo-storefrontx-${hash}-eurusik.vercel.app`,
      `https://ratingo-admin-storefront-${hash}-eurusik.vercel.app`,
      `https://ratingo-storefront-git-main-eurusik.vercel.app`,
      `https://ratingo-admin-git-feat-x-eurusik.vercel.app`,
    ].forEach((origin) => expect(VERCEL_PREVIEW_DEPLOYMENT_ORIGIN.test(origin)).toBe(false));
  });
});
