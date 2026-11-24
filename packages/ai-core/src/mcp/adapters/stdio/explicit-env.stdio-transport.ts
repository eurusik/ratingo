import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/client';
import type { JSONRPCMessage, Transport } from '@modelcontextprotocol/client';

const STDERR_TAIL_CHARS = 2_000;
const KILL_GRACE_MS = 2_000;

export interface ExplicitEnvLaunch {
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
}

export class StdioProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StdioProcessError';
  }
}

export class ExplicitEnvStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private child: ChildProcess | undefined;
  private readonly buffer = new ReadBuffer();
  private stderr = '';
  private readonly killOnExit = () => this.child?.kill('SIGKILL');

  constructor(private readonly launch: ExplicitEnvLaunch) {}

  get stderrTail(): string {
    return this.stderr;
  }

  start(): Promise<void> {
    if (this.child !== undefined) {
      return Promise.reject(new StdioProcessError('stdio transport already started'));
    }
    return new Promise((resolve, reject) => {
      const child = spawn(this.launch.command, [...this.launch.args], {
        env: { ...this.launch.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
      this.child = child;
      process.once('exit', this.killOnExit);
      child.on('error', reject);
      child.once('spawn', () => resolve());
      this.listenTo(child);
    });
  }

  send(message: JSONRPCMessage): Promise<void> {
    const stdin = this.child?.stdin;
    if (stdin === undefined || stdin === null || stdin.destroyed) {
      return Promise.reject(new StdioProcessError('stdio transport is not connected'));
    }
    return new Promise((resolve, reject) => {
      if (stdin.write(serializeMessage(message))) {
        resolve();
        return;
      }
      const settle = (outcome: () => void) => () => {
        stdin.off('drain', onDrain);
        stdin.off('close', onClose);
        outcome();
      };
      const onDrain = settle(resolve);
      const onClose = settle(() =>
        reject(new StdioProcessError('stdin closed before the message was sent')),
      );
      stdin.once('drain', onDrain);
      stdin.once('close', onClose);
    });
  }

  async close(): Promise<void> {
    const child = this.child;
    if (child === undefined) {
      return;
    }
    const exited = new Promise<void>((resolve) => child.once('close', () => resolve()));
    child.stdin?.end();
    child.kill('SIGTERM');
    const forceKill = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
    forceKill.unref();
    await exited;
    clearTimeout(forceKill);
  }

  private listenTo(child: ChildProcess): void {
    const forwardError = (error: Error) => this.onerror?.(error);
    child.on('error', forwardError);
    child.once('close', () => this.handleClose());
    child.stdout?.on('data', (chunk: Buffer) => this.receive(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.keepStderr(chunk));
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      stream?.on('error', forwardError);
    }
  }

  private receive(chunk: Buffer): void {
    try {
      this.buffer.append(chunk);
      for (
        let message = this.buffer.readMessage();
        message !== null;
        message = this.buffer.readMessage()
      ) {
        this.onmessage?.(message);
      }
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new StdioProcessError('unreadable message'));
    }
  }

  private keepStderr(chunk: Buffer): void {
    this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-STDERR_TAIL_CHARS);
  }

  private handleClose(): void {
    process.removeListener('exit', this.killOnExit);
    this.child = undefined;
    this.buffer.clear();
    this.onclose?.();
  }
}
