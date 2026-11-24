import fc from 'fast-check';

import type { HappyResult } from '../entities/happy';

import { renderHappyResult } from './happy-summary.policy';

const base: HappyResult = {
  kind: 'review',
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
  review: null,
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

  it('shows what changed since the last review after new commits', () => {
    const html = renderHappyResult(470, {
      ...base,
      review: {
        mode: 'incremental',
        baseSha: 'abc1234',
        fullReason: null,
        files: 3,
        statusCounts: { new: 1, stillOpen: 2, resolved: 3, needsRecheck: 0 },
      },
    });
    expect(html).toContain('нові коміти: ✅ 3 виправлено · ⚠️ 2 лишилось · 🆕 1 нових');
    expect(html).not.toContain('не підтверджено');
  });

  it('names the reason of a full review and the progress when there was an earlier review', () => {
    const full = (fullReason: string, resolved: number) =>
      renderHappyResult(470, {
        ...base,
        review: {
          mode: 'full',
          baseSha: null,
          fullReason,
          files: 9,
          statusCounts: { new: 1, stillOpen: 0, resolved, needsRecheck: 2 },
        },
      });
    expect(full('history_rewritten', 1)).toContain('Повне рев’ю: історію гілки переписано.');
    expect(full('history_rewritten', 1)).toContain('від минулого огляду: ✅ 1 виправлено');
    expect(full('history_rewritten', 1)).toContain('❓ 2 не підтверджено');
    expect(full('no_previous', 0)).toContain('попереднього огляду не знайшов');
    expect(full('something_new', 0)).toContain('причину не вказано');
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

  it('explains a release checklist in plain words instead of showing review counts', () => {
    const html = renderHappyResult(474, {
      ...base,
      kind: 'release_checklist',
      status: 'checklist',
      title: 'Список вантажу на виїзд.',
      summary: '',
      counts: { critical: 0, major: 0, minor: 0, nit: 0 },
    });
    expect(html).toContain('Хеппі про PR №474');
    expect(html).toContain('реліз development→main');
    expect(html).toContain('не робить ревʼю коду');
    expect(html).toContain('чекліст');
    expect(html).not.toContain('Зауважень немає');
  });

  it('recognises a release checklist even when its status is unknown', () => {
    const html = renderHappyResult(474, { ...base, kind: 'release_checklist', status: 'unknown' });
    expect(html).toContain('не робить ревʼю коду');
  });
});
