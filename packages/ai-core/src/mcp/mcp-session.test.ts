import { FixedClock } from '../clock/fixed.clock';
import { McpServerUnavailableError, McpUnavailableReason } from './mcp-call.errors';
import { McpSession } from './mcp-session';
import { McpServerEvent } from './mcp-telemetry.port';
import { McpConnectionClosedError, McpTimeoutError } from './mcp-transport.port';
import type { McpConnection, McpTransport } from './mcp-transport.port';
import { RecordingMcpTelemetry, fakeServerDefinition } from './testing/fake-mcp-server.definition';

const COOLDOWN_MS = 30_000;

type Step = 'fail' | 'crash' | 'hang' | 'truncated' | 'ok';

class ScriptedConnection implements McpConnection {
  isOpen = true;
  private listeners: Array<() => void> = [];

  constructor(private readonly step: Step) {}

  listTools() {
    return Promise.resolve({
      tools: [{ name: 'echo', inputSchema: { type: 'object' } }],
      truncated: this.step === 'truncated',
    });
  }

  callTool(name: string) {
    if (this.step === 'hang') {
      return Promise.reject(new McpTimeoutError('fake', name, 1));
    }
    if (this.step === 'crash') {
      this.isOpen = false;
      this.listeners.forEach((listener) => listener());
      return Promise.reject(new McpConnectionClosedError('fake'));
    }
    return Promise.resolve({ isError: false, text: name });
  }

  onClose(listener: () => void) {
    this.listeners.push(listener);
  }

  close() {
    this.isOpen = false;
    return Promise.resolve();
  }
}

class ScriptedTransport implements McpTransport {
  connects = 0;

  constructor(private readonly plan: Step[]) {}

  connect(): Promise<McpConnection> {
    const step = this.plan[this.connects] ?? 'ok';
    this.connects += 1;
    return step === 'fail'
      ? Promise.reject(new McpConnectionClosedError('fake'))
      : Promise.resolve(new ScriptedConnection(step));
  }
}

describe('McpSession', () => {
  let clock: FixedClock;
  let telemetry: RecordingMcpTelemetry;

  const sessionWith = (transport: McpTransport) =>
    new McpSession(
      {
        definition: fakeServerDefinition({ restartCooldownMs: COOLDOWN_MS }),
        env: { FAKE_TOKEN: 'x' },
      },
      { transport, clock, telemetry },
    );

  beforeEach(() => {
    clock = new FixedClock(1_000);
    telemetry = new RecordingMcpTelemetry();
  });

  it('does not start a process until the first use', async () => {
    const transport = new ScriptedTransport([]);
    const session = sessionWith(transport);

    expect(transport.connects).toBe(0);
    await session.call('echo', {});
    expect(transport.connects).toBe(1);
    await session.close();
  });

  it('keeps the tool listing after the connection is gone', async () => {
    const transport = new ScriptedTransport(['crash']);
    const session = sessionWith(transport);

    await session.tools();
    await session.call('echo', {});
    await session.tools();

    expect(transport.connects).toBe(2);
    await session.close();
  });

  it('reports a truncated tool listing', async () => {
    const session = sessionWith(new ScriptedTransport(['truncated']));

    await session.tools();

    expect(telemetry.eventNames()).toContain(McpServerEvent.TOOL_LIST_TRUNCATED);
    await session.close();
  });

  it('replaces a server that timed out with a fresh process on the next call', async () => {
    const transport = new ScriptedTransport(['hang', 'ok']);
    const session = sessionWith(transport);

    await expect(session.call('echo', {})).rejects.toBeInstanceOf(McpTimeoutError);
    await expect(session.call('echo', {})).resolves.toEqual({ isError: false, text: 'echo' });

    expect(transport.connects).toBe(2);
    expect(telemetry.eventNames()).toContain(McpServerEvent.RECYCLED_AFTER_TIMEOUT);
    await session.close();
  });

  it('cools down after a failed start instead of retrying every call', async () => {
    const transport = new ScriptedTransport(['fail']);
    const session = sessionWith(transport);

    await expect(session.call('echo', {})).rejects.toMatchObject({
      reason: McpUnavailableReason.START_FAILED,
    });
    await expect(session.call('echo', {})).rejects.toMatchObject({
      reason: McpUnavailableReason.COOLING_DOWN,
    });
    expect(transport.connects).toBe(1);

    clock.advance(COOLDOWN_MS);
    await expect(session.call('echo', {})).resolves.toEqual({ isError: false, text: 'echo' });
    expect(telemetry.eventNames()).toEqual([McpServerEvent.START_FAILED, McpServerEvent.STARTED]);
    await session.close();
  });

  it('restarts once after a crash and gives up if the retry crashes too', async () => {
    const transport = new ScriptedTransport(['crash', 'crash']);
    const session = sessionWith(transport);

    const failure = await session.call('echo', {}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(McpServerUnavailableError);
    expect(failure).toMatchObject({ reason: McpUnavailableReason.CRASHED });
    expect(transport.connects).toBe(2);
    expect(telemetry.eventNames()).toEqual([
      McpServerEvent.STARTED,
      McpServerEvent.CRASHED,
      McpServerEvent.RESTARTED,
      McpServerEvent.CRASHED,
    ]);
    await session.close();
  });

  it('answers after a single crash by restarting', async () => {
    const transport = new ScriptedTransport(['crash', 'ok']);
    const session = sessionWith(transport);

    await expect(session.call('echo', {})).resolves.toEqual({ isError: false, text: 'echo' });
    await session.close();
  });

  it('refuses work after close', async () => {
    const session = sessionWith(new ScriptedTransport([]));
    await session.close();

    await expect(session.call('echo', {})).rejects.toMatchObject({
      reason: McpUnavailableReason.SHUT_DOWN,
    });
  });
});
