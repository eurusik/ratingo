import fc from 'fast-check';

import { DUME_MAX_MESSAGES, DUME_MESSAGE_BUDGET_CHARS } from '../constants/dume.constants';
import { DumeFailureReason, DumeSupport, type DumeFact } from '../entities/dume';
import { COMMIT, dumeResult } from '../../testing/dume.testing';

import { dumeMemoryText, renderDumeAnswer, renderDumeFailure } from './dume-message.policy';

const REPOSITORY = 'eurusik/ratingo';
const render = (result = dumeResult()) => renderDumeAnswer(result, REPOSITORY).join('\n---\n');

describe('renderDumeAnswer', () => {
  it('shows the answer, the checked facts with links, the assumptions, the unknowns and the footer', () => {
    const text = render();

    expect(text).toContain('🔎 <b>DUM-E</b>\nThe timeout is set to 10 seconds');
    expect(text).toContain('<b>Перевірені факти</b>');
    expect(text).toContain(
      `<a href="https://github.com/eurusik/ratingo/blob/${COMMIT}/apps/api/src/tmdb/tmdb.client.ts#L10-L14">apps/api/src/tmdb/tmdb.client.ts:10-14</a>`,
    );
    expect(text).toContain('<code>logs_search#2.1</code> TMDB API: Request timeout');
    expect(text).toContain('<b>Припущення (не перевірено)</b>');
    expect(text).toContain(
      'The retry policy hides most of the timeouts. (чому: ці рядки не читали в цьому запуску)',
    );
    expect(text).toContain('<b>Невідомо</b>\n• Whether the provider changed');
    expect(text).toContain(
      '<i>Підтримка: підтверджено частково · коміт aaaaaaa (main) · ходів 7 · $0.08</i>',
    );
  });

  it('writes a citation as plain code when no link can be built from it', () => {
    const result = dumeResult();
    const text = renderDumeAnswer({ ...result, commit: 'local-checkout' }, REPOSITORY).join('');

    expect(text).toContain('<code>apps/api/src/tmdb/tmdb.client.ts:10-14</code>');
    expect(text).not.toContain('<a ');
    expect(text).toContain('коміт local-checkout (main)');
  });

  it('never lets model text add markup or a link of its own', () => {
    const hostile: DumeFact = {
      text: 'See <a href="https://evil.example/x">here</a> and https://evil.example <script>alert(1)</script> & more',
      citations: [],
      evidence: [
        { ref: 'logs_search#1.1', tool: 'logs_search', summary: '<b>x</b> http://evil.example' },
      ],
    };
    const text = render(
      dumeResult({ facts: [hostile], answer: 'Click <a href="https://evil.example">me</a>' }),
    );

    expect(text).not.toContain('evil.example');
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toMatch(/<a href="https:\/\/(?!github\.com)/);
  });

  it('says plainly when there are no verified facts, and still shows the unknowns', () => {
    const text = render(dumeResult({ facts: [], assumptions: [], support: DumeSupport.NO_CLAIMS }));

    expect(text).not.toContain('Перевірені факти');
    expect(text).toContain('перевірених тверджень немає');
    expect(text).toContain('Невідомо');
  });

  it('keeps every message inside the Telegram budget and never drops assumptions or unknowns for facts', () => {
    const fact = (index: number): DumeFact => ({
      text: `fact ${index} ${'x'.repeat(400)}`,
      citations: [1, 2, 3, 4].map((line) => ({
        path: `apps/api/src/file${index}.ts`,
        startLine: line,
        endLine: line + 5,
      })),
      evidence: [1, 2, 3].map((row) => ({
        ref: `logs_search#${index}.${row}`,
        tool: 'logs_search',
        summary: 'y'.repeat(400),
      })),
    });
    const result = dumeResult({
      facts: Array.from({ length: 30 }, (_, index) => fact(index)),
      assumptions: Array.from({ length: 12 }, (_, index) => ({
        text: `assumption ${index} ${'a'.repeat(500)}`,
        origin: 'unverified_claim',
        problems: [{ failure: 'evidence_not_shown' }],
      })),
      unknowns: Array.from({ length: 12 }, (_, index) => `unknown ${index} ${'u'.repeat(500)}`),
    });

    const messages = renderDumeAnswer(result, REPOSITORY);

    expect(messages.length).toBeLessThanOrEqual(DUME_MAX_MESSAGES);
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(DUME_MESSAGE_BUDGET_CHARS);
    }
    const all = messages.join('\n');
    expect(all).toContain('assumption 0');
    expect(all).toContain('unknown 0');
    expect(all).toMatch(/Ще \d+ фактів не вмістилося/);
    expect(all).toContain('Підтримка:');
  });

  it('never splits a tag or a link between two messages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 600 }), { maxLength: 40 }),
        fc.array(fc.string({ maxLength: 600 }), { maxLength: 12 }),
        (texts, unknowns) => {
          const result = dumeResult({
            facts: texts.map((text) => ({
              text,
              citations: [{ path: 'apps/api/src/a.ts', startLine: 1, endLine: 2 }],
              evidence: [],
            })),
            unknowns,
          });
          const messages = renderDumeAnswer(result, REPOSITORY);
          return (
            messages.length <= DUME_MAX_MESSAGES &&
            messages.every((message) => {
              const opened = (message.match(/<(a|b|i|code)\b/g) ?? []).length;
              const closed = (message.match(/<\/(a|b|i|code)>/g) ?? []).length;
              return opened === closed && message.length <= DUME_MESSAGE_BUDGET_CHARS;
            })
          );
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('renderDumeFailure', () => {
  it.each(Object.values(DumeFailureReason))('gives one short honest line for %s', (reason) => {
    const line = renderDumeFailure(reason);

    expect(line.startsWith('🔎 ')).toBe(true);
    expect(line.length).toBeLessThan(160);
    expect(line).not.toContain('\n');
  });
});

describe('dumeMemoryText', () => {
  it('keeps a short link-free form of the answer for the next question', () => {
    const text = dumeMemoryText(
      dumeResult({ answer: `See https://evil.example ${'z'.repeat(1000)}` }),
    );

    expect(text.startsWith('DUM-E: ')).toBe(true);
    expect(text).not.toContain('evil.example');
    expect(text.length).toBeLessThanOrEqual(420);
  });
});
