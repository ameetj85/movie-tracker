"use client";

import { CalendarCheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Viewing } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { deleteViewing, logViewing } from "@/lib/library-actions";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Diary of when a movie was watched: log a viewing, see and remove past ones. */
export function WatchHistory({ movieId, viewings }: { movieId: number; viewings: Viewing[] }) {
  const [logging, setLogging] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function open() {
    // Default to today; read when the form opens, never during render.
    setDate((d) => d || todayIso());
    setLogging(true);
  }

  function save() {
    startTransition(async () => {
      const result = await logViewing(movieId, { watchedOn: date, note });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Logged a viewing on ${formatDate(date)}`);
      setNote("");
      setDate("");
      setLogging(false);
    });
  }

  function remove(v: Viewing) {
    startTransition(async () => {
      const result = await deleteViewing(v.id);
      if (!result.ok) toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {viewings.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm shadow-primary/5">
          {viewings.map((v) => (
            <li key={v.id} className="group flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/50">
              <CalendarCheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="font-medium whitespace-nowrap">{formatDate(v.watchedOn)}</span>
              {v.note && <span className="min-w-0 truncate text-muted-foreground">{v.note}</span>}
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto opacity-60 group-hover:opacity-100"
                aria-label={`Remove viewing on ${formatDate(v.watchedOn)}`}
                disabled={pending}
                onClick={() => remove(v)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No viewings logged yet.</p>
      )}
      <p className="sr-only" aria-live="polite">
        {viewings.length} viewing{viewings.length === 1 ? "" : "s"} logged
      </p>

      {logging ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-primary/15 bg-accent/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="w-44">
            <DatePicker id={`viewing-date-${movieId}`} value={date} onChange={setDate} />
          </div>
          <Input
            className="min-w-40 flex-1"
            placeholder="Note (optional), e.g. with the kids"
            aria-label="Note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={pending || !date}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLogging(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={open}>
            <CalendarCheckIcon />
            Log a viewing
          </Button>
        </div>
      )}
    </div>
  );
}
