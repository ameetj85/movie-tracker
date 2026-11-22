import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Run through `npm test` (scripts/vitest.mjs), which fixes a Windows drive-letter
// casing issue that otherwise makes every test fail to register.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // `server-only` throws outside a React Server Components bundle; it's a no-op guard in tests.
      "server-only": path.join(root, "test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Points DATABASE_PATH / POSTER_DIR / BACKUP_DIR at a throwaway temp folder.
    setupFiles: ["test/setup.ts"],
  },
});
