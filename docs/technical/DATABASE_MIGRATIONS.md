# Database Migrations

## Purpose

This guide explains how the PostgreSQL migration and seed system works in the current repository.

## Tooling Model

The repository uses:
- `pg` for PostgreSQL connectivity
- SQL migration files in `packages/database/migrations`
- a Node CLI in `scripts/database.mjs`
- idempotent core seeds in `packages/database/src/seeds.ts`

## Commands

### Create a migration

```bash
npm run db:create:migration -- add_contacts_table
```

This creates a timestamped SQL file in `packages/database/migrations/`.

### Run pending migrations

```bash
npm run db:migrate
```

### Show migration status

```bash
npm run db:status
```

### Roll back the latest migration

```bash
npm run db:rollback
```

### Roll back multiple migrations

```bash
npm run db:rollback -- 2
```

### Run seeds

```bash
npm run db:seed
```

## Migration File Format

Each migration file must include both markers:

```sql
-- migrate:up
-- forward SQL here

-- migrate:down
-- rollback SQL here
```

The runner:
- applies files in lexical order
- stores checksums in `schema_migrations`
- refuses to run if an already-applied migration file was edited later

## Recommended Workflow

1. Ensure PostgreSQL is running and reachable through `DATABASE_URL`.
2. Create the migration file.
3. Add both `up` and `down` SQL.
4. Run `npm run db:migrate`.
5. Run `npm run db:seed` if bootstrap data is required.
6. Verify application startup or query the target tables.

## Seed Behavior

The seed system is intentionally idempotent for the current bootstrap scope.

Repeated seed runs will:
- restore the default tenant if it was soft-deleted
- restore or update the full seeded permission catalog
- restore or update seeded role templates
- restore or update the default tenant role set derived from those templates
- reset the seeded admin user password to the current `DEFAULT_ADMIN_PASSWORD`
- ensure the `super-admin` assignment exists for the bootstrap user
- migrate a legacy bootstrap `tenant-admin` role into `super-admin` when possible

## Rollback Guidance

Use rollback carefully:
- it replays the `-- migrate:down` section of the most recent applied migration
- it removes the matching row from `schema_migrations`
- it should be used only in lower environments unless a production rollback plan is explicitly reviewed

## Troubleshooting

### No local PostgreSQL server

If `npm run db:migrate` or `npm run db:status` fails with `ECONNREFUSED`, PostgreSQL is not currently reachable on `DATABASE_URL`.

### Docker is not enough by itself

`docker-compose.yml` defines a PostgreSQL service, but the Docker daemon must actually be running before the container can be started.

### Applied migration changed

If the runner reports a checksum mismatch:
- revert the local edit to the applied migration file, or
- create a new corrective migration instead
