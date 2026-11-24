import { loggedToolCalls } from './logged-tool-calls';

describe('loggedToolCalls', () => {
  it('keeps the tool name and the arguments as JSON', () => {
    expect(
      loggedToolCalls([
        {
          tool: 'google-analytics__run_report',
          input: { dimensions: ['date'], metrics: ['activeUsers'] },
        },
      ]),
    ).toEqual([
      {
        tool: 'google-analytics__run_report',
        input: '{"dimensions":["date"],"metrics":["activeUsers"]}',
      },
    ]);
  });

  it('redacts secrets, caps each input and keeps at most twelve calls', () => {
    const calls = Array.from({ length: 20 }, (_, index) => ({
      tool: `tool_${index}`,
      input: { note: `token=supersecretvalue ${'x'.repeat(2_000)}` },
    }));

    const logged = loggedToolCalls(calls);

    expect(logged).toHaveLength(12);
    expect(logged[0]?.input).not.toContain('supersecretvalue');
    expect(logged[0]?.input.length).toBeLessThanOrEqual(600);
  });
});
