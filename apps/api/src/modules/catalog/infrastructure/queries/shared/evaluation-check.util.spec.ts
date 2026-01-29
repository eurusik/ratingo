import { checkContextEvaluationsExist } from './evaluation-check.util';
import { EvaluationContext } from '../../../../catalog-policy/public';

// Chainable thenable for Drizzle-like API
const createThenable = (resolveWith: any = []) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'where', 'limit'];
  methods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  return thenable;
};

describe('checkContextEvaluationsExist', () => {
  let db: any;

  const setup = (count: number) => {
    db = {
      select: jest.fn().mockReturnValue(createThenable([{ count }])),
    };
  };

  it('should return true when evaluations exist (count > 0)', async () => {
    setup(10);

    const result = await checkContextEvaluationsExist(db, EvaluationContext.CATALOG);

    expect(result).toBe(true);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should return true when exactly 1 evaluation exists', async () => {
    setup(1);

    const result = await checkContextEvaluationsExist(db, EvaluationContext.TRENDING);

    expect(result).toBe(true);
  });

  it('should return false when no evaluations exist (count = 0)', async () => {
    setup(0);

    const result = await checkContextEvaluationsExist(db, EvaluationContext.CATALOG);

    expect(result).toBe(false);
  });

  it('should return false when count is null/undefined', async () => {
    db = {
      select: jest.fn().mockReturnValue(createThenable([{ count: null }])),
    };

    const result = await checkContextEvaluationsExist(db, EvaluationContext.TRENDING);

    expect(result).toBe(false);
  });

  it('should return false when result is empty array', async () => {
    db = {
      select: jest.fn().mockReturnValue(createThenable([])),
    };

    const result = await checkContextEvaluationsExist(db, EvaluationContext.CATALOG);

    expect(result).toBe(false);
  });

  it('should work with different evaluation contexts', async () => {
    setup(5);

    const catalogResult = await checkContextEvaluationsExist(db, EvaluationContext.CATALOG);
    const trendingResult = await checkContextEvaluationsExist(db, EvaluationContext.TRENDING);

    expect(catalogResult).toBe(true);
    expect(trendingResult).toBe(true);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should handle large evaluation counts', async () => {
    setup(1000000);

    const result = await checkContextEvaluationsExist(db, EvaluationContext.CATALOG);

    expect(result).toBe(true);
  });
});
