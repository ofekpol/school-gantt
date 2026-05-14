import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/_dev/**"],
    },
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["test/unit/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
          exclude: ["test/e2e/**", "node_modules/**", ".next/**"],
          // server-only throws in non-Next.js environments; mock it for unit tests
          alias: {
            "server-only": require.resolve("./test/__mocks__/server-only.ts"),
          },
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["./test/integration/setup.ts"],
          include: ["test/integration/**/*.test.ts"],
          exclude: ["node_modules/**", ".next/**"],
          testTimeout: 15000,
          // Integration tests share one TEST_DATABASE_URL and the canonical
          // school IDs (testSchoolA/B). Running files in parallel causes one
          // file's writes to race with another's reads. Serialize file runs.
          fileParallelism: false,
          // server-only throws at import time outside a Next.js server context;
          // integration tests run in node and import lib/events/* modules that
          // start with `import "server-only"`. Mock it like the unit project does.
          alias: {
            "server-only": require.resolve("./test/__mocks__/server-only.ts"),
          },
        },
      },
    ],
  },
});
