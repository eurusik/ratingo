import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP_THEME_COLOR, buildWebAppManifest } from './web-app-manifest';

const PUBLIC_DIR = join(__dirname, '../../../../public');

describe('buildWebAppManifest', () => {
  const manifest = buildWebAppManifest();

  it('keeps the identity and scope of the installed app', () => {
    expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/?source=pwa' });
  });

  it('uses the short brand name under the home screen icon', () => {
    expect(manifest.short_name).toBe('Ratingo');
  });

  it('matches the app background so the splash screen does not flash', () => {
    expect(manifest.background_color).toBe(APP_THEME_COLOR);
    expect(manifest.theme_color).toBe(APP_THEME_COLOR);
  });

  it('ships a maskable icon for adaptive launchers', () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([expect.objectContaining({ purpose: 'maskable' })]),
    );
  });

  it('only lists icons that exist in public', () => {
    const iconPaths = [
      ...(manifest.icons ?? []),
      ...(manifest.shortcuts ?? []).flatMap((shortcut) => shortcut.icons ?? []),
    ].map((icon) => icon.src);

    expect(iconPaths.filter((path) => !existsSync(join(PUBLIC_DIR, path)))).toEqual([]);
  });
});

describe('buildWebAppManifest shortcuts', () => {
  it('only opens routes the storefront serves', () => {
    expect(buildWebAppManifest().shortcuts?.map((shortcut) => shortcut.url)).toEqual([
      '/browse',
      '/calendar',
      '/my',
    ]);
  });

  it('lets the installed app rotate with the device', () => {
    expect(buildWebAppManifest().orientation).toBeUndefined();
  });
});
