import { render, screen, within } from '@testing-library/react';
import { getDictionary } from '@/shared/i18n';
import { SiteFooter } from './site-footer';

const uk = getDictionary('uk');

describe('SiteFooter', () => {
  it('links to the code and the author', () => {
    render(<SiteFooter dict={uk} />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('hidden', 'md:block', 'below-fold');
    const links = within(footer).getByRole('navigation', { name: uk.footer.label });
    expect(within(links).getAllByRole('link')).toHaveLength(1);
    expect(
      within(links).getByRole('link', { name: `${uk.footer.github} ${uk.common.opensInNewTab}` }),
    ).toHaveAttribute('target', '_blank');
    expect(
      within(footer).getByRole('link', {
        name: `${uk.footer.authorName} ${uk.common.opensInNewTab}`,
      }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
    expect(footer).toHaveTextContent(uk.footer.madeIn);
  });
});
