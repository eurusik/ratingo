import { LogsFailureClass } from './logs.constants';
import { LogsUnavailableError, type LogsFetch, type LogsPort } from './logs.port';

export class UnconfiguredLogsAdapter implements LogsPort {
  async search(): Promise<LogsFetch> {
    throw new LogsUnavailableError(LogsFailureClass.NOT_CONFIGURED);
  }
}
