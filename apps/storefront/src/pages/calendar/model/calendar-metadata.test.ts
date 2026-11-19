import { calendarMetadata } from './calendar-metadata';

describe('calendarMetadata', () => {
  it('keeps the show calendar canonical on the bare route', () => {
    expect(calendarMetadata('uk', 'show').alternates?.canonical).toBe('/calendar');
  });

  it('gives the movie calendar its own canonical', () => {
    const metadata = calendarMetadata('uk', 'movie');

    expect(metadata.alternates?.canonical).toBe('/calendar?type=movie');
    expect(metadata.openGraph?.url).toBe('/calendar?type=movie');
  });
});
