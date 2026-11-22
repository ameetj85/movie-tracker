import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests: `npm run test:e2e`.
 *
 * Builds the app and serves it on a spare port against a brand-new database in a
 * temp folder, so the real movies.db is never touched. TMDB is switched off so
 * the tests never depend on the network.
 *
 * Uses the locally installed Microsoft Edge (no browser download). Set
 * PW_CHANNEL=chrome (or chromium after `npx playwright install chromium`) to use another.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
// The config is evaluated by each worker too; only the main process's value
// reaches the web server, and workers never touch the database directly.
const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "movie-vault-e2e-"));
process.env.E2E_DATA_DIR = dataDir;

const serverEnv = {
  DATABASE_PATH: path.join(dataDir, "e2e.db"),
  POSTER_DIR: path.join(dataDir, "posters"),
  BACKUP_DIR: path.join(dataDir, "backups"),
  // Defined-but-empty beats .env.local, so TMDB is off for the build and the server.
  TMDB_READ_ACCESS_TOKEN: "",
  TMDB_API_KEY: "",
};

export default defineConfig({
  testDir: "e2e",
  // Tests share one server and database; each uses its own movie titles.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? "msedge",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: serverEnv,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
