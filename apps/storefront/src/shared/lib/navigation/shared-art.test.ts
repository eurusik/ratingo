import { nameArtOfLink, pendingArtImageFor } from './shared-art';

function renderCardLink(href: string, imageUrl: string): HTMLAnchorElement {
  document.body.innerHTML = `
    <div data-shared-art-scope>
      <span data-shared-art><img alt="" /></span>
      <a href="${href}">Title</a>
    </div>
  `;
  const image = document.querySelector('img');
  Object.defineProperty(image, 'currentSrc', { value: imageUrl });
  return document.querySelector('a') as HTMLAnchorElement;
}

describe('pendingArtImageFor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hands the clicked poster to the page the link opens', () => {
    nameArtOfLink(renderCardLink('/movies/a', 'https://img.test/a.jpg'));

    expect(pendingArtImageFor('/movies/a')).toBe('https://img.test/a.jpg');
  });

  it('keeps a stale poster away from a page opened another way', () => {
    nameArtOfLink(renderCardLink('/movies/a', 'https://img.test/a.jpg'));

    expect(pendingArtImageFor('/shows/b')).toBeNull();
  });
});
