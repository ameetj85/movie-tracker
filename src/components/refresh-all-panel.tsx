"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RefreshLine } from "@/app/api/tmdb/refresh/route";

type Stage =
  | { name: "idle" }
  | { name: "running"; done: number; total: number }
  | { name: "done"; result: Extract<RefreshLine, { type: "result" }> };

/** Import & export page: fill in TMDB details and franchises for the whole vault. */
export function RefreshAllPanel() {
  const [stage, setStage] = useState<Stage>({ name: "idle" });

  async function run() {
    setStage({ name: "running", done: 0, total: 0 });
    try {
      const res = await fetch("/api/tmdb/refresh", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines.filter(Boolean)) {
          const line = JSON.parse(raw) as RefreshLine;
          if (line.type === "progress") setStage({ name: "running", done: line.done, total: line.total });
          else if (line.type === "result") {
            setStage({ name: "done", result: line });
            toast.success(`Updated ${line.updated} movie${line.updated === 1 ? "" : "s"} from TMDB`);
          } else throw new Error(line.message);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed.");
      setStage({ name: "idle" });
    }
  }

  const running = stage.name === "running";
  const pct = running && stage.total ? Math.round((stage.done / stage.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={run} disabled={running}>
          {running ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          Refresh all from TMDB
        </Button>
        {running && (
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {stage.done} of {stage.total || "…"}
          </span>
        )}
      </div>
      {running && (
        <div
          role="progressbar"
          aria-label="TMDB refresh progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 overflow-hidden rounded-full bg-chart-track"
        >
          <div className="h-full rounded-full bg-chart-bar transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      {stage.name === "done" && (
        <div className="rounded-xl border border-primary/15 bg-accent/30 p-3 text-sm" aria-live="polite">
          <p>
            <strong>{stage.result.updated}</strong> updated · {stage.result.unchanged} already complete
            {stage.result.errors > 0 && ` · ${stage.result.errors} failed`}
          </p>
          {stage.result.unmatched.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-primary">
                {stage.result.unmatched.length} couldn&apos;t be matched on TMDB
              </summary>
              <p className="mt-1 text-muted-foreground">
                {stage.result.unmatched.join(", ")}. Open one, choose Edit and use &ldquo;Find on TMDB&rdquo; to pick the right film.
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
