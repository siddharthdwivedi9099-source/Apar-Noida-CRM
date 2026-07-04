#!/bin/sh
# Entrypoint for the @crm/api container.
# Optionally runs migrations and seeds before starting the server. Each step is
# opt-in so production can keep demo personas disabled.
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  node scripts/database.mjs migrate
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database (idempotent)..."
  node scripts/database.mjs seed
fi

if [ "${RUN_EDUCATION_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding education demo data (idempotent)..."
  node scripts/seed-education.mjs
fi

if [ "${RUN_DEMO_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding role-based demo users (idempotent)..."
  node scripts/seed-demo-users.mjs
fi

echo "[entrypoint] Starting API server..."
exec node apps/api/dist/server.js
