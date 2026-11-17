import { identifyClarityUser, identifyUser, setUserProperties, track } from './track';

describe('track', () => {
  afterEach(() => {
    delete window.gtag;
  });

  it('does nothing when Google Analytics is not loaded', () => {
    expect(() => track('share', { result: 'copied' })).not.toThrow();
  });

  it('sends the event with booleans as strings and without empty params', () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    track('rate_title', { rating: null, media_type: 'movie' });
    track('open_title', { source: 'search', media_type: 'show', in_catalog: false });

    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'rate_title', { media_type: 'movie' });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'open_title', {
      source: 'search',
      media_type: 'show',
      in_catalog: 'false',
    });
  });

  it('cuts long text to 100 characters', () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    track('search_no_results', { search_term: 'x'.repeat(300), filter: 'all' });

    expect(gtag.mock.calls[0][2].search_term).toHaveLength(100);
  });

  it('swallows errors thrown by gtag', () => {
    window.gtag = () => {
      throw new Error('blocked');
    };

    expect(() => track('share', { result: 'shared' })).not.toThrow();
  });
});

describe('identifyUser', () => {
  afterEach(() => {
    delete window.gtag;
  });

  it('sets the user id and logged-in property', () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    identifyUser('user-1');
    identifyUser(null);

    expect(gtag).toHaveBeenCalledWith('set', { user_id: 'user-1' });
    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { logged_in: 'true' });
    expect(gtag).toHaveBeenCalledWith('set', { user_id: null });
    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { logged_in: 'false' });
  });
});

describe('setUserProperties', () => {
  afterEach(() => {
    delete window.gtag;
  });

  it('sets the given user properties', () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    setUserProperties({ library_size: '3-9' });

    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { library_size: '3-9' });
  });
});

describe('identifyClarityUser', () => {
  afterEach(() => {
    delete window.clarity;
  });

  it('passes only the user id to Clarity', () => {
    window.clarity = jest.fn();

    identifyClarityUser('user-uuid');

    expect(window.clarity).toHaveBeenCalledWith('identify', 'user-uuid');
  });

  it('does nothing when Clarity is not loaded', () => {
    expect(() => identifyClarityUser('user-uuid')).not.toThrow();
  });
});
