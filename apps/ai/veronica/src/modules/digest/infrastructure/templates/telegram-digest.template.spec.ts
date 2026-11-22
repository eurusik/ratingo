import fc from 'fast-check';

import { DigestLevel } from '../../domain/constants/digest-level.constants';
import {
  THRESHOLDS,
  greenSnapshot,
  healthySite,
  redSnapshot,
  unavailableSnapshot,
} from '../../testing/digest.testing';
import type { Digest, DigestText, Fact } from '../../domain/entities/digest';
import { FactUnit } from '../../domain/entities/digest';
import { measured } from '../../domain/entities/measured';
import { available } from '../../domain/entities/source-reading';
import { evaluateDigest } from '../../domain/rules/evaluate-digest';

import {
  TELEGRAM_MESSAGE_LIMIT,
  TelegramDigestTemplate,
  formatFact,
} from './telegram-digest.template';

const template = new TelegramDigestTemplate();

const allowedTags = /<\/?(b|i|blockquote( expandable)?)>/g;

const hasOnlyAllowedMarkup = (html: string): boolean =>
  !/[<>]/.test(html.replace(allowedTags, '')) && !/&(?!amp;|lt;|gt;)/.test(html);

const render = (digest: Digest, text: DigestText | null = null, cost: number | null = null) =>
  template.render({ digest, text, modelCostUsd: cost });

