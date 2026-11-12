import { render, screen, within } from '@testing-library/react';
import { getDictionary } from '@/shared/i18n';
import { SiteFooter } from './site-footer';

const uk = getDictionary('uk');

describe('SiteFooter', () => {
  it('links to the about page, the journal, the code and the author', () => {
    render(<SiteFooter dict={uk} />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('hidden', 'md:block');
    const links = within(footer).getByRole('navigation', { name: uk.footer.label });
    expect(within(links).getByRole('link', { name: uk.footer.about })).toHaveAttribute(
      'href',
      '/about',
    );
    expect(within(links).getByRole('link', { name: uk.footer.journal })).toHaveAttribute(
      'href',
      '/journal',
    );
    expect(within(links).getByRole('link', { name: uk.footer.github })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(within(footer).getByRole('link', { name: uk.footer.authorName })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(footer).toHaveTextContent(uk.footer.madeIn);
  });
});
