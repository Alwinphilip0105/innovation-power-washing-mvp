import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Component build; the stub
      // keeps the import-time guard in place for Next while letting the same
      // modules load under Node for tests.
      "server-only": `${root}tests/stubs/server-only.ts`,
      "@": root.replace(/\/$/, ""),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["lib/**", "services/**"],
      exclude: ["lib/config/**", "**/*.d.ts"],
    },
  },
});
