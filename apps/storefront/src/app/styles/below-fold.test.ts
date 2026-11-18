import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return '';
  return css.slice(start, css.indexOf('}', start));
}

describe('below-fold', () => {
  it('skips off-screen rendering but remembers the real size once rendered', () => {
    const utility = ruleBody('@utility below-fold');

    expect(utility).toContain('content-visibility: auto');
    expect(utility).toMatch(/contain-intrinsic-size: auto /);
  });

  it('renders everything while a navigation animates or the back scroll is restored', () => {
    const override = ruleBody(
      ':root:is([data-nav-transition], [data-scroll-restoring]) .below-fold',
    );

    expect(override).toContain('content-visibility: visible');
  });

  it('widens the contained box over the shadow and gutter bleed of the rails without moving them', () => {
    const bleed = ruleBody('@utility fold-bleed');

    expect(bleed).toContain('padding-block: 1rem');
    expect(bleed).toContain('margin-block: -1rem');
    expect(bleed).toContain('margin-inline: calc(var(--fold-bleed-inline, 0px) * -1)');
  });
});
