import fc from 'fast-check';

import type { HappyResult } from '../entities/happy';

import { renderHappyResult } from './happy-summary.policy';

const base: HappyResult = {
  status: 'reviewed',
  checkedSha: 'abcdef123456',
  current: true,
  title: 'Затримую на вході: є що виправити.',
  summary: 'Додає оплату.',
  skipReason: null,
  counts: { critical: 0, major: 2, minor: 1, nit: 0 },
  questions: [{ file: 'src/a.ts', line: 4, text: 'Чи це навмисно?' }],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: 'https://github.com/eurusik/ratingo/runs/1',
};

describe('renderHappyResult', () => {
  it('shows the verdict, counts, questions and the link', () => {
    const html = renderHappyResult(470, base);
    expect(html).toContain('Хеппі про PR №470');
    expect(html).toContain('Затримую на вході');
    expect(html).toContain('важливих: 2, дрібних: 1');
    expect(html).toContain('Питання до автора: 1.');
    expect(html).toContain('src/a.ts:4');
    expect(html).toContain('https://github.com/eurusik/ratingo/runs/1');
    expect(html).not.toContain('новіші зміни');
  });

  it('never claims a clean review when coverage is incomplete', () => {
    const html = renderHappyResult(1, {
      ...base,
      counts: { critical: 0, major: 0, minor: 0, nit: 0 },
      coverage: { complete: false, unreviewedFiles: 3, gaps: ['tool_failed'] },
    });
    expect(html).not.toContain('Зауважень немає');
    expect(html).toContain('покриття неповне');
    expect(html).toContain('файлів: 3');
  });

  it('says so when the result is for an older commit', () => {
    expect(renderHappyResult(1, { ...base, current: false })).toContain('abcdef1');
  });

  it('explains a skip, a checklist and an old-format result', () => {
    expect(renderHappyResult(1, { ...base, status: 'skipped', skipReason: 'trivial' })).toContain(
      'дрібні',
    );
    expect(renderHappyResult(1, { ...base, status: 'checklist' })).toContain('реліз-PR');
    expect(renderHappyResult(1, { ...base, status: 'unknown' })).toContain('старому форматі');
  });

  it('drops a link that is not on github.com', () => {
    expect(renderHappyResult(1, { ...base, checkRunUrl: 'https://evil.example/x' })).not.toContain(
      'evil.example',
    );
  });

  it('escapes markup and strips links from model-written text, whatever it is', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const html = renderHappyResult(1, {
          ...base,
          summary: text,
          title: text,
          questions: [{ file: text, line: 1, text }],
        });
        const withoutOurTags = html.replace(/<\/?[bi]>/g, '');
        return !/[<>]/.test(withoutOurTags) && !/https?:\/\/(?!github\.com\/eurusik)/.test(html);
      }),
    );
  });
});
