interface OutgoingRequest {
  readonly origin?: string | URL;
}

const hostOf = (value: string | URL | undefined): string | undefined => {
  try {
    return value === undefined ? undefined : new URL(value).host;
  } catch {
    return undefined;
  }
};

export const isTelemetryRequest =
  (endpoint: string | undefined) =>
  (request: OutgoingRequest): boolean => {
    const telemetryHost = hostOf(endpoint);
    return telemetryHost !== undefined && hostOf(request.origin) === telemetryHost;
  };
