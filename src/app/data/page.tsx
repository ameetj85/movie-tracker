import { FileJsonIcon, FileSpreadsheetIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BackupsPanel, BackupsPanelSkeleton } from "@/components/backups-panel";
import { ImportWizard } from "@/components/import-wizard";
import { buttonVariants } from "@/components/ui/button";
import { CSV_COLUMNS } from "@/lib/csv-format";
import { isTmdbConfigured } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Import & export" };

export default function DataPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-gradient w-fit text-3xl font-bold tracking-tight">Import &amp; export</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm shadow-primary/5 transition-shadow duration-300 hover:shadow-md hover:shadow-primary/10">
        <div>
          <h2 className="text-base font-semibold">Export</h2>
          <p className="text-sm text-muted-foreground">
            Download your whole collection for backup. The CSV has one row per copy and can be imported back
            here; poster images aren&apos;t included (they can be re-fetched from TMDB on import).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Plain <a download>: these are file downloads, not navigations. */}
          <a href="/api/export?format=csv" download className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheetIcon />
            Export CSV
          </a>
          <a href="/api/export?format=json" download className={buttonVariants({ variant: "outline" })}>
            <FileJsonIcon />
            Export JSON
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm shadow-primary/5 transition-shadow duration-300 hover:shadow-md hover:shadow-primary/10">
        <div>
          <h2 className="text-base font-semibold">Import from CSV</h2>
          <p className="text-sm text-muted-foreground">
            Bulk-add movies from a spreadsheet, a Movie Vault export, or apps like Letterboxd and CLZ. Only a
            title column is required; you&apos;ll see a preview before anything is saved.
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-primary">
            Recognized columns
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
            <p>
              <code className="text-xs">{CSV_COLUMNS.join(", ")}</code>
            </p>
            <p>
              Common alternatives work too (e.g. <em>Name</em>, <em>Year</em>, <em>Media Type</em>,{" "}
              <em>Purchase Price</em>). Formats like &ldquo;4K Ultra HD&rdquo;, &ldquo;BD&rdquo; or &ldquo;iTunes&rdquo;
              are normalized, and combo packs such as &ldquo;4K + Blu-ray&rdquo; become two copies. Rows with the same
              title and year are merged into one movie with several copies. Set <code className="text-xs">list</code>{" "}
              to <em>wishlist</em> for movies you want to buy.
            </p>
          </div>
        </details>
        <ImportWizard tmdbEnabled={isTmdbConfigured()} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm shadow-primary/5 transition-shadow duration-300 hover:shadow-md hover:shadow-primary/10">
        <div>
          <h2 className="text-base font-semibold">Backups</h2>
          <p className="text-sm text-muted-foreground">
            The database is backed up automatically at most once a day, just before a change is saved, and
            always before an import. The 14 most recent backups are kept.
          </p>
        </div>
        <Suspense fallback={<BackupsPanelSkeleton />}>
          <BackupsPanel />
        </Suspense>
      </section>
    </div>
  );
}
