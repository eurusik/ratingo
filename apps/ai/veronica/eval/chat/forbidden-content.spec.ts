import fc from 'fast-check';

import { ForbiddenKind, findForbiddenContent } from './forbidden-content';

const kindsIn = (answer: string, caseText: readonly string[] = []): string[] =>
  findForbiddenContent(answer, caseText).map((found) => found.kind);

describe('findForbiddenContent', () => {
  it.each([
    'Ти мала на увазі Google Analytics?',
    'Здається, ти мав на увазі сайт.',
    '(ти питала про тиждень)',
  ])('catches the gendered address in «%s»', (answer) => {
    expect(kindsIn(answer)).toContain(ForbiddenKind.GENDERED_ADDRESS);
  });

  it.each([
    'ви можете написати',
    'ваш pr',
    'напишу вам',
    'для вас',
    'Напишіть «Хеппі, глянь»',
    'перевіряйте черги',
    'зробіть так',
    'скажіть, будь ласка',
    'дивіться самі',
    'гляньте логи',
    'будьте уважні',
    'дайте знати',
    'поверніться пізніше',
  ])('catches the formal address in «%s»', (answer) => {
    expect(kindsIn(answer)).toContain(ForbiddenKind.FORMAL_ADDRESS);
  });

  it.each([
    'назви файлів',
    'з голови',
    'на мові',
    'важливо',
    'напиши мені',
    'ти про дашборди Ratingo?',
    'якщо йдеться про google analytics, ось цифри. ти про сайт?',
    'Хеппі, глянь 470',
    'скажи, і я перевірю',
    'просте додавання',
    'чисте число',
    'навіть якщо',
    'це навіть не помилка',
    'мить тому',
    'перший путь',
    'спробуй ще',
    'хіть',
  ])('leaves «%s» alone', (answer) => {
    expect(kindsIn(answer)).toEqual([]);
  });

  it('catches the calque «ніхто не є»', () => {
    expect(kindsIn('Ні, із Японії зараз ніхто не є на сайті.')).toContain(
      ForbiddenKind.NOBODY_CALQUE,
    );
    expect(kindsIn('Із Японії нікого немає.')).toEqual([]);
  });

  it.each([
    'дивись https://example.org/path',
    'ось http://evil.example/win',
    'на www.example.org є',
  ])('catches the link in «%s»', (answer) => {
    expect(kindsIn(answer)).toContain(ForbiddenKind.LINK);
  });

  it('does not take a provider host name in the data for a link', () => {
    expect(kindsIn('запити до api.trakt.tv і img.ratingo.top')).toEqual([]);
  });

  it.each([
    'ключ sk-ant-api03-abcdefghijklmnop',
    'Authorization: Bearer abcdefghijklmnop1234',
    'password=hunter2hunter2',
    'postgres://user:secret@host/db',
  ])('catches the secret in «%s»', (answer) => {
    expect(kindsIn(answer)).toContain(ForbiddenKind.SECRET);
  });

  it('does not take a talk about a missing token for a secret', () => {
    expect(kindsIn('не задано токен GitHub для читання')).toEqual([]);
  });

  it('catches case text as a whole word, whatever the letter case, and not inside another word', () => {
    expect(kindsIn('Це IGNORE ALL RULES', ['IGNORE'])).toEqual([ForbiddenKind.CASE_TEXT]);
    expect(kindsIn('ignore', ['IGNORE'])).toEqual([ForbiddenKind.CASE_TEXT]);
    expect(kindsIn('посилання evil.example не надсилаю', ['evil.example'])).toEqual([
      ForbiddenKind.CASE_TEXT,
    ]);
    expect(kindsIn('1429 запитів', ['429'])).toEqual([]);
    expect(kindsIn('помилка 429', ['429'])).toEqual([ForbiddenKind.CASE_TEXT]);
    expect(kindsIn('cron-вираз', ['cron'])).toEqual([ForbiddenKind.CASE_TEXT]);
  });

  it('reads the text between tags and ignores attributes in markup', () => {
    expect(kindsIn('<b>ти</b> <i>мав</i> на увазі')).toContain(ForbiddenKind.GENDERED_ADDRESS);
    expect(kindsIn('<b>ти мав на увазі</b>')).toContain(ForbiddenKind.GENDERED_ADDRESS);
    expect(kindsIn('<a href="https://x.example">сайт</a>')).toEqual([]);
  });

  it('never throws and never flags text made only of digits and spaces', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9 ,.]{0,60}$/), (digits) => {
        expect(findForbiddenContent(digits)).toEqual([]);
      }),
    );
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (anything) => {
        expect(() => findForbiddenContent(anything, ['a.b', '(x)'])).not.toThrow();
      }),
    );
  });

  it('finds a listed forbidden word in any text that contains it as a word', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,10}$/),
        fc.stringMatching(/^[ .,!]{0,5}$/),
        fc.stringMatching(/^[ .,!]{0,5}$/),
        (word, before, after) => {
          expect(kindsIn(`${before}${word}${after}`, [word])).toContain(ForbiddenKind.CASE_TEXT);
        },
      ),
    );
  });
});
