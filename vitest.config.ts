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
        },
      },
    ],
  },
});
