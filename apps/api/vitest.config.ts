import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { defineConfig } from "vitest/config";

// The API source is authored as NodeNext ESM and imports sibling modules with
// explicit ".js" specifiers that actually point at ".ts" files on disk. Vitest
// runs the TypeScript directly, so we rewrite those ".js" specifiers back to the
// real ".ts" source during resolution.
const resolveTsFromJs = {
  name: "resolve-ts-from-js",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    if (importer && (source.startsWith("./") || source.startsWith("../")) && source.endsWith(".js")) {
      const candidate = resolvePath(dirname(importer), `${source.slice(0, -3)}.ts`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }
};

export default defineConfig({
  plugins: [resolveTsFromJs],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Deterministic, offline-friendly defaults: the database and redis layers are
    // disabled and the global rate limiter is off so contract tests are not throttled.
    env: {
      NODE_ENV: "test",
      API_LOG_LEVEL: "silent",
      DATABASE_ENABLED: "false",
      REDIS_ENABLED: "false",
      API_RATE_LIMIT_ENABLED: "false",
      JWT_ACCESS_TOKEN_SECRET: "test-access-secret-please-change",
      JWT_REFRESH_TOKEN_SECRET: "test-refresh-secret-please-change"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"]
    }
  }
});
