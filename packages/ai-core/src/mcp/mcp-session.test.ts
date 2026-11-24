import { FixedClock } from '../clock/fixed.clock';
import { McpServerUnavailableError, McpUnavailableReason } from './mcp-call.errors';
import { McpSession } from './mcp-session';
import { McpServerEvent } from './mcp-telemetry.port';
import { McpConnectionClosedError } from './mcp-transport.port';
import type { McpConnection, McpTransport } from './mcp-transport.port';
import { RecordingMcpTelemetry, fakeServerDefinition } from './testing/fake-mcp-server.definition';

const COOLDOWN_MS = 30_000;

class ScriptedConnection implements McpConnection {
  isOpen = true;
  private listeners: Array<() => void> = [];

  constructor(private readonly crashOnCall: boolean) {}

  listTools() {
    return Promise.resolve([{ name: 'echo', inputSchema: { type: 'object' } }]);
  }

  callTool(name: string) {
    if (this.crashOnCall) {
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

  constructor(private readonly plan: Array<'fail' | 'crash' | 'ok'>) {}

  connect(): Promise<McpConnection> {
    const step = this.plan[this.connects] ?? 'ok';
    this.connects += 1;
    return step === 'fail'
      ? Promise.reject(new McpConnectionClosedError('fake'))
      : Promise.resolve(new ScriptedConnection(step === 'crash'));
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

  it('caches tools/list per connection', async () => {
    const transport = new ScriptedTransport([]);
    const session = sessionWith(transport);

    await session.tools();
    await session.tools();

    expect(transport.connects).toBe(1);
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
