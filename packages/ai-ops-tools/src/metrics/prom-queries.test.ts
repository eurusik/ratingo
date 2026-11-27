import * as Queries from './prom-queries';

describe('prom queries', () => {
  it('keeps the 24h digest queries unchanged', () => {
    expect(Queries.queueBacklog()).toBe(
      'sum by (queue) (app_queue_jobs{state=~"waiting|delayed|prioritized"})',
    );
    expect(Queries.queueBacklogPeak()).toBe(
      'max_over_time(sum by (queue) (app_queue_jobs{state=~"waiting|delayed|prioritized"})[24h:5m])',
    );
    expect(Queries.jobsByResult('failed', 'queue, job_name')).toBe(
      'sum by (queue, job_name) (increase(app_queue_job_duration_seconds_count{result="failed"}[24h]))',
    );
    expect(Queries.clientErrors()).toBe(
      'sum by (server_address, http_response_status_code) (increase(http_client_request_duration_seconds_count{http_response_status_code=~"401|403|429"}[24h]))',
    );
    expect(Queries.siteRequests()).toBe(
      'sum(increase(app_next_request_duration_seconds_count{service_name="ratingo-storefront"}[24h]))',
    );
  });

  it('adds the window and the label filters when asked', () => {
    expect(Queries.jobsByResult('completed', 'queue', '7d', 'ingestion')).toBe(
      'sum by (queue) (increase(app_queue_job_duration_seconds_count{result="completed",queue="ingestion"}[7d]))',
    );
    expect(Queries.clientErrors('6h', { provider: 'api.trakt.tv', status: '429' })).toContain(
      '{server_address="api.trakt.tv",http_response_status_code="429"}[6h]',
    );
    expect(Queries.queueBacklogPeak('3d', 'ingestion')).toContain('queue="ingestion"');
    expect(Queries.queueBacklogPeak('3d', 'ingestion')).toContain('[3d:5m]');
  });
});
