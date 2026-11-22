import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Every test worker gets its own empty database and file folders, so tests never
// touch the real movies.db or data/ and can't interfere with each other.
// This runs before any test file imports "@/db", which reads these at import time.
const dir = mkdtempSync(path.join(tmpdir(), "movie-vault-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.POSTER_DIR = path.join(dir, "posters");
process.env.BACKUP_DIR = path.join(dir, "backups");
// Never call the real TMDB from unit tests.
delete process.env.TMDB_READ_ACCESS_TOKEN;
delete process.env.TMDB_API_KEY;
