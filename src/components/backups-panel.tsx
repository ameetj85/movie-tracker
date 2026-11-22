import { ArchiveIcon } from "lucide-react";
import { connection } from "next/server";

import { BackupNowButton } from "@/components/backup-now-button";
import { Skeleton } from "@/components/ui/skeleton";
import { listBackups } from "@/lib/backup";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const REASON_LABEL: Record<string, string> = { auto: "Automatic", manual: "Manual", "pre-import": "Before import" };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Recent database backups (see src/lib/backup.ts). */
export async function BackupsPanel() {
  // Read the backup folder per request, not at build time.
  await connection();
  const backups = await listBackups();
  const shown = backups.slice(0, 5);
  const dir = process.env.BACKUP_DIR ?? "data/backups";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <BackupNowButton />
        <p className="text-sm text-muted-foreground">
          {backups.length === 0
            ? "No backups yet."
            : `${backups.length} backup${backups.length === 1 ? "" : "s"} in `}
          {backups.length > 0 && <code className="text-xs">{dir}</code>}
        </p>
      </div>
      {shown.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border border-primary/10 text-sm">
          {shown.map((b) => (
            <li key={b.file} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/50">
              <ArchiveIcon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="font-medium">{when.format(b.createdAt)}</span>
              <span className="text-muted-foreground">{REASON_LABEL[b.reason] ?? b.reason}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatBytes(b.bytes)}</span>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-primary">
          How to restore a backup
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Stop the app.</li>
          <li>
            Copy the backup file from <code className="text-xs">{dir}</code> over{" "}
            <code className="text-xs">{process.env.DATABASE_PATH ?? "movies.db"}</code> in the project folder, and
            delete any <code className="text-xs">-wal</code> / <code className="text-xs">-shm</code> files next to it.
          </li>
          <li>Start the app again.</li>
        </ol>
      </details>
    </div>
  );
}

export function BackupsPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
