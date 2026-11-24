import { SystemClock } from '../clock/system.clock';
import { ToolRegistry } from '../tools/tool-registry';
import { StdioMcpTransport } from './adapters/stdio/stdio.mcp-transport';
import { McpGateway } from './mcp-gateway';
import type { McpServerDefinition, McpServerTimeouts } from './mcp-server.definition';
import { McpServerRegistry } from './mcp-server.registry';
import type { McpEnvValues } from './mcp-server.registry';
import { McpCallOutcome, McpServerEvent } from './mcp-telemetry.port';
import {
  FAKE_OUTPUT_CAP,
  FAKE_PINNED_PROPERTY,
  RecordingMcpTelemetry,
  fakeServerDefinition,
} from './testing/fake-mcp-server.definition';

jest.setTimeout(30_000);

const context = { runId: 'run-1' };
const CONFIGURED_ENV: McpEnvValues = { FAKE_TOKEN: 'fake-token-value' };
const IDLE_TTL_MS = 300;
const IDLE_WAIT_MS = 1_500;
const OS_INJECTED_ENV_KEYS: ReadonlySet<string> = new Set(['__CF_USER_TEXT_ENCODING']);

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitFor = async (condition: () => boolean, timeoutMs: number): Promise<void> => {
  const started = Date.now();
  while (!condition() && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('McpGateway over stdio', () => {
  let gateways: McpGateway[];
  let telemetry: RecordingMcpTelemetry;

  const gatewayFor = (
    env: McpEnvValues = CONFIGURED_ENV,
    timeouts: Partial<McpServerTimeouts> = {},
    definition: McpServerDefinition = fakeServerDefinition(timeouts),
  ): McpGateway => {
    const gateway = new McpGateway({
      registry: new McpServerRegistry([definition]),
      servers: ['fake'],
      env,
      transport: new StdioMcpTransport(),
      clock: new SystemClock(),
      telemetry,
    });
    gateways.push(gateway);
    return gateway;
  };

  const registryFor = async (gateway: McpGateway): Promise<ToolRegistry> => {
    const source = gateway.toolSource();
    const names = (await source.listTools()).map((tool) => tool.name);
    return ToolRegistry.create([source], names);
  };

  const call = (registry: ToolRegistry, name: string, input: unknown = {}) =>
    registry.execute({ id: `call-${name}`, name, input }, context);

  beforeEach(() => {
    gateways = [];
    telemetry = new RecordingMcpTelemetry();
  });

  afterEach(async () => {
    await Promise.all(gateways.map((gateway) => gateway.close()));
  });

  it('offers only allowlisted read-only tools under the server prefix', async () => {
    const registry = await registryFor(gatewayFor());
    const names = registry.definitions().map((definition) => definition.name);

    expect(names.sort()).toEqual(
      ['crash', 'echo', 'env_keys', 'fail', 'huge', 'inject', 'pid', 'report', 'slow'].map(
        (tool) => `fake__${tool}`,
      ),
    );
    expect(telemetry.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: McpServerEvent.TOOL_NOT_READ_ONLY,
          detail: 'delete_everything',
        }),
        expect.objectContaining({ event: McpServerEvent.TOOL_MISSING, detail: 'missing_tool' }),
      ]),
    );
  });

  it('reports a policy mismatch once per connection, not on every run', async () => {
    const source = gatewayFor().toolSource();

    await source.listTools();
    await source.listTools();

    const missing = telemetry.events.filter(
      (record) => record.event === McpServerEvent.TOOL_MISSING,
    );
    expect(missing).toHaveLength(1);
  });

  it('shows the policy description and hides pinned arguments from the schema', async () => {
    const registry = await registryFor(gatewayFor());
    const report = registry.definitions().find((definition) => definition.name === 'fake__report');

    expect(report?.description).toBe('Run a report.');
    expect(report?.inputSchema.properties).not.toHaveProperty('property_id');
    expect(report?.inputSchema.required).not.toContain('property_id');
    expect(report?.inputSchema.properties).toMatchObject({
      dimensions: { items: { enum: ['date', 'country'] } },
      limit: { maximum: 50 },
    });
  });

  it('denies a tool that is not on the allowlist', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__admin_secret');

    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('not allowed'),
    });
  });

  it('wraps successful output as untrusted data', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__echo', { text: 'hello' });

    expect(result.isError).toBe(false);
    expect(result.content).toBe('<untrusted label="mcp fake__echo">\nhello\n</untrusted>');
    expect(telemetry.calls).toContainEqual(
      expect.objectContaining({ server: 'fake', tool: 'echo', outcome: McpCallOutcome.OK }),
    );
  });

  it('injects pinned arguments and defaults the model cannot override', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__report', {
      property_id: '999',
      dimensions: ['date'],
    });

    const received = JSON.parse(result.content.split('\n')[1] ?? '{}');
    expect(received).toEqual({
      property_id: FAKE_PINNED_PROPERTY,
      limit: 10,
      dimensions: ['date'],
    });
  });

  it('refuses a call that breaks a constraint without reaching the server', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__report', { dimensions: ['date'], limit: 500 });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content)).toMatchObject({
      status: 'refused',
      code: 'out_of_range',
      argument: 'limit',
    });
    expect(telemetry.calls).toContainEqual(
      expect.objectContaining({ tool: 'report', outcome: McpCallOutcome.REFUSED }),
    );
  });

  it('turns a slow call into an honest unavailable result and keeps working', async () => {
    const registry = await registryFor(gatewayFor());

    const slow = await call(registry, 'fake__slow', { ms: 5_000 });
    const after = await call(registry, 'fake__echo', { text: 'still here' });

    expect(slow.isError).toBe(true);
    expect(JSON.parse(slow.content)).toMatchObject({ status: 'unavailable', reason: 'timeout' });
    expect(after.content).toContain('still here');
    expect(telemetry.calls).toContainEqual(
      expect.objectContaining({ tool: 'slow', outcome: McpCallOutcome.TIMEOUT }),
    );
  });

  it('survives a crash mid-call and restarts for the next call', async () => {
    const registry = await registryFor(gatewayFor());

    const crashed = await call(registry, 'fake__crash');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const after = await call(registry, 'fake__echo', { text: 'back' });

    expect(crashed.isError).toBe(true);
    expect(JSON.parse(crashed.content)).toMatchObject({ status: 'unavailable', reason: 'crashed' });
    expect(after.content).toContain('back');
    expect(telemetry.eventNames()).toEqual(
      expect.arrayContaining([McpServerEvent.CRASHED, McpServerEvent.RESTARTED]),
    );
  });

  it('caps oversized output inside the untrusted envelope', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__huge', { chars: 50_000 });

    expect(result.content).toContain('x'.repeat(FAKE_OUTPUT_CAP));
    expect(result.content).not.toContain('x'.repeat(FAKE_OUTPUT_CAP + 1));
    expect(result.content).toContain('[output truncated]');
    expect(result.content.endsWith('</untrusted>')).toBe(true);
  });

  it('keeps an injection attempt inside a single untrusted block', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__inject');

    expect(result.content.match(/<\/untrusted>/g)).toHaveLength(1);
    expect(result.content).toContain('<\\/untrusted>');
    expect(result.content.endsWith('</untrusted>')).toBe(true);
  });

  it('reports a tool error as an error result', async () => {
    const registry = await registryFor(gatewayFor());

    const result = await call(registry, 'fake__fail');

    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('quota exhausted'),
    });
    expect(telemetry.calls).toContainEqual(
      expect.objectContaining({ tool: 'fail', outcome: McpCallOutcome.TOOL_ERROR }),
    );
  });

  it('starts the subprocess with only the declared environment', async () => {
    const registry = await registryFor(gatewayFor({ ...CONFIGURED_ENV, UNDECLARED_KEY: 'nope' }));

    const result = await call(registry, 'fake__env_keys');

    const keys: string[] = JSON.parse(result.content.split('\n')[1] ?? '[]');
    expect(keys.filter((key) => !OS_INJECTED_ENV_KEYS.has(key))).toEqual([
      'FAKE_MODE',
      'FAKE_TOKEN',
    ]);
    expect(keys).not.toEqual(expect.arrayContaining(['PATH']));
    expect(keys).not.toEqual(expect.arrayContaining(['HOME']));
  });

  it('registers no tools when required env is missing', async () => {
    const gateway = gatewayFor({});

    await expect(gateway.toolSource().listTools()).resolves.toEqual([]);
    expect(gateway.configuredServers).toEqual([]);
    expect(telemetry.events).toEqual([
      { server: 'fake', event: McpServerEvent.UNCONFIGURED, detail: 'missing env: FAKE_TOKEN' },
    ]);
  });

  it('offers no tools when the server fails to start, with a redacted reason', async () => {
    const gateway = gatewayFor({ ...CONFIGURED_ENV, FAKE_MCP_FAIL_START: '1' });

    await expect(gateway.toolSource().listTools()).resolves.toEqual([]);

    const failure = telemetry.events.find((record) => record.event === McpServerEvent.START_FAILED);
    expect(failure?.detail).toContain('start failed');
    expect(failure?.detail).not.toContain('supersecretvalue');
  });

  it('starts one process for concurrent first calls', async () => {
    const source = gatewayFor().toolSource();

    await Promise.all([source.listTools(), source.listTools(), source.listTools()]);

    expect(telemetry.eventNames().filter((event) => event === McpServerEvent.STARTED)).toHaveLength(
      1,
    );
  });

  it('stops the subprocess on close so no orphan is left', async () => {
    const gateway = gatewayFor();
    const registry = await registryFor(gateway);
    const pid = Number((await call(registry, 'fake__pid')).content.split('\n')[1]);

    expect(isAlive(pid)).toBe(true);
    await gateway.close();

    expect(isAlive(pid)).toBe(false);
  });

  it('stops an idle subprocess and starts it again on the next call', async () => {
    const registry = await registryFor(gatewayFor(CONFIGURED_ENV, { idleTtlMs: IDLE_TTL_MS }));
    const pid = Number((await call(registry, 'fake__pid')).content.split('\n')[1]);

    await waitFor(() => !isAlive(pid), IDLE_WAIT_MS);
    const after = await call(registry, 'fake__echo', { text: 'woke up' });

    expect(isAlive(pid)).toBe(false);
    expect(telemetry.eventNames()).toContain(McpServerEvent.IDLE_STOPPED);
    expect(after.content).toContain('woke up');
  });
});
