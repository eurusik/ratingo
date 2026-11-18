import { render, screen } from '@testing-library/react';
import { getDictionary } from './dictionaries';
import { useTranslation } from './i18n-context';
import { TranslationScope, pickNamespaces } from './translation-scope';

function HomeHeading() {
  const { dict } = useTranslation();
  return (
    <h1>
      {dict.home.heading} / {dict.common.loading}
    </h1>
  );
}

describe('pickNamespaces', () => {
  it('keeps only the requested namespaces', () => {
    const picked = pickNamespaces(getDictionary('en'), ['home', 'nav']);

    expect(Object.keys(picked).sort()).toEqual(['home', 'nav']);
    expect(picked.home).toBe(getDictionary('en').home);
  });
});

describe('TranslationScope', () => {
  it('layers a route scope over the root one', () => {
    render(
      <TranslationScope locale="en" namespaces={['common']}>
        <TranslationScope locale="en" namespaces={['home']}>
          <HomeHeading />
        </TranslationScope>
      </TranslationScope>,
    );

    const { home, common } = getDictionary('en');
    expect(screen.getByRole('heading')).toHaveTextContent(`${home.heading} / ${common.loading}`);
  });
});
