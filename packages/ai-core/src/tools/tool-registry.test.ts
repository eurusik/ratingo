import { z } from 'zod';
import { defineTool } from './define-tool';
import { REDACTION_PLACEHOLDER } from './redact';
import { NativeToolSource } from './sources/native.tool-source';
import {
  DuplicateToolError,
  TRUNCATION_MARKER,
  ToolRegistry,
  UnknownToolError,
  WriteToolNotAllowedError,
  sanitizeToolOutput,
} from './tool-registry';
import type { Tool } from './define-tool';

const context = { runId: 'run-1' };

const lookup = defineTool({
  name: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ query: z.string() }),
  readOnly: true,
  handler: ({ query }) => Promise.resolve(`result for ${query}`),
});

const dangerous = defineTool({
  name: 'delete_everything',
  description: 'Must never be offered',
  inputSchema: z.object({}),
  readOnly: false,
  handler: () => Promise.resolve('deleted'),
});

const registryOf = (tools: Tool[], allowlist: string[]) =>
  ToolRegistry.create([new NativeToolSource(tools)], allowlist);

const call = (name: string, input: unknown) => ({ id: `call-${name}`, name, input });

describe('ToolRegistry', () => {
  it('offers only allowlisted tools', async () => {
    const registry = await registryOf([lookup, dangerous], ['lookup']);

    expect(registry.definitions().map((definition) => definition.name)).toEqual(['lookup']);
  });

  it('denies a call to a tool outside the allowlist', async () => {
    const registry = await registryOf([lookup, dangerous], ['lookup']);

    const result = await registry.execute(call('delete_everything', {}), context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('not allowed');
  });

  it('denies a call to a tool no source knows', async () => {
    const registry = await registryOf([lookup], ['lookup']);

    const result = await registry.execute(call('shell', { command: 'ls' }), context);

    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('not allowed'),
    });
  });

  it('fails fast when the manifest lists a tool nobody provides', async () => {
    await expect(registryOf([lookup], ['lookup', 'ghost'])).rejects.toBeInstanceOf(
      UnknownToolError,
    );
  });

  it('skips an optional tool nobody provides and reports it', async () => {
    const registry = await ToolRegistry.create(
      [new NativeToolSource([lookup])],
      ['lookup', 'ga__run_report'],
      {
        optionalTools: ['ga__run_report'],
      },
    );

    expect(registry.definitions().map((definition) => definition.name)).toEqual(['lookup']);
    expect(registry.unavailableTools()).toEqual(['ga__run_report']);
  });

  it('refuses to allowlist a write tool unless writes are enabled', async () => {
    const sources = [new NativeToolSource([dangerous])];

    await expect(ToolRegistry.create(sources, ['delete_everything'])).rejects.toBeInstanceOf(
      WriteToolNotAllowedError,
    );
    await expect(
      ToolRegistry.create(sources, ['delete_everything'], { allowWriteTools: true }),
    ).resolves.toBeDefined();
  });

  it('fails fast when two sources provide the same tool', async () => {
    await expect(
      ToolRegistry.create(
        [new NativeToolSource([lookup]), new NativeToolSource([lookup])],
        ['lookup'],
      ),
    ).rejects.toBeInstanceOf(DuplicateToolError);
  });

  it('returns the tool output with the call id', async () => {
    const registry = await registryOf([lookup], ['lookup']);

    await expect(registry.execute(call('lookup', { query: 'x' }), context)).resolves.toEqual({
      callId: 'call-lookup',
      content: 'result for x',
      isError: false,
    });
  });

  it('turns invalid input into an error result instead of throwing', async () => {
    const registry = await registryOf([lookup], ['lookup']);

    const result = await registry.execute(call('lookup', { query: 1 }), context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('query');
  });

  it('turns a handler failure into an error result and redacts it', async () => {
    const failing = defineTool({
      name: 'failing',
      description: 'Always fails',
      inputSchema: z.object({}),
      readOnly: true,
      handler: () => Promise.reject(new Error('upstream said Bearer abcdefghijklmnop1234')),
    });
    const registry = await registryOf([failing], ['failing']);

    const result = await registry.execute(call('failing', {}), context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain(REDACTION_PLACEHOLDER);
    expect(result.content).not.toContain('abcdefghijklmnop1234');
  });

  it('redacts secrets in successful output', async () => {
    const leaky = defineTool({
      name: 'leaky',
      description: 'Returns a secret',
      inputSchema: z.object({}),
      readOnly: true,
      handler: () => Promise.resolve('token=supersecretvalue and jane@example.com'),
    });
    const registry = await registryOf([leaky], ['leaky']);

    const result = await registry.execute(call('leaky', {}), context);

    expect(result.content).not.toContain('supersecretvalue');
    expect(result.content).not.toContain('jane@example.com');
  });

  it('caps long output with a truncation marker', async () => {
    const verbose = defineTool({
      name: 'verbose',
      description: 'Long output',
      inputSchema: z.object({}),
      readOnly: true,
      maxOutputChars: 20,
      handler: () => Promise.resolve('x'.repeat(500)),
    });
    const registry = await registryOf([verbose], ['verbose']);

    const result = await registry.execute(call('verbose', {}), context);

    expect(result.content).toBe(`${'x'.repeat(20)}${TRUNCATION_MARKER}`);
  });
});

describe('sanitizeToolOutput', () => {
  it('redacts secrets and cuts what is over the tool cap with the marker', () => {
    const tool = { maxOutputChars: 40 };

    expect(sanitizeToolOutput(tool, 'short')).toBe('short');
    expect(sanitizeToolOutput(tool, 'x'.repeat(100))).toBe(`${'x'.repeat(40)}${TRUNCATION_MARKER}`);
    expect(
      sanitizeToolOutput(tool, 'Authorization: Bearer abcdef1234567890abcdef1234567890'),
    ).not.toContain('abcdef1234567890');
  });
});
