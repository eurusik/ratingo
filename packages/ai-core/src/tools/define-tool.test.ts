import { z } from 'zod';
import { DEFAULT_TOOL_OUTPUT_CAP_CHARS, ToolInputError, defineTool } from './define-tool';

const context = { runId: 'run-1' };

const echo = defineTool({
  name: 'echo',
  description: 'Echo the text back',
  inputSchema: z.object({ text: z.string(), times: z.number().int().optional() }),
  readOnly: true,
  handler: ({ text, times }) => Promise.resolve(text.repeat(times ?? 1)),
});

describe('defineTool', () => {
  it('exposes a provider-neutral definition', () => {
    expect(echo.definition.name).toBe('echo');
    expect(echo.definition.inputSchema).toMatchObject({ type: 'object' });
    expect(echo.definition.inputSchema).not.toHaveProperty('$schema');
    expect(echo.readOnly).toBe(true);
    expect(echo.maxOutputChars).toBe(DEFAULT_TOOL_OUTPUT_CAP_CHARS);
  });

  it('validates input before the handler runs', async () => {
    await expect(echo.run({ text: 5 }, context)).rejects.toBeInstanceOf(ToolInputError);
  });

  it('runs the handler with parsed input', async () => {
    await expect(echo.run({ text: 'ab', times: 2 }, context)).resolves.toBe('abab');
  });

  it('serializes non-string output as JSON', async () => {
    const tool = defineTool({
      name: 'stats',
      description: 'Stats',
      inputSchema: z.object({}),
      readOnly: true,
      handler: () => Promise.resolve({ waiting: 3 }),
    });
    await expect(tool.run({}, context)).resolves.toBe('{"waiting":3}');
  });

  const smallTool = (readOnly: boolean) =>
    defineTool({
      name: 'small',
      description: 'Small',
      inputSchema: z.object({}),
      readOnly,
      maxOutputChars: 10,
      handler: () => Promise.resolve(''),
    });

  it('honours a custom output cap', () => {
    expect(smallTool(true).maxOutputChars).toBe(10);
  });

  it('carries the readOnly flag', () => {
    expect(smallTool(false).readOnly).toBe(false);
  });
});