describe('TelegramDigestTemplate', () => {
  it('renders a green day silently, verdict first', () => {
    const message = render(evaluateDigest(greenSnapshot(), THRESHOLDS));
    expect(message.silent).toBe(true);
    expect(message.html.startsWith('🟢 <b>Усе спокійно')).toBe(true);
    expect(message.html).not.toContain('Що зробити');
    expect(message.html).toContain('<blockquote expandable>');
  });

  it('renders a red day loudly with numbered actions before notes and blocks', () => {
    const message = render(evaluateDigest(redSnapshot(), THRESHOLDS));
    expect(message.silent).toBe(false);
    expect(message.html.startsWith('🔴 <b>Потрібна дія: 3 справи</b>')).toBe(true);
    expect(message.html.indexOf('1. ')).toBeLessThan(message.html.indexOf('Варто знати'));
    expect(message.html.indexOf('Варто знати')).toBeLessThan(message.html.indexOf('👥 Люди'));
    expect(message.html).toContain('нових користувачів: 0 (тиждень тому: 14)');
  });

  it('marks missing sources in the footer and never prints them as zero', () => {
    const message = render(evaluateDigest(unavailableSnapshot(), THRESHOLDS));
    expect(message.html).toContain('⚠️ черги');
    expect(message.html).toContain('⚠️ люди');
    expect(message.html).toContain('<b>⚙️ Черги:</b> немає даних');
  });

  it('uses model wording for actions and the headline when given, and shows the cost', () => {
    const digest = evaluateDigest(redSnapshot(), THRESHOLDS);
    const text: DigestText = {
      headline: 'Ключ TMDB упав',
      adviceById: { 'api-key:TMDB': 'Онови ключ TMDB сьогодні' },
      interesting: 'Тиждень тому було веселіше',
    };
    const html = render(digest, text, 0.0123).html;
    expect(html).toContain('<b>Ключ TMDB упав</b>');
    expect(html).toContain('Онови ключ TMDB сьогодні');
    expect(html).toContain('💡 Тиждень тому було веселіше');
    expect(html).toContain('$0.0123');
  });

  it('falls back to template-only text without a model', () => {
    expect(render(evaluateDigest(redSnapshot(), THRESHOLDS)).html).toContain('без моделі');
  });

  it('puts the site block right after people and before the queues', () => {
    const html = render(evaluateDigest(greenSnapshot(), THRESHOLDS)).html;
    expect(html.indexOf('👥 Люди')).toBeLessThan(html.indexOf('🌐 Сайт'));
    expect(html.indexOf('🌐 Сайт')).toBeLessThan(html.indexOf('⚙️ Черги'));
    expect(html).toContain('✅ сайт');
  });

  it('renders the site facts with units, a decimal share and the missing bot line', () => {
    const html = render(
      evaluateDigest(
        {
          ...greenSnapshot(),
          site: available({
            ...healthySite(),
            serverErrors24h: measured(5, 2),
            requests24h: measured(13500, 12800),
          }),
        },
        THRESHOLDS,
      ),
    ).html;
    expect(html).toContain('запитів до сайту: 13 500 (тиждень тому: 12 800)');
    expect(html).toContain('помилок сервера (5xx): 0');
    expect(html).toContain('p95 відповіді сервера: 170 мс (тиждень тому: 160 мс)');
    expect(html).toContain('пік пам’яті сайту: 250 МБ');
    expect(html).toContain('запитів від ботів: немає даних');
    expect(html).not.toContain('запитів від ботів: 0');
  });

  it('shows small percentages with one decimal and a comma', () => {
    const fact: Fact = { label: 'частка', unit: FactUnit.PERCENT, current: 0.04, baseline: 12.5 };
    expect(formatFact(fact)).toBe('частка: 0% (тиждень тому: 12,5%)');
    expect(formatFact({ ...fact, current: 0.44 })).toBe('частка: 0,4% (тиждень тому: 12,5%)');
  });

  it('formats milliseconds', () => {
    expect(
      formatFact({ label: 'p95', unit: FactUnit.MILLISECONDS, current: 170, baseline: null }),
    ).toBe('p95: 170 мс');
  });

  it('stays within the Telegram limit with the site block for any text lengths', () => {
    const digest = evaluateDigest(greenSnapshot(), THRESHOLDS);
    fc.assert(
      fc.property(fc.string({ maxLength: 600 }), (headline) => {
        const html = render(digest, { headline, adviceById: {} }).html;
        expect(html.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
        expect(hasOnlyAllowedMarkup(html)).toBe(true);
      }),
    );
  });

  it('formats facts with a baseline only when one exists', () => {
    const fact: Fact = { label: 'дій', unit: FactUnit.COUNT, current: 12345, baseline: null };
    expect(formatFact(fact)).toBe('дій: 12 345');
    expect(formatFact({ ...fact, baseline: 9000, unit: FactUnit.HOURS })).toBe(
      'дій: 12 345 год (тиждень тому: 9 000 год)',
    );
  });

  it('renders a missing value as no data, never as zero', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(FactUnit)),
        fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
        (unit, baseline) => {
          const text = formatFact({ label: 'показник', unit, current: null, baseline });
          expect(text).toBe('показник: немає даних');
        },
      ),
    );
  });

  it('words the backup age and the redis memory plainly', () => {
    const html = render(evaluateDigest(greenSnapshot(), THRESHOLDS)).html;
    expect(html).toContain('останній бекап: 6 год тому');
    expect(html).toContain('пам’ять Redis: 9 МБ');
    expect(html).not.toContain('годин тому');
    expect(html).not.toContain('пам’ять Redis: 0');
  });

  it('names the queue block plainly with plain-language lines', () => {
    const html = render(evaluateDigest(greenSnapshot(), THRESHOLDS)).html;
    expect(html).toContain('<b>⚙️ Черги:</b>');
    expect(html).toContain('оброблено в чергах: 2 400 (тиждень тому: 2 200)');
    expect(html).toContain('впало: 0 (тиждень тому: 0)');
    expect(html).toContain('найбільша черга (ingestion), пік: 40 (тиждень тому: 38)');
    expect(html).not.toContain('Завдання');
  });

  it('stays within the Telegram limit and escapes markup for any text', () => {
    const textArb = fc.string({ maxLength: 600 });
    fc.assert(
      fc.property(
        textArb,
        textArb,
        fc.array(fc.string({ maxLength: 400 }), { minLength: 1, maxLength: 40 }),
        (headline, interesting, advice) => {
          const base = evaluateDigest(redSnapshot(), THRESHOLDS);
          const first = base.blocks[1];
          const digest: Digest = {
            ...base,
            level: DigestLevel.ACTION,
            blocks: [
              base.blocks[0] as Digest['blocks'][number],
              {
                ...(first as Digest['blocks'][number]),
                items: advice.map((text, index) => ({
                  id: `item-${index}`,
                  block: 'jobs' as const,
                  level: DigestLevel.ACTION,
                  advice: text,
                  facts: [],
                })),
              },
              ...base.blocks.slice(2),
            ],
          };
          const html = render(digest, { headline, adviceById: {}, interesting }).html;
          expect(html.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
          expect(hasOnlyAllowedMarkup(html)).toBe(true);
        },
      ),
    );
  });

  it('always starts with the verdict emoji of the digest level', () => {
    const emojiByLevel = { action: '🔴', note: '🟡', ok: '🟢' } as const;
    for (const snapshot of [greenSnapshot(), redSnapshot(), unavailableSnapshot()]) {
      const digest = evaluateDigest(snapshot, THRESHOLDS);
      expect(render(digest).html.startsWith(emojiByLevel[digest.level])).toBe(true);
    }
  });

  it('claims model text only when model text was used', () => {
    const digest = evaluateDigest(redSnapshot(), THRESHOLDS);
    expect(render(digest, null, 0.002).html).toContain('без моделі');
    expect(render(digest, null, 0.002).html).not.toContain('$0.0020');
  });

  it('says how many actions were cut when the message is too long', () => {
    const base = evaluateDigest(redSnapshot(), THRESHOLDS);
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `item-${index}`,
      block: 'jobs' as const,
      level: DigestLevel.ACTION,
      advice: 'д'.repeat(320),
      facts: [],
    }));
    const digest: Digest = {
      ...base,
      blocks: [
        ...base.blocks.slice(0, 1),
        { ...(base.blocks[1] as Digest['blocks'][number]), items },
        ...base.blocks.slice(2),
      ],
    };
    const html = render(digest).html;
    const numbered = html.match(/^\d+\. /gm)?.length ?? 0;
    const hidden = Number(/…і ще (\d+)/.exec(html)?.[1] ?? 0);
    expect(hidden).toBeGreaterThan(0);
    const total = digest.blocks
      .flatMap((b) => b.items)
      .filter((item) => item.level === DigestLevel.ACTION).length;
    expect(numbered + hidden).toBe(total);
  });

  it('never splits an emoji when clipping long model text', () => {
    const digest = evaluateDigest(redSnapshot(), THRESHOLDS);
    const headline = '😀'.repeat(400);
    const html = render(digest, { headline, adviceById: {} }).html;
    expect(html).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(html).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});
