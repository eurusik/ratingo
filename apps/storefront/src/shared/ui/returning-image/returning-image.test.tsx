import { act, fireEvent, render } from '@testing-library/react';
import { ReturningImage } from './returning-image';

function renderImage(src: string) {
  return render(
    <ReturningImage unoptimized src={src} alt="" width={112} height={63} loading="lazy" />,
  ).container.querySelector('img')!;
}

describe('ReturningImage', () => {
  it('loads lazily and decodes asynchronously the first time', () => {
    const image = renderImage('https://image.tmdb.org/first.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).not.toHaveAttribute('decoding', 'sync');
  });

  it('shows an image seen before at once, without a blank frame', async () => {
    const first = renderImage('https://image.tmdb.org/seen.jpg');
    await act(async () => {
      fireEvent.load(first);
    });

    const returning = renderImage('https://image.tmdb.org/seen.jpg');
    expect(returning).toHaveAttribute('loading', 'eager');
    expect(returning).toHaveAttribute('decoding', 'sync');
  });

  it('forgets the oldest images once it remembers too many', async () => {
    const images = [
      renderImage('https://image.tmdb.org/oldest.jpg'),
      ...Array.from({ length: 200 }, (_, index) =>
        renderImage(`https://image.tmdb.org/newer-${index}.jpg`),
      ),
    ];
    await act(async () => {
      images.forEach((image) => fireEvent.load(image));
    });

    expect(renderImage('https://image.tmdb.org/oldest.jpg')).toHaveAttribute('loading', 'lazy');
    expect(renderImage('https://image.tmdb.org/newer-199.jpg')).toHaveAttribute('loading', 'eager');
  });

  it('lets the browser pick a width from the offered sources', () => {
    const image = render(
      <ReturningImage
        unoptimized
        src="https://image.tmdb.org/t/p/w342/poster.jpg"
        srcSet="https://image.tmdb.org/t/p/w154/poster.jpg 154w"
        sizes="96px"
        alt=""
        width={96}
        height={144}
      />,
    ).container.querySelector('img')!;

    expect(image).toHaveAttribute('srcset', 'https://image.tmdb.org/t/p/w154/poster.jpg 154w');
    expect(image).toHaveAttribute('sizes', '96px');
  });
});
