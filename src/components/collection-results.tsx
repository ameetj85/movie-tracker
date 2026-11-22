"use client";

import { CheckIcon, CheckSquareIcon, EyeIcon, EyeOffIcon, Loader2Icon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MovieCard } from "@/components/movie-card";
import { MovieTable } from "@/components/movie-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MovieWithCopies } from "@/db/schema";
import { bulkUpdate, type BulkOp } from "@/lib/library-actions";
import { cn } from "@/lib/utils";

// Same grid as the page skeleton in src/app/page.tsx.
const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

type Props = {
  movies: MovieWithCopies[];
  layout: "grid" | "list";
  view: "owned" | "wishlist";
  /** Existing tags, suggested when adding a tag. */
  tagOptions: string[];
};

/**
 * The collection grid/list plus "Select" mode for bulk edits: pick movies, then
 * mark them watched/unwatched, add or remove a tag, or delete them.
 */
export function CollectionResults({ movies, layout, view, tagOptions }: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Drop selections that are no longer on screen (deleted, filtered out).
  const visibleIds = new Set(movies.map((m) => m.id));
  const chosen = [...selected].filter((id) => visibleIds.has(id));
  const chosenMovies = movies.filter((m) => selected.has(m.id));
  const tagsInSelection = [
    ...new Map(chosenMovies.flatMap((m) => m.tags ?? []).map((t) => [t.toLowerCase(), t])).values(),
  ].sort((a, b) => a.localeCompare(b));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function run(op: BulkOp) {
    startTransition(async () => {
      const result = await bulkUpdate(chosen, op);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Done.");
      if (op.type === "delete") setSelected(new Set());
    });
  }

  const n = chosen.length;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-2",
          selecting &&
            "sticky top-[4.5rem] z-30 rounded-xl border border-primary/20 bg-card/95 p-2 shadow-lg shadow-primary/15 backdrop-blur",
        )}
      >
        {selecting ? (
          <>
            <span className="px-1 text-sm font-medium tabular-nums" aria-live="polite">
              {n} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(n === movies.length ? new Set() : new Set(movies.map((m) => m.id)))}
            >
              <CheckSquareIcon />
              {n === movies.length ? "Select none" : "Select all"}
            </Button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {view === "owned" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!n || pending}
                  onClick={() => run({ type: "status", status: "watched" })}
                >
                  <EyeIcon />
                  Mark watched
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!n || pending}
                  onClick={() => run({ type: "status", status: "unwatched" })}
                >
                  <EyeOffIcon />
                  Mark unwatched
                </Button>
              </>
            )}
            <TagButton
              label="Add tag"
              disabled={!n || pending}
              suggestions={tagOptions}
              onSubmit={(tag) => run({ type: "addTag", tag })}
            />
            {tagsInSelection.length > 0 && (
              <TagButton
                label="Remove tag"
                disabled={!n || pending}
                suggestions={tagsInSelection}
                pickOnly
                onSubmit={(tag) => run({ type: "removeTag", tag })}
              />
            )}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={!n || pending} />}>
                <Trash2Icon />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {n} movie{n === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes them and all their formats from your collection. A backup is taken first, but this
                    can&apos;t be undone from the app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => {
                      // The action button doesn't close the dialog by itself.
                      setConfirmDelete(false);
                      run({ type: "delete" });
                    }}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden />}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={stopSelecting}>
              <XIcon />
              Done
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setSelecting(true)}>
            <CheckSquareIcon />
            Select
          </Button>
        )}
      </div>

      {layout === "list" ? (
        <MovieTable movies={movies} selection={selecting ? { selected, onToggle: toggle } : undefined} />
      ) : (
        <ul className={GRID}>
          {movies.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <li key={m.id} className="relative">
                {/* While selecting, the card itself is inert and an overlay toggles it. */}
                <div inert={selecting || undefined} className="h-full">
                  <MovieCard movie={m} />
                </div>
                {selecting && (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Select ${m.title}`}
                    onClick={() => toggle(m.id)}
                    className={cn(
                      "absolute inset-0 rounded-2xl ring-2 transition-all outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                      isSelected ? "bg-primary/10 ring-primary" : "ring-transparent hover:bg-primary/5 hover:ring-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-3 right-3 flex size-6 items-center justify-center rounded-md border-2 shadow-md transition-colors",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/30",
                      )}
                      aria-hidden
                    >
                      {isSelected && <CheckIcon className="size-4" />}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Popover with a tag input (free text + suggestions, or pick from a list). */
function TagButton({
  label,
  disabled,
  suggestions,
  pickOnly,
  onSubmit,
}: {
  label: string;
  disabled: boolean;
  suggestions: string[];
  pickOnly?: boolean;
  onSubmit: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const submit = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    onSubmit(t);
    setValue("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" disabled={disabled} />}>
        <TagIcon />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-2 rounded-xl p-3 shadow-xl shadow-primary/20">
        {!pickOnly && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
          >
            <Input autoFocus placeholder="Tag name" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Tag name" />
            <Button type="submit" size="sm" disabled={!value.trim()}>
              Add
            </Button>
          </form>
        )}
        {suggestions.length > 0 && (
          <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {suggestions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => submit(t)}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
