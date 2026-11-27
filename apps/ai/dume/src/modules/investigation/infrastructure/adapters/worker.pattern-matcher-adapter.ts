import { Worker } from 'node:worker_threads';

import type {
  MatchOutcome,
  PatternMatcherPort,
  PatternSession,
} from '../../domain/ports/pattern-matcher.port';
import { SearchMode, type CompiledPattern } from '../../domain/policies/search-pattern';
import { InProcessPatternSession } from './in-process.pattern-matcher-adapter';

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const expression = new RegExp(workerData.source, workerData.flags);
parentPort.on('message', (lines) => {
  const indices = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (expression.test(lines[index])) indices.push(index);
  }
  parentPort.postMessage(indices);
});
`;

class WorkerPatternSession implements PatternSession {
  private worker: Worker | undefined;
  private killed = false;

  constructor(private readonly pattern: CompiledPattern) {}

  match(lines: readonly string[], timeoutMs: number): Promise<MatchOutcome> {
    if (this.killed || timeoutMs <= 0) return Promise.resolve({ timedOut: true });
    const worker = this.start();
    return new Promise<MatchOutcome>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.kill();
        resolve({ timedOut: true });
      }, timeoutMs);
      const finish = (settle: () => void): void => {
        clearTimeout(timer);
        worker.removeAllListeners('message');
        worker.removeAllListeners('error');
        settle();
      };
      worker.once('message', (indices: number[]) =>
        finish(() => resolve({ timedOut: false, indices })),
      );
      worker.once('error', (error) => finish(() => reject(error)));
      worker.postMessage(lines);
    });
  }

  async close(): Promise<void> {
    this.kill();
  }

  private start(): Worker {
    this.worker ??= new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { source: this.pattern.source, flags: this.pattern.flags },
    });
    return this.worker;
  }

  private kill(): void {
    this.killed = true;
    void this.worker?.terminate();
    this.worker = undefined;
  }
}

export class WorkerPatternMatcher implements PatternMatcherPort {
  open(pattern: CompiledPattern): PatternSession {
    return pattern.mode === SearchMode.REGEX
      ? new WorkerPatternSession(pattern)
      : new InProcessPatternSession(pattern);
  }
}
