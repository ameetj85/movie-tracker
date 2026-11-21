"use client";

import { AlertTriangleIcon, Link2OffIcon, Loader2Icon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { Poster } from "@/components/poster";
import { TmdbSearch } from "@/components/tmdb-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { MovieWithCopies } from "@/db/schema";
import type { MovieFormState } from "@/lib/actions";
import {
  CONDITIONS,
  EDITION_SUGGESTIONS,
  FORMATS,
  WATCH_STATUS_LABELS,
  WATCH_STATUSES,
  type WatchStatus,
} from "@/lib/constants";
import type { TmdbMovieDetails } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import type { FieldErrors, MovieFormValues } from "@/lib/validation";

type CopyValues = MovieFormValues["copies"][number];

const emptyCopy = (format = ""): CopyValues => ({
  format,
  edition: "",
  purchaseDate: "",
  price: "",
  condition: "",
});

function toFormValues(movie?: MovieWithCopies): MovieFormValues {
  if (!movie) {
    return {
      tmdbId: null,
      title: "",
      releaseYear: "",
      director: "",
      cast: "",
      genres: "",
      posterUrl: "",
      synopsis: "",
      runtime: "",
      isWishlist: false,
      watchStatus: "unwatched",
      rating: "",
      notes: "",
      copies: [emptyCopy()],
    };
  }
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    releaseYear: movie.releaseYear?.toString() ?? "",
    director: movie.director ?? "",
    cast: movie.cast ?? "",
    genres: movie.genres?.join(", ") ?? "",
    posterUrl: movie.posterUrl ?? "",
    synopsis: movie.synopsis ?? "",
    runtime: movie.runtime?.toString() ?? "",
    isWishlist: movie.isWishlist,
    watchStatus: movie.watchStatus,
    rating: movie.rating?.toString() ?? "",
    notes: movie.notes ?? "",
    copies: movie.copies.map((c) => ({
      format: c.format,
      edition: c.edition ?? "",
      purchaseDate: c.purchaseDate ?? "",
      price: c.priceCents == null ? "" : (c.priceCents / 100).toFixed(2),
      condition: c.condition ?? "",
    })),
  };
}

type MovieFormProps = {
  action: (state: MovieFormState, formData: FormData) => Promise<MovieFormState>;
  movie?: MovieWithCopies;
  submitLabel: string;
  cancelHref: string;
  /** Whether TMDB credentials are configured on the server. */
  tmdbEnabled: boolean;
};

const formatItems = Object.fromEntries(FORMATS.map((f) => [f, f]));
const conditionItems = Object.fromEntries(CONDITIONS.map((c) => [c, c]));
const ratingItems = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [String(10 - i), `${10 - i} / 10`]),
);

