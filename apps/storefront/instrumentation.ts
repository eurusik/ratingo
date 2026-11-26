import type { Instrumentation } from 'next';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startServerLogging, startTelemetry } = await import('@/shared/telemetry');
    startServerLogging();
    startTelemetry();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recordRequestError } = await import('@/shared/telemetry');
    recordRequestError(context);
  }
};
