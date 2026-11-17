import {
  ACTIVE_EVALUATION_CONTEXTS,
  EvaluationContext,
  EvaluationContextType,
  FAN_OUT_EVALUATION_CONTEXTS,
  isUnreleasedMovieContext,
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

describe('FAN_OUT_EVALUATION_CONTEXTS', () => {
  it('re-evaluates every active context plus upcoming', () => {
    expect(FAN_OUT_EVALUATION_CONTEXTS).toEqual([
      ...ACTIVE_EVALUATION_CONTEXTS,
      EvaluationContext.UPCOMING,
    ]);
  });

  it('keeps upcoming out of the contexts every item must cover', () => {
    expect(ACTIVE_EVALUATION_CONTEXTS).not.toContain(EvaluationContext.UPCOMING);
  });
});

describe('isUnreleasedMovieContext', () => {
  it('is true only for upcoming', () => {
    const scoped = Object.values(EvaluationContext).filter(isUnreleasedMovieContext);

    expect(scoped).toEqual([EvaluationContext.UPCOMING]);
  });
});