export function MovieForm({ action, movie, submitLabel, cancelHref, tmdbEnabled }: MovieFormProps) {
  const [values, setValues] = useState<MovieFormValues>(() => toFormValues(movie));
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // Adding: show TMDB search up front. Editing: behind a button.
  const [showTmdb, setShowTmdb] = useState(!movie);
  const editionListId = useId();

  const errors: FieldErrors = state.status === "error" ? state.fieldErrors : {};

  function set<K extends keyof MovieFormValues>(key: K, value: MovieFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  /** Overwrite metadata from TMDB; ownership and personal fields are kept. */
  function applyTmdb(d: TmdbMovieDetails) {
    setValues((v) => ({
      ...v,
      tmdbId: d.tmdbId,
      title: d.title,
      releaseYear: d.releaseYear?.toString() ?? "",
      director: d.director ?? "",
      cast: d.cast ?? "",
      genres: d.genres.join(", "),
      synopsis: d.synopsis ?? "",
      runtime: d.runtime?.toString() ?? "",
      posterUrl: d.posterUrl ?? "",
    }));
    setShowTmdb(false);
    toast.success(`Filled in details for "${d.title}"`);
  }

  function setCopy(index: number, patch: Partial<CopyValues>) {
    setValues((v) => ({
      ...v,
      copies: v.copies.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <input type="hidden" name="payload" value={JSON.stringify(values)} />

      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <Poster src={values.posterUrl.trim() || null} title={values.title || "Untitled"} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Couldn&apos;t save</AlertTitle>
            <AlertDescription>{errors._form ?? errors.copies ?? state.message}</AlertDescription>
          </Alert>
        )}

        {state.status === "duplicate" && (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>Possible duplicate</AlertTitle>
            <AlertDescription>
              <p>You already have this title in the same format:</p>
              <ul className="my-1 list-disc pl-5">
                {state.duplicates.map((d) => (
                  <li key={`${d.movieId}-${d.format}`}>
                    <Link href={`/movies/${d.movieId}`} className="underline underline-offset-2" target="_blank">
                      {d.title}
                      {d.releaseYear ? ` (${d.releaseYear})` : ""}
                    </Link>{" "}
                    — {d.format}
                    {d.isWishlist ? " (wishlist)" : ""}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Button type="submit" name="confirmDuplicate" value="1" size="sm" variant="outline" disabled={pending}>
                  Save anyway
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {tmdbEnabled && (
          <section className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Find on TMDB</h2>
                <p className="text-sm text-muted-foreground">
                  {values.tmdbId
                    ? "Details are linked to The Movie Database."
                    : "Auto-fill the poster, year, genres, cast and synopsis."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {values.tmdbId && (
                  <>
                    <a
                      href={`https://www.themoviedb.org/movie/${values.tmdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      TMDB #{values.tmdbId}
                    </a>
                    <Button type="button" variant="ghost" size="xs" onClick={() => set("tmdbId", null)}>
                      <Link2OffIcon />
                      Unlink
                    </Button>
                  </>
                )}
                {!showTmdb && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowTmdb(true)}>
                    <SearchIcon />
                    {values.tmdbId ? "Search again" : "Search TMDB"}
                  </Button>
                )}
              </div>
            </div>
            {showTmdb && (
              <TmdbSearch onSelect={applyTmdb} initialQuery={movie?.title ?? ""} autoFocus />
            )}
          </section>
        )}

        <Section title="Details">
          <Field label="Title" htmlFor="title" error={errors.title} required className="sm:col-span-2">
            <Input
              id="title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              aria-invalid={!!errors.title}
              autoFocus={!movie && !tmdbEnabled}
              required
            />
          </Field>
          <Field label="Release year" htmlFor="releaseYear" error={errors.releaseYear}>
            <Input
              id="releaseYear"
              inputMode="numeric"
              placeholder="e.g. 1999"
              value={values.releaseYear}
              onChange={(e) => set("releaseYear", e.target.value)}
              aria-invalid={!!errors.releaseYear}
            />
          </Field>
          <Field label="Runtime (minutes)" htmlFor="runtime" error={errors.runtime}>
            <Input
              id="runtime"
              inputMode="numeric"
              value={values.runtime}
              onChange={(e) => set("runtime", e.target.value)}
              aria-invalid={!!errors.runtime}
            />
          </Field>
          <Field label="Director" htmlFor="director" error={errors.director}>
            <Input id="director" value={values.director} onChange={(e) => set("director", e.target.value)} />
          </Field>
          <Field label="Genres" htmlFor="genres" error={errors.genres} hint="Comma-separated">
            <Input
              id="genres"
              placeholder="Action, Sci-Fi"
              value={values.genres}
              onChange={(e) => set("genres", e.target.value)}
            />
          </Field>
          <Field label="Cast" htmlFor="cast" error={errors.cast} hint="Comma-separated" className="sm:col-span-2">
            <Input id="cast" value={values.cast} onChange={(e) => set("cast", e.target.value)} />
          </Field>
          <Field
            label="Poster URL"
            htmlFor="posterUrl"
            error={errors.posterUrl}
            hint="Saved locally for offline use"
            className="sm:col-span-2"
          >
            <Input
              id="posterUrl"
              inputMode="url"
              placeholder="https://…"
              value={values.posterUrl}
              onChange={(e) => set("posterUrl", e.target.value)}
              aria-invalid={!!errors.posterUrl}
            />
          </Field>
          <Field label="Synopsis" htmlFor="synopsis" error={errors.synopsis} className="sm:col-span-2">
            <Textarea
              id="synopsis"
              rows={3}
              value={values.synopsis}
              onChange={(e) => set("synopsis", e.target.value)}
            />
          </Field>
        </Section>

        <Separator />

        <Section
          title="Ownership"
          description={
            values.isWishlist
              ? "Formats you'd like to buy (optional)."
              : "Every format and edition you own of this movie."
          }
        >
          <div className="sm:col-span-2">
            <div role="radiogroup" aria-label="Ownership" className="inline-flex rounded-lg border p-0.5">
              {[
                { label: "Owned", wishlist: false },
                { label: "Wishlist", wishlist: true },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={values.isWishlist === o.wishlist}
                  onClick={() => set("isWishlist", o.wishlist)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    values.isWishlist === o.wishlist
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <datalist id={editionListId}>
            {EDITION_SUGGESTIONS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>

          <div className="flex flex-col gap-3 sm:col-span-2">
            {values.copies.map((copy, i) => (
              <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <div className="-mb-1 flex items-center justify-between sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {values.isWishlist ? "Wanted format" : "Copy"} {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${copy.format || "format"} ${i + 1}`}
                    onClick={() => setValues((v) => ({ ...v, copies: v.copies.filter((_, j) => j !== i) }))}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <Field label="Format" error={errors[`copies.${i}.format`]} required>
                  <Select
                    items={formatItems}
                    value={copy.format || null}
                    onValueChange={(v) => setCopy(i, { format: v ?? "" })}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors[`copies.${i}.format`]}>
                      <SelectValue placeholder="Choose format" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Edition" htmlFor={`edition-${i}`} error={errors[`copies.${i}.edition`]}>
                  <Input
                    id={`edition-${i}`}
                    list={editionListId}
                    placeholder="Standard, Steelbook…"
                    value={copy.edition}
                    onChange={(e) => setCopy(i, { edition: e.target.value })}
                  />
                </Field>
                {!values.isWishlist && (
                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                    <Field label="Purchase date" htmlFor={`purchaseDate-${i}`} error={errors[`copies.${i}.purchaseDate`]}>
                      <Input
                        id={`purchaseDate-${i}`}
                        type="date"
                        value={copy.purchaseDate}
                        onChange={(e) => setCopy(i, { purchaseDate: e.target.value })}
                      />
                    </Field>
                    <Field label="Price paid" htmlFor={`price-${i}`} error={errors[`copies.${i}.price`]}>
                      <Input
                        id={`price-${i}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={copy.price}
                        onChange={(e) => setCopy(i, { price: e.target.value })}
                        aria-invalid={!!errors[`copies.${i}.price`]}
                      />
                    </Field>
                    <Field label="Condition">
                      <Select
                        items={conditionItems}
                        value={copy.condition || null}
                        onValueChange={(v) => setCopy(i, { condition: v ?? "" })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
            ))}

            {errors.copies && <p className="text-sm text-destructive">{errors.copies}</p>}

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValues((v) => ({ ...v, copies: [...v.copies, emptyCopy()] }))}
              >
                <PlusIcon />
                Add format
              </Button>
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="Personal">
          <Field label="Watch status">
            <Select
              items={WATCH_STATUS_LABELS}
              value={values.watchStatus}
              onValueChange={(v) => v && set("watchStatus", v as WatchStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {WATCH_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rating" error={errors.rating}>
            <Select
              items={ratingItems}
              value={values.rating || null}
              onValueChange={(v) => set("rating", v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Not rated" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ratingItems).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {values.rating && (
            <div className="-mt-2 sm:col-span-2">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => set("rating", "")}
              >
                Clear rating
              </button>
            </div>
          )}
          <Field
            label="Notes"
            htmlFor="notes"
            error={errors.notes}
            hint="Thoughts, disc quality, shelf location…"
            className="sm:col-span-2"
          >
            <Textarea id="notes" rows={4} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
        {hint && <span className="font-normal text-muted-foreground">· {hint}</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
