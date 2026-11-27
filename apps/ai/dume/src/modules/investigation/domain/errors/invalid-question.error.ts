export class InvalidQuestionError extends Error {
  constructor(reason: string) {
    super(`Invalid question: ${reason}`);
    this.name = 'InvalidQuestionError';
  }
}
