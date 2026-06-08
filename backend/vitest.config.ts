import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/helpers/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://qms:qms_secret@localhost:5432/qms_platform_test?schema=public",
      JWT_SECRET: "test-jwt-secret-not-used-in-production",
      RATE_LIMIT_ENABLED: "true",
    },
  },
});
