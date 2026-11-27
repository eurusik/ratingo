import { pickUkrainianEpisodeTitle, pickUkrainianText } from './episode-text';

describe('pickUkrainianEpisodeTitle', () => {
  it.each([
    ['Зима близько', 'Зима близько'],
    ['  Рейніра Жорстока ', 'Рейніра Жорстока'],
    ['Серце УЧЗ', 'Серце УЧЗ'],
    ['Їжак у тумані', 'Їжак у тумані'],
    ['Ґудзик', 'Ґудзик'],
    ['Подвір’я', 'Подвір’я'],
    ['Серія з сюрпризом', 'Серія з сюрпризом'],
  ])('keeps a real translation %p', (title, expected) => {
    expect(pickUkrainianEpisodeTitle(title)).toBe(expected);
  });

  it.each([
    ['Серія 1'],
    ['серія 12'],
    ['Епізод 3'],
    ['Episode 1'],
    ['1893'],
    [''],
    [null],
    [undefined],
  ])('rejects a placeholder or untranslated title %p', (title) => {
    expect(pickUkrainianEpisodeTitle(title)).toBeNull();
  });
});

describe('pickUkrainianText', () => {
  it('keeps Ukrainian text, trimmed', () => {
    expect(pickUkrainianText(' Джон Сноу вирушає на Стіну. ')).toBe('Джон Сноу вирушає на Стіну.');
  });

  it('keeps Ukrainian text that quotes a Latin name', () => {
    expect(pickUkrainianText('Агент Купер приїжджає до Twin Peaks.')).toBe(
      'Агент Купер приїжджає до Twin Peaks.',
    );
  });

  it.each([
    [''],
    ['   '],
    ['Jon Snow heads to the Wall.'],
    ['The crew meets Ведмідь, a Ukrainian pilot, on the night flight.'],
    [null],
    [undefined],
  ])('rejects empty or English text %p', (text) => {
    expect(pickUkrainianText(text)).toBeNull();
  });

  it.each([
    ['Закрытая школа'],
    ['Как уходили кумиры'],
    ['Её выбор'],
    ['Подъезд'],
    ['Привіт, ёжику'],
    ['Мама мила раму, а Эля читала'],
  ])('rejects Russian text, even with mostly shared letters %p', (text) => {
    expect(pickUkrainianText(text)).toBeNull();
    expect(pickUkrainianEpisodeTitle(text)).toBeNull();
  });
});
