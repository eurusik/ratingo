# Alloy

`config.alloy` is the full configuration of the `alloy` Railway service. Railway reads it from the `ALLOY_CONFIG` variable, so the file in the repo is the reviewed copy: after changing it, paste the whole file into `ALLOY_CONFIG` and bump `ALLOY_CONFIG_REV` to redeploy.

## What it does

- Scrapes Postgres and Redis and turns the samples into OTLP metrics
- Receives OTLP from every Ratingo service on `4317` (gRPC) and `4318` (HTTP) over the private network
- Forwards metrics, logs and traces to Grafana Cloud's OTLP gateway
- Logs pass through `scrub_logs` first: it removes `service.instance.id` and `service.version` (both would multiply Loki streams or add per-line metadata) and masks bearer headers, URL credentials and email addresses in the log line. The services already redact before sending; this is the second line

## Limits

- `otelcol.processor.memory_limiter` in front of the batcher: 512 MiB limit with a 128 MiB spike allowance, so it starts refusing data at 384 MiB of Go heap. The limiter looks at the Go heap, which in a local run with this config was about 40 MB in use (`go_memstats_heap_alloc_bytes` on `:12345/metrics`), while Railway shows the container at about 235 MB on average and 320 MB at peak; the limit sits above both so metrics are never refused in normal operation
- Batches of up to 1024 records or 5 seconds, sent gzip-compressed with a bounded queue (100 batches) and 60 seconds of retries
- Alloy has no per-second log rate limiter for OTLP; per-service caps live in the services' shipper (`LOG_SHIP_MAX_*`, see `.claude/rules/logging.md`)

## Variables the config reads

`DATABASE_URL`, `REDIS_ADDR`, `REDIS_PASSWORD`, `RAILWAY_ENVIRONMENT_NAME`, `GRAFANA_INSTANCE_ID`, `GRAFANA_API_TOKEN`, `GRAFANA_OTLP_ENDPOINT`. No new variable is needed for logs: the same OTLP gateway and token carry them.

## Loki labels

Grafana Cloud turns OTLP resource attributes into Loki labels. Services send only `service.name` and `deployment.environment.name`, which become the labels `service_name` and `deployment_environment_name`. Everything else is structured metadata, filtered inside a query:

```logql
{service_name="ratingo-worker"} | detected_level="error"
{service_name="ratingo-worker"} | job_id="sync-show_tv_1396"
{deployment_environment_name="production"} | json | request_id="..."
```

## Check a change locally

```bash
docker compose -f infra/alloy/docker-compose.yml up -d
```

This starts Loki on `3100` and Alloy on `4318` with the real `config.alloy`, pointed at the local Loki. Metric exports answer 404 there (Loki has no metrics endpoint); only logs matter. Run any service with the variables below and look at Loki:

```bash
RAILWAY_ENVIRONMENT_NAME=local OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 LOG_FORMAT=json npm run dev:api
curl -sG localhost:3100/loki/api/v1/query_range --data-urlencode 'query={service_name="ratingo-api"}'
```
