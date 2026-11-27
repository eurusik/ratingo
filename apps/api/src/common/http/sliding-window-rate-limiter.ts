function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SlidingWindowRateLimiter {
  private readonly recentStarts: number[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  acquire(): Promise<void> {
    const slot = this.queue.then(() => this.waitForSlot());
    this.queue = slot;
    return slot;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.forgetStartsBefore(now - this.windowMs);
      if (this.recentStarts.length < this.maxRequests) {
        this.recentStarts.push(now);
        return;
      }
      await wait(this.recentStarts[0] + this.windowMs - now);
    }
  }

  private forgetStartsBefore(cutoff: number): void {
    while (this.recentStarts.length > 0 && this.recentStarts[0] <= cutoff) {
      this.recentStarts.shift();
    }
  }
}
