# Observability Guide

This guide describes how the platform is observed in operation: structured logs,
the operational HTTP endpoints (liveness, readiness, metrics), and the
background-job and cache visibility added in Phase 29.

## Structured Logging

The API uses [pino](https://getpino.io) for structured JSON logging
(`apps/api/src/platform/logger/logger.ts`).

- Every line carries `service` and `environment` base fields so logs are
  queryable once shipped to a central aggregator.
- Sensitive fields are **redacted** defensively (`authorization`, `cookie`,
  `password`, `accessToken`, `refreshToken`, `token`, `secret`, …) and replaced
  with `[redacted]`.
- In development, logs are pretty-printed; in production they are raw JSON ready
  for ingestion (Loki, CloudWatch, ELK, Datadog, etc.).
- The level is controlled by `API_LOG_LEVEL` (`info` by default; `silent` in tests).

### Log categories

| Category | Where | Notes |
| --- | --- | --- |
| Request logs | `common/middleware/request-logger.ts` | One line per request with `requestId`, `method`, `url`, `statusCode`, `durationMs`. |
| Error logs | `common/middleware/error-handler.ts` | `AppError` ≥ 500 logged at `error`, 4xx at `warn`; unknown errors logged without leaking internals to the client. |
| Slow query logs | `platform/database/database.service.ts` | Queries slower than `SLOW_QUERY_THRESHOLD_MS` are logged at `warn` with the truncated SQL and duration. |
| AI usage logs | AI Gateway (`ai_usage_logs` table) | Every AI call is persisted with tokens, status, latency, and actor. |
| Workflow execution logs | Workflow engine (`workflow_runs`, `workflow_logs`) | Each run and per-action outcome is recorded and traceable. |
| Audit logs | `audit_logs` table | Security and sensitive-action events (see Phase 27). |

### Request correlation

`common/middleware/request-context.ts` assigns every request an `x-request-id`
(honoring an inbound header if present) and echoes it on the response. Use this
id to correlate request, error, and slow-query logs for a single call.

## Operational Endpoints

All three are mounted under the versioned prefix (`/api/v1`) and are
**unauthenticated** so load balancers and scrapers can reach them.

### Liveness — `GET /api/v1/health` and `GET /api/v1/live`

Returns `200` with service metadata, uptime, and dependency health (database,
redis). Use as the container/orchestrator **liveness probe** — it answers "is the
process up?".

### Readiness — `GET /api/v1/ready`

Returns `200` with `status: "ready"` when dependencies are reachable, or `503`
with `status: "not_ready"` and per-check detail when not. The database is the
only hard dependency; Redis is optional today and never blocks readiness. Use as
the **readiness probe** so traffic is routed away from an instance that cannot
serve.

```json
{
  "status": "ready",
  "service": "ai-native-crm-api",
  "timestamp": "2026-06-29T00:00:00.000Z",
  "checks": [
    { "name": "database", "status": "pass", "detail": "Connected to crm." },
    { "name": "redis", "status": "pass", "detail": "Redis integration is currently disabled." }
  ]
}
```

### Metrics — `GET /api/v1/metrics`

Returns process metrics (memory, heap, CPU, uptime, pid, Node version) and the
dashboard cache hit/miss counters as JSON. This is a **placeholder** for a full
Prometheus/OpenTelemetry exporter, which is deferred to the observability runtime
phase. Toggle with `METRICS_ENABLED`.

### Admin observability — `GET /api/v1/observability/*`

Admin-gated (any of `admin.view`, `admin.view_dashboard`, `admin.configure`,
`admin.manage_workflow`):

- `GET /observability/jobs` — background job catalog and worker-runtime status.
- `GET /observability/cache` — dashboard cache configuration and counters.

## Background Job Monitoring

`platform/jobs/job-monitor.service.ts` publishes the catalog of background jobs
the platform is designed to run (audit/log retention purge, AI embedding
backfill, workflow scheduler, notification dispatcher, dashboard cache warmer).
Until a worker runtime exists (the Redis/queue phase), jobs report `deferred`.
Once `BACKGROUND_WORKERS_ENABLED` is true and a runtime is wired, these entries
become live with real schedules, last-run timestamps, and outcomes.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_LOG_LEVEL` | `info` | pino log level. |
| `SLOW_QUERY_THRESHOLD_MS` | `500` | Slow-query log threshold. |
| `QUERY_LOGGING_ENABLED` | `true` | Toggle slow-query logging. |
| `METRICS_ENABLED` | `true` | Toggle the `/metrics` endpoint. |
| `BACKGROUND_WORKERS_ENABLED` | `false` | Whether a worker runtime is running. |

## Roadmap (deferred)

- Prometheus/OpenTelemetry metric export and traces.
- Log shipping and dashboards in a central aggregator.
- Live background-worker runtime backing the job monitor.
- Alerting on readiness failures, error-rate, and slow-query volume.
