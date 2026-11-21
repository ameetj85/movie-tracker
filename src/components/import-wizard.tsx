"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileUpIcon,
  Loader2Icon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { FormatBadges } from "@/components/movie-meta";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportPreview } from "@/app/api/import/route";
import { FORMATS } from "@/lib/constants";
import type { ImportOptions, ImportProgress, ImportResult } from "@/lib/import";

const MAX_BYTES = 5 * 1024 * 1024;
const NO_DEFAULT = "__none";
const formatItems: Record<string, string> = {
  [NO_DEFAULT]: "Skip those rows",
  ...Object.fromEntries(FORMATS.map((f) => [f, f])),
};
const PHASE_LABEL: Record<ImportProgress["phase"], string> = {
  tmdb: "Looking up details on TMDB",
  posters: "Downloading posters",
  saving: "Saving",
};

type Stage =
  | { name: "idle" }
  | { name: "previewing" }
  | { name: "preview"; data: ImportPreview }
  | { name: "importing"; progress: ImportProgress | null }
  | { name: "done"; result: ImportResult };

export function ImportWizard({ tmdbEnabled }: { tmdbEnabled: boolean }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    defaultFormat: null,
    skipExisting: true,
    enrich: tmdbEnabled,
  });
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runPreview(text: string, opts: ImportOptions) {
    setStage({ name: "previewing" });
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", csv: text, options: opts }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Preview failed (${res.status}).`);
      setStage({ name: "preview", data: body as ImportPreview });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
      setStage({ name: "idle" });
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 5 MB.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    await runPreview(text, options);
  }

  function changeOptions(patch: Partial<ImportOptions>) {
    const next = { ...options, ...patch };
    setOptions(next);
    if (file) void runPreview(file.text, next);
  }

  async function runImport() {
    if (!file) return;
    setStage({ name: "importing", progress: null });
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", csv: file.text, options }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Import failed (${res.status}).`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "progress") setStage({ name: "importing", progress: msg });
          else if (msg.type === "result") setStage({ name: "done", result: msg });
          else if (msg.type === "error") throw new Error(msg.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      if (file) void runPreview(file.text, options);
    }
  }

  function reset() {
    setFile(null);
    setStage({ name: "idle" });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = stage.name === "previewing" || stage.name === "importing";

  return (
    <div className="flex flex-col gap-4">
      {stage.name !== "done" && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={busy}
          />
          <Label
            htmlFor="import-file"
            className={buttonVariants({ variant: file ? "outline" : "default", className: "cursor-pointer" })}
          >
            <FileUpIcon />
            {file ? "Choose a different file" : "Choose CSV file"}
          </Label>
          {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
          {stage.name === "previewing" && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Import problem</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stage.name === "preview" && (
        <PreviewPanel
          data={stage.data}
          options={options}
          tmdbEnabled={tmdbEnabled}
          onOptions={changeOptions}
          onImport={runImport}
        />
      )}

      {stage.name === "importing" && <ProgressPanel progress={stage.progress} />}

      {stage.name === "done" && <ResultPanel result={stage.result} onReset={reset} />}
    </div>
  );
}

function PreviewPanel({
  data,
  options,
  tmdbEnabled,
  onOptions,
  onImport,
}: {
  data: ImportPreview;
  options: ImportOptions;
  tmdbEnabled: boolean;
  onOptions: (patch: Partial<ImportOptions>) => void;
  onImport: () => void;
}) {
  const mapped = Object.entries(data.columns);
  const ownedCount = data.movieCount - data.wishlistCount;

  return (
    <div className="flex flex-col gap-5 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">
          {data.movieCount === 0
            ? "Nothing to import"
            : `Ready to import ${data.movieCount.toLocaleString()} ${data.movieCount === 1 ? "movie" : "movies"}`}
        </h3>
        <p className="text-sm text-muted-foreground">
          {data.totalRows.toLocaleString()} rows → {ownedCount.toLocaleString()} owned
          {data.wishlistCount ? `, ${data.wishlistCount.toLocaleString()} wishlist` : ""} ·{" "}
          {data.copyCount.toLocaleString()} {data.copyCount === 1 ? "copy" : "copies"}
          {data.isLetterboxd && " · Letterboxd export detected (ratings ×2, marked watched)"}
        </p>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Column mapping ({mapped.length} matched
          {data.unmappedHeaders.length ? `, ${data.unmappedHeaders.length} ignored` : ""})
        </summary>
        <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {mapped.map(([col, header]) => (
            <li key={col} className="flex gap-2">
              <code className="text-xs text-muted-foreground">{col}</code>← <span>{header}</span>
            </li>
          ))}
        </ul>
        {data.unmappedHeaders.length > 0 && (
          <p className="mt-2 text-muted-foreground">Ignored: {data.unmappedHeaders.join(", ")}</p>
        )}
      </details>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Options</h4>
        <div className="flex flex-col gap-1.5">
          <Label>Format for owned rows without one</Label>
          <Select
            items={formatItems}
            value={options.defaultFormat ?? NO_DEFAULT}
            onValueChange={(v) => onOptions({ defaultFormat: !v || v === NO_DEFAULT ? null : v })}
          >
            <SelectTrigger className="w-full sm:w-64" aria-label="Default format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(formatItems).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CheckboxRow
          id="skip-existing"
          checked={options.skipExisting}
          onChange={(v) => onOptions({ skipExisting: v })}
          label="Skip movies already in my collection"
          hint="Matched by TMDB id, or by title and year."
        />
        <CheckboxRow
          id="enrich"
          checked={options.enrich && tmdbEnabled}
          disabled={!tmdbEnabled}
          onChange={(v) => onOptions({ enrich: v })}
          label="Fill in missing details and posters from TMDB"
          hint={
            tmdbEnabled
              ? "Matches each title (and year) on TMDB. Values in your file are never overwritten."
              : "Add a TMDB key to .env.local to enable."
          }
        />
      </div>

      {data.missingFormatRows.length > 0 && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>
            {data.missingFormatRows.length} owned {data.missingFormatRows.length === 1 ? "row has" : "rows have"} no
            format
          </AlertTitle>
          <AlertDescription>
            Choose a default format above to import them; otherwise they&apos;ll be skipped (rows{" "}
            {rowList(data.missingFormatRows)}).
          </AlertDescription>
        </Alert>
      )}

      {data.existingCount > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {data.existingCount.toLocaleString()} already in your collection — will be skipped
          </summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {data.existing.map((e) => (
              <li key={e.rows[0]}>
                {e.title}
                {e.releaseYear ? ` (${e.releaseYear})` : ""}
              </li>
            ))}
            {data.existingCount > data.existing.length && <li>…and {data.existingCount - data.existing.length} more</li>}
          </ul>
        </details>
      )}

      {data.issueCount > 0 && (
        <details className="text-sm" open={data.errorCount > 0 && data.errorCount <= 10}>
          <summary className="cursor-pointer">
            {data.errorCount > 0 && (
              <span className="text-destructive">
                {data.errorCount} {data.errorCount === 1 ? "row" : "rows"} will be skipped
              </span>
            )}
            {data.errorCount > 0 && data.issueCount > data.errorCount && " · "}
            {data.issueCount > data.errorCount && `${data.issueCount - data.errorCount} warnings`}
          </summary>
          <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {data.issues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="w-14 shrink-0 text-muted-foreground tabular-nums">Row {i.row}</span>
                <span className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}>{i.message}</span>
              </li>
            ))}
            {data.issueCount > data.issues.length && (
              <li className="text-muted-foreground">…and {data.issueCount - data.issues.length} more</li>
            )}
          </ul>
        </details>
      )}

      {data.sample.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Preview of movies to import</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Title</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Year</th>
                <th scope="col" className="px-3 py-2 font-medium">Formats</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.sample.map((m) => (
                <tr key={m.rows[0]}>
                  <td className="px-3 py-1.5">
                    {m.title}
                    {m.isWishlist && <span className="ml-2 text-xs text-muted-foreground">wishlist</span>}
                  </td>
                  <td className="hidden px-3 py-1.5 text-muted-foreground tabular-nums sm:table-cell">
                    {m.releaseYear ?? "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <FormatBadges formats={m.formats} short />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.movieCount > data.sample.length && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing first {data.sample.length} of {data.movieCount.toLocaleString()}.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onImport} disabled={data.movieCount === 0}>
          Import {data.movieCount.toLocaleString()} {data.movieCount === 1 ? "movie" : "movies"}
        </Button>
      </div>
    </div>
  );
}

function ProgressPanel({ progress }: { progress: ImportProgress | null }) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        {progress ? PHASE_LABEL[progress.phase] : "Starting import"}…
        {progress && progress.total > 0 && (
          <span className="ml-auto text-muted-foreground tabular-nums">
            {progress.done} / {progress.total}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Import progress"
        className="h-2 overflow-hidden rounded-full bg-chart-track"
      >
        <div className="h-full rounded-full bg-chart-bar transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">Keep this page open until the import finishes.</p>
    </div>
  );
}

function ResultPanel({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>
          Imported {result.imported.toLocaleString()} {result.imported === 1 ? "movie" : "movies"} (
          {result.copies.toLocaleString()} {result.copies === 1 ? "copy" : "copies"})
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5">
            {result.matchedOnTmdb > 0 && <li>{result.matchedOnTmdb} matched on TMDB and filled in.</li>}
            {result.postersCached > 0 && <li>{result.postersCached} posters saved for offline use.</li>}
            {result.lookupErrors > 0 && <li>{result.lookupErrors} TMDB lookups failed (network or API error).</li>}
          </ul>
        </AlertDescription>
      </Alert>
      {result.unmatchedTitles.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {result.unmatchedTitles.length} not found on TMDB — imported as-is
          </summary>
          <p className="mt-2 text-muted-foreground">
            Open them and use &ldquo;Search TMDB&rdquo; on the edit page to link them manually.
          </p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {result.unmatchedTitles.slice(0, 100).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants()}>
          View collection
        </Link>
        <Button variant="outline" onClick={onReset}>
          <RotateCcwIcon />
          Import another file
        </Button>
      </div>
    </div>
  );
}

function CheckboxRow({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className={disabled ? "text-muted-foreground" : undefined}>
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function rowList(rows: number[]): string {
  const shown = rows.slice(0, 10).join(", ");
  return rows.length > 10 ? `${shown}, …` : shown;
}
