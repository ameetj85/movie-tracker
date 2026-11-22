import "server-only";

import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { db } from "@/db";

/**
 * Automatic database backups. The whole collection lives in one SQLite file,
 * so snapshots of it are cheap insurance against corruption or a bad import.
 *
 * - `backupIfDue()` runs before every write; it snapshots the database if the
 *   newest backup is older than BACKUP_INTERVAL_HOURS (default 24). Backing up
 *   *before* the change means the snapshot is the last known-good state.
 * - `createBackup()` always snapshots (used before imports and by "Back up now").
 * - Only the newest BACKUP_KEEP (default 14) files are kept.
 *
 * Uses SQLite's online backup API, so it's consistent even while the app is
 * running (WAL mode).
 */
export const BACKUP_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.BACKUP_DIR ?? "data/backups",
);
const KEEP = positiveInt(process.env.BACKUP_KEEP, 14);
const INTERVAL_MS = positiveInt(process.env.BACKUP_INTERVAL_HOURS, 24) * 60 * 60 * 1000;
const FILE_RE = /^movies-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(?:-([a-z-]+))?\.db$/;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export type BackupReason = "auto" | "manual" | "pre-import";
export type BackupInfo = { file: string; createdAt: Date; bytes: number; reason: string };

export async function listBackups(): Promise<BackupInfo[]> {
  let names: string[];
  try {
    names = await readdir(BACKUP_DIR);
  } catch {
    return []; // No backups yet.
  }
  const infos = await Promise.all(
    names
      .filter((n) => FILE_RE.test(n))
      .map(async (file) => {
        const s = await stat(path.join(BACKUP_DIR, file));
        return { file, createdAt: s.mtime, bytes: s.size, reason: FILE_RE.exec(file)![2] ?? "auto" };
      }),
  );
  return infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// One backup at a time; concurrent callers share the in-flight one.
let inFlight: Promise<BackupInfo> | null = null;
// Cached newest-backup time so the "is it due?" check doesn't hit the disk on every write.
let lastBackupAt: number | null = null;

export function createBackup(reason: BackupReason): Promise<BackupInfo> {
  inFlight ??= (async () => {
    try {
      await mkdir(BACKUP_DIR, { recursive: true });
      const now = new Date();
      const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const file = `movies-${stamp}${reason === "auto" ? "" : `-${reason}`}.db`;
      await db.$client.backup(path.join(BACKUP_DIR, file));
      lastBackupAt = now.getTime();
      await prune();
      const s = await stat(path.join(BACKUP_DIR, file));
      return { file, createdAt: s.mtime, bytes: s.size, reason };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Snapshot the database if the last backup is older than the interval. Never throws. */
export async function backupIfDue(): Promise<void> {
  try {
    if (lastBackupAt === null) {
      const [newest] = await listBackups();
      lastBackupAt = newest?.createdAt.getTime() ?? 0;
    }
    if (Date.now() - lastBackupAt < INTERVAL_MS) return;
    // Nothing worth backing up in an empty database.
    const hasData = db.$client.prepare("SELECT 1 FROM movies LIMIT 1").get();
    if (!hasData) return;
    await createBackup("auto");
  } catch (err) {
    // A failed backup must never block saving the user's change.
    console.error("Automatic backup failed:", err);
  }
}

async function prune() {
  const all = await listBackups();
  await Promise.all(all.slice(KEEP).map((b) => unlink(path.join(BACKUP_DIR, b.file)).catch(() => {})));
}
