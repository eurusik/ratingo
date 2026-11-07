import {
  ConsumeCodeFailureReason,
  type ConsumeCodeResult,
  type ExchangeCodeRecord,
  type IExchangeCodesRepository,
} from '../../src/modules/auth/domain/repositories/exchange-codes.repository.interface';

export class InMemoryExchangeCodesRepository implements IExchangeCodesRepository {
  private codes: ExchangeCodeRecord[] = [];

  async create(
    data: Omit<ExchangeCodeRecord, 'id' | 'usedAt' | 'createdAt'>,
  ): Promise<ExchangeCodeRecord> {
    const record: ExchangeCodeRecord = {
      ...data,
      id: `code-${this.codes.length + 1}`,
      usedAt: null,
      createdAt: new Date(),
    };
    this.codes.push(record);
    return record;
  }

  async consumeCode(codeHash: string): Promise<ConsumeCodeResult> {
    const now = new Date();
    const record = this.codes.find((code) => code.codeHash === codeHash);

    if (!record) {
      return { success: false, reason: ConsumeCodeFailureReason.NOT_FOUND };
    }

    if (record.usedAt) {
      return { success: false, reason: ConsumeCodeFailureReason.ALREADY_USED };
    }

    if (record.expiresAt < now) {
      return { success: false, reason: ConsumeCodeFailureReason.EXPIRED };
    }

    record.usedAt = now;
    return { success: true, record };
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const before = this.codes.length;
    this.codes = this.codes.filter((code) => code.expiresAt > now && !code.usedAt);
    return before - this.codes.length;
  }

  clear(): void {
    this.codes = [];
  }
}
