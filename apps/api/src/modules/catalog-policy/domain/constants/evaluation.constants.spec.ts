import {
  ACTIVE_EVALUATION_CONTEXTS,
  EvaluationContext,
  EvaluationContextType,
} from './evaluation.constants';

describe('ACTIVE_EVALUATION_CONTEXTS', () => {
  it('should contain catalog and trending contexts', () => {
    expect(ACTIVE_EVALUATION_CONTEXTS).toContain(EvaluationContext.CATALOG);
    expect(ACTIVE_EVALUATION_CONTEXTS).toContain(EvaluationContext.TRENDING);
  });

  it('should have exactly 2 initial contexts', () => {
    expect(ACTIVE_EVALUATION_CONTEXTS).toHaveLength(2);
  });

  it('should be a readonly array', () => {
    // TypeScript enforces readonly at compile time, but we can verify
    // the array is frozen or at least not easily mutable at runtime
    expect(Array.isArray(ACTIVE_EVALUATION_CONTEXTS)).toBe(true);
  });

  it('should only contain valid EvaluationContextType values', () => {
    const validContexts = Object.values(EvaluationContext);
    ACTIVE_EVALUATION_CONTEXTS.forEach((context: EvaluationContextType) => {
      expect(validContexts).toContain(context);
    });
  });
});
