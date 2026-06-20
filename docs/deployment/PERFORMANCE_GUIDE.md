# Performance Guide

This guide covers the platform's performance posture: indexing, pagination,
query patterns, the dashboard caching strategy, and slow-query observability
introduced in Phase 29.

## Indexing Strategy

Every tenant-scoped table is indexed on `tenant_id` and the columns its hot
queries filter and sort by. Indexes are **partial** on active rows
(`WHERE deleted_at IS NULL`) so they stay small and match the soft-delete query
pattern used throughout the services.

Phase 29 added composite indexes for additional common access paths
(`packages/database/migrations/20260629050000_phase29_performance_indexes.sql`):

| Table | Index | Supports |
| --- | --- | --- |
| `leads` | `(tenant_id, email)` | email lookup / dedupe |
| `leads` | `(tenant_id, score DESC)` | score-ranked qualification queues |
| `accounts` | `(tenant_id, name)` | name search / sort |
| `accounts` | `(tenant_id, health_status_option_id)` | health filtering |
| `contacts` | `(tenant_id, email)` | email lookup |
| `opportunities` | `(tenant_id, amount DESC)` | value-sorted pipeline |
| `campaigns` | `(tenant_id, start_date, end_date)` | schedule / date-range |
| `support_tickets` | `(tenant_id, resolution_due_at) WHERE resolved_at IS NULL` | SLA-breach scanning of open tickets |

These complement the existing per-table indexes (e.g.
`(tenant_id, created_at DESC)`, `(tenant_id, owner_id, …)`,
`(tenant_id, status_option_id, …)`) created in earlier phases, and the
`audit_logs` event/action/status indexes from Phase 27.

### Adding indexes

- Always include `tenant_id` as the leading column for tenant-scoped tables.
- Make indexes partial on `deleted_at IS NULL` to match service queries.
- Use `CREATE INDEX IF NOT EXISTS` and confirm column names against the live
  schema before writing the migration.
- Validate with `EXPLAIN (ANALYZE, BUFFERS)` on representative tenant data.

## Pagination Review

List endpoints use bounded, offset-based pagination:

- `page` defaults to `1`; `pageSize` defaults to a per-module value and is
  **capped** (e.g. audit logs cap at 200) so a client cannot request unbounded
  result sets.
- A `COUNT(*)` provides totals and the response includes
  `page`, `pageSize`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`.
- Results are ordered by an indexed column (`created_at DESC` / `updated_at DESC`),
  so the leading `(tenant_id, <sort> DESC)` indexes serve both the filter and the
  sort.

Known limitation: offset pagination degrades on very deep pages (large `OFFSET`).
For tenants with very large datasets, keyset (cursor) pagination on
`(created_at, id)` is the recommended future enhancement; the indexes already in
place support it.

## Query Optimization Review

- **Tenant scoping first.** Every query filters by `tenant_id` and joins are
  tenant-scoped, keeping working sets small and indexes selective.
- **Soft-delete aware.** Queries filter `deleted_at IS NULL`, matching the
  partial indexes.
- **Avoid N+1.** Aggregate/breakdown metrics are computed with grouped SQL rather
  than per-row queries; multi-step reads run inside a single `withClient`/
  `withTransaction` connection.
- **Bounded exports.** Export endpoints cap rows (e.g. audit export at 5,000).
- **Slow-query visibility.** `DatabaseService` times statements and logs any
  exceeding `SLOW_QUERY_THRESHOLD_MS` (default 500 ms) with the truncated SQL,
  so regressions surface in logs. This instruments both direct
  `DatabaseService.query` calls and queries run through pooled clients.

## Dashboard Caching Strategy

Dashboard metric computation is read-mostly and expensive, so it is routed
through a cache seam (`platform/cache/cache.service.ts`) used by
`DashboardService.getDashboard`:

- Cache keys are tenant-scoped and include the dashboard key and date filter
  (`dashboard:<tenantId>:<dashboardKey>:<from>:<to>`) so entries never leak
  across tenants or filters.
- TTL is `DASHBOARD_CACHE_TTL_SECONDS` (default 60s).
- Hit/miss counters are exposed via `/metrics` and `/observability/cache`.

Today Redis is a placeholder, so the cache is **deferred**: every call is a
deterministic miss that recomputes from PostgreSQL. The key shape, TTL, and
accounting are already in place, so enabling Redis (`DASHBOARD_CACHE_ENABLED`
plus a live Redis runtime) activates serving from cache without code changes. A
`dashboard_cache_warm` background job is registered for future pre-computation.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SLOW_QUERY_THRESHOLD_MS` | `500` | Slow-query log threshold (ms). |
| `QUERY_LOGGING_ENABLED` | `true` | Toggle slow-query logging. |
| `DASHBOARD_CACHE_ENABLED` | `false` | Enable dashboard caching (needs Redis). |
| `DASHBOARD_CACHE_TTL_SECONDS` | `60` | Dashboard cache TTL. |
| `DATABASE_POOL_MAX` | `10` | Max PostgreSQL pool connections. |

## Roadmap (deferred)

- Live Redis-backed dashboard cache + cache warmer worker.
- Keyset pagination for very large tenant datasets.
- Read replicas / connection-pool tuning for high concurrency.
- Automated `EXPLAIN` regression checks for hot queries.
