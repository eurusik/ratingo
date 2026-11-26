export interface FailureSignal {
  readonly errorName: string;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly message: string;
}
