import fc from 'fast-check';
import { z } from 'zod';
import { defineTool } from './define-tool';
import { RowList } from './row-list';
import { NativeToolSource } from './sources/native.tool-source';
import { ToolRegistry } from './tool-registry';
import { RepeatGuard, RepeatReason, callKey } from './repeat-guard';

const context = { runId: 'run-1' };
const call = (name: string, input: unknown, id = 'call-1') => ({ id, name, input });

const countingTool = (name: string, behaviour: (query: string) => unknown) => {
  const calls: string[] = [];
  const tool = defineTool({
    name,
    description: 'test tool',
    inputSchema: z.object({ query: z.string() }),
    readOnly: true,
    handler: ({ query }) => {
      calls.push(query);
      const outcome = behaviour(query);
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
    },
  });
  return { tool, calls };
};

const registryOf = (tool: ReturnType<typeof countingTool>['tool'], guard: boolean) =>
  ToolRegistry.create([new NativeToolSource([tool])], [tool.name], {
    guardRepeatedCalls: guard,
  });

describe('ToolRegistry repeated-call guard', () => {
  it('does not run a call again after it failed and returns the earlier error with a note', async () => {
    const { tool, calls } = countingTool('read', () => new Error('file is missing'));
    const registry = await registryOf(tool, true);

    const first = await registry.execute(call('read', { query: 'a' }), context);
    const second = await registry.execute(call('read', { query: 'a' }, 'call-2'), context);

    expect(calls).toEqual(['a']);
    expect(first.isError).toBe(true);
    expect(second).toMatchObject({ callId: 'call-2', isError: true });
    expect(second.content).toContain('already failed');
    expect(second.content).toContain('file is missing');
  });

  it('does not run a call again after it returned nothing and keeps it a normal result', async () => {
    const { tool, calls } = countingTool('search', () => RowList.of([], 'narrow the filter'));
    const registry = await registryOf(tool, true);

    await registry.execute(call('search', { query: 'a' }), context);
    const second = await registry.execute(call('search', { query: 'a' }, 'call-2'), context);

    expect(calls).toEqual(['a']);
    expect(second.isError).toBe(false);
    expect(second.content).toContain('already returned nothing');
  });

  it('runs the same call again when it returned data', async () => {
    const { tool, calls } = countingTool('search', () => ({ rows: [1] }));
    const registry = await registryOf(tool, true);

    await registry.execute(call('search', { query: 'a' }), context);
    await registry.execute(call('search', { query: 'a' }, 'call-2'), context);

    expect(calls).toEqual(['a', 'a']);
  });

  it('runs a different input and the same input in another run', async () => {
    const { tool, calls } = countingTool('read', () => new Error('nope'));
    const registry = await registryOf(tool, true);

    await registry.execute(call('read', { query: 'a' }), context);
    await registry.execute(call('read', { query: 'b' }), context);
    await registry.execute(call('read', { query: 'a' }), { runId: 'run-2' });

    expect(calls).toEqual(['a', 'b', 'a']);
  });

  it('leaves every call alone when the guard is not enabled', async () => {
    const { tool, calls } = countingTool('read', () => new Error('nope'));
    const registry = await registryOf(tool, false);

    await registry.execute(call('read', { query: 'a' }), context);
    await registry.execute(call('read', { query: 'a' }), context);

    expect(calls).toEqual(['a', 'a']);
  });
});

describe('callKey', () => {
  it('ignores the order of object keys at any depth', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (input) => {
        const reversed = Object.fromEntries(Object.entries(input).reverse());
        expect(callKey('tool', reversed)).toBe(callKey('tool', input));
      }),
    );
  });

  it('separates different tools and different inputs', () => {
    expect(callKey('a', { x: 1 })).not.toBe(callKey('b', { x: 1 }));
    expect(callKey('a', { x: 1 })).not.toBe(callKey('a', { x: 2 }));
  });
});

describe('RepeatGuard', () => {
  it('forgets the oldest run when too many runs are tracked', () => {
    const guard = new RepeatGuard();
    const remembered = { reason: RepeatReason.FAILED, content: 'x' };

    for (let index = 0; index < 70; index += 1) {
      guard.remember(`run-${index}`, 'key', remembered);
    }

    expect(guard.recall('run-0', 'key')).toBeUndefined();
    expect(guard.recall('run-69', 'key')).toEqual(remembered);
  });
});
