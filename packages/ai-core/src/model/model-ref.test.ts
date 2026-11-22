import {
  EmptyModelAliasError,
  InvalidModelRefError,
  UnknownModelAliasError,
  formatModelRef,
  parseModelRef,
  resolveModelChain,
} from './model-ref';

describe('model refs', () => {
  it('parses provider and model', () => {
    expect(parseModelRef('anthropic:claude-haiku-5-5')).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
    });
  });

  it('keeps colons that belong to the model name', () => {
    expect(parseModelRef('ollama:llama3:8b')).toEqual({ provider: 'ollama', model: 'llama3:8b' });
  });

  it.each(['', 'nomodel', ':model', 'provider:', 'provider:  '])('rejects "%s"', (value) => {
    expect(() => parseModelRef(value)).toThrow(InvalidModelRefError);
  });

  it('round-trips through formatModelRef', () => {
    const ref = { provider: 'stub', model: 'test-model' };
    expect(parseModelRef(formatModelRef(ref))).toEqual(ref);
  });

  describe('resolveModelChain', () => {
    const aliases = {
      fast: ['anthropic:claude-haiku-5-5'],
      review: ['anthropic:claude-sonnet-5-5', 'anthropic:claude-opus-5-5'],
      empty: [],
    };

    it('resolves an alias to its ordered chain', () => {
      expect(resolveModelChain('review', aliases).map(formatModelRef)).toEqual([
        'anthropic:claude-sonnet-5-5',
        'anthropic:claude-opus-5-5',
      ]);
    });

    it('accepts a direct provider:model reference', () => {
      expect(resolveModelChain('stub:test-model', aliases)).toEqual([
        { provider: 'stub', model: 'test-model' },
      ]);
    });

    it('rejects unknown aliases and aliases without models', () => {
      expect(() => resolveModelChain('smart', aliases)).toThrow(UnknownModelAliasError);
      expect(() => resolveModelChain('empty', aliases)).toThrow(EmptyModelAliasError);
    });

    it('surfaces a malformed entry in an alias', () => {
      expect(() => resolveModelChain('bad', { bad: ['no-separator'] })).toThrow(
        InvalidModelRefError,
      );
    });
  });
});
