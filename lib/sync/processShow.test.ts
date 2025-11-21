import { describe, it, expect } from 'vitest';

describe('processShow facade', () => {
  it('exports processShow function', async () => {
    const mod = await import('./processShow');
    expect(typeof mod.processShow).toBe('function');
  });
});
