"use client";

import { AlertTriangleIcon, Link2OffIcon, Loader2Icon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { BarcodeLookup, type BarcodeHit } from "@/components/barcode-lookup";
import { DatePicker } from "@/components/date-picker";
import { Poster } from "@/components/poster";
import { TmdbSearch } from "@/components/tmdb-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MovieWithCopies } from "@/db/schema";
import type { MovieFormState } from "@/lib/actions";
import {
  CONDITIONS,
  EDITION_SUGGESTIONS,
  FORMATS,
  TAG_SUGGESTIONS_ID,
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
  location: "",
  loanedTo: "",
  loanedOn: "",
  upc: "",
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
      tags: "",
      tmdbCollectionId: null,
      tmdbCollectionName: null,
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
    tags: movie.tags?.join(", ") ?? "",
    tmdbCollectionId: movie.tmdbCollectionId,
    tmdbCollectionName: movie.tmdbCollectionName,
    copies: movie.copies.map((c) => ({
      format: c.format,
      edition: c.edition ?? "",
      purchaseDate: c.purchaseDate ?? "",
      price: c.priceCents == null ? "" : (c.priceCents / 100).toFixed(2),
      condition: c.condition ?? "",
      location: c.location ?? "",
      loanedTo: c.loanedTo ?? "",
      loanedOn: c.loanedOn ?? "",
      upc: c.upc ?? "",
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
  // Field ids are unique per form instance: Next keeps recently visited pages
  // mounted (hidden) for back/forward, so an Add and an Edit form can coexist,
  // and plain ids like "title" would make labels point at the hidden form.
  const formId = useId();
  const fid = (name: string) => `${formId}-${name}`;
  /** What the TMDB search box starts with: the movie's title, or a barcode lookup's. */
  const [tmdbQuery, setTmdbQuery] = useState(movie?.title ?? "");

  /** Barcode found: record it on the first copy, pre-pick its format, and search for the film. */
  function applyBarcode(hit: BarcodeHit) {
    setValues((v) => {
      const [first = emptyCopy(), ...rest] = v.copies;
      return {
        ...v,
        title: !tmdbEnabled && hit.title && !v.title ? hit.title : v.title,
        copies: [{ ...first, upc: hit.upc, format: first.format || hit.format || "" }, ...rest],
      };
    });
    if (hit.title && tmdbEnabled) {
      setTmdbQuery(hit.title);
      setShowTmdb(true);
    }
  }

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
      tmdbCollectionId: d.collection?.id ?? null,
      tmdbCollectionName: d.collection?.name ?? null,
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
        <div className="sticky top-24">
          <Poster
            src={values.posterUrl.trim() || null}
            title={values.title || "Untitled"}
            className="rounded-2xl shadow-xl ring-1 shadow-primary/25 ring-primary/15"
          />
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
          <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-linear-to-br from-violet-500/10 via-card to-fuchsia-500/10 p-5 shadow-md shadow-primary/10">
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
              // Re-mounts (and re-searches) when a barcode lookup supplies a new title.
              <TmdbSearch key={tmdbQuery} onSelect={applyTmdb} initialQuery={tmdbQuery} autoFocus />
            )}
          </section>
        )}

        {!movie && (
          <section className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm shadow-primary/5">
            <div>
              <h2 className="text-base font-semibold">Add by barcode</h2>
              <p className="text-sm text-muted-foreground">
                Type the number under the disc&apos;s barcode{tmdbEnabled ? " and we'll search TMDB for it" : ""}. The
                barcode is saved on the copy.
              </p>
            </div>
            <BarcodeLookup onFound={applyBarcode} />
          </section>
        )}

        <Section title="Details">
          <Field label="Title" htmlFor={fid("title")} error={errors.title} required className="sm:col-span-2">
            <Input
              id={fid("title")}
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              aria-invalid={!!errors.title}
              autoFocus={!movie && !tmdbEnabled}
              required
            />
          </Field>
          <Field label="Release year" htmlFor={fid("releaseYear")} error={errors.releaseYear}>
            <Input
              id={fid("releaseYear")}
              inputMode="numeric"
              placeholder="e.g. 1999"
              value={values.releaseYear}
              onChange={(e) => set("releaseYear", e.target.value)}
              aria-invalid={!!errors.releaseYear}
            />
          </Field>
          <Field label="Runtime (minutes)" htmlFor={fid("runtime")} error={errors.runtime}>
            <Input
              id={fid("runtime")}
              inputMode="numeric"
              value={values.runtime}
              onChange={(e) => set("runtime", e.target.value)}
              aria-invalid={!!errors.runtime}
            />
          </Field>
          <Field label="Director" htmlFor={fid("director")} error={errors.director}>
            <Input id={fid("director")} value={values.director} onChange={(e) => set("director", e.target.value)} />
          </Field>
          <Field label="Genres" htmlFor={fid("genres")} error={errors.genres} hint="Comma-separated">
            <Input
              id={fid("genres")}
              placeholder="Action, Sci-Fi"
              value={values.genres}
              onChange={(e) => set("genres", e.target.value)}
            />
          </Field>
          <Field label="Cast" htmlFor={fid("cast")} error={errors.cast} hint="Comma-separated" className="sm:col-span-2">
            <Input id={fid("cast")} value={values.cast} onChange={(e) => set("cast", e.target.value)} />
          </Field>
          <Field
            label="Poster URL"
            htmlFor={fid("posterUrl")}
            error={errors.posterUrl}
            hint="Saved locally for offline use"
            className="sm:col-span-2"
          >
            <Input
              id={fid("posterUrl")}
              inputMode="url"
              placeholder="https://…"
              value={values.posterUrl}
              onChange={(e) => set("posterUrl", e.target.value)}
              aria-invalid={!!errors.posterUrl}
            />
          </Field>
          <Field label="Synopsis" htmlFor={fid("synopsis")} error={errors.synopsis} className="sm:col-span-2">
            <Textarea
              id={fid("synopsis")}
              rows={3}
              value={values.synopsis}
              onChange={(e) => set("synopsis", e.target.value)}
            />
          </Field>
        </Section>


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
                    "rounded-md px-3 py-1 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    values.isWishlist === o.wishlist
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
              <div
                key={i}
                className="grid gap-3 rounded-xl border border-primary/15 bg-accent/30 p-3 transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/10 sm:grid-cols-2"
              >
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
                <Field label="Format" htmlFor={fid(`format-${i}`)} error={errors[`copies.${i}.format`]} required>
                  <Select
                    items={formatItems}
                    value={copy.format || null}
                    onValueChange={(v) => setCopy(i, { format: v ?? "" })}
                  >
                    <SelectTrigger id={fid(`format-${i}`)} className="w-full" aria-invalid={!!errors[`copies.${i}.format`]}>
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
                <div className="grid min-w-0 gap-3 sm:grid-cols-[3fr_2fr]">
                  <Field label="Edition" htmlFor={fid(`edition-${i}`)} error={errors[`copies.${i}.edition`]}>
                    <Input
                      id={fid(`edition-${i}`)}
                      list={editionListId}
                      placeholder="Standard, Steelbook…"
                      value={copy.edition}
                      onChange={(e) => setCopy(i, { edition: e.target.value })}
                    />
                  </Field>
                  <Field label="Barcode" htmlFor={fid(`upc-${i}`)} error={errors[`copies.${i}.upc`]}>
                    <Input
                      id={fid(`upc-${i}`)}
                      inputMode="numeric"
                      placeholder="UPC"
                      value={copy.upc ?? ""}
                      onChange={(e) => setCopy(i, { upc: e.target.value })}
                      aria-invalid={!!errors[`copies.${i}.upc`]}
                    />
                  </Field>
                </div>
                {!values.isWishlist && (
                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                    <Field label="Purchase date" htmlFor={fid(`purchaseDate-${i}`)} error={errors[`copies.${i}.purchaseDate`]}>
                      <DatePicker
                        id={fid(`purchaseDate-${i}`)}
                        value={copy.purchaseDate}
                        onChange={(v) => setCopy(i, { purchaseDate: v })}
                        aria-invalid={!!errors[`copies.${i}.purchaseDate`]}
                      />
                    </Field>
                    <Field label="Price paid" htmlFor={fid(`price-${i}`)} error={errors[`copies.${i}.price`]}>
                      <Input
                        id={fid(`price-${i}`)}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={copy.price}
                        onChange={(e) => setCopy(i, { price: e.target.value })}
                        aria-invalid={!!errors[`copies.${i}.price`]}
                      />
                    </Field>
                    <Field label="Condition" htmlFor={fid(`condition-${i}`)}>
                      <Select
                        items={conditionItems}
                        value={copy.condition || null}
                        onValueChange={(v) => setCopy(i, { condition: v ?? "" })}
                      >
                        <SelectTrigger id={fid(`condition-${i}`)} className="w-full">
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
                    <Field label="Location" htmlFor={fid(`location-${i}`)} error={errors[`copies.${i}.location`]}>
                      <Input
                        id={fid(`location-${i}`)}
                        placeholder="e.g. Shelf B3"
                        value={copy.location ?? ""}
                        onChange={(e) => setCopy(i, { location: e.target.value })}
                      />
                    </Field>
                    <Field label="Loaned to" htmlFor={fid(`loanedTo-${i}`)} error={errors[`copies.${i}.loanedTo`]}>
                      <Input
                        id={fid(`loanedTo-${i}`)}
                        placeholder="Who has it?"
                        value={copy.loanedTo ?? ""}
                        onChange={(e) => setCopy(i, { loanedTo: e.target.value })}
                      />
                    </Field>
                    <Field label="Loaned on" htmlFor={fid(`loanedOn-${i}`)} error={errors[`copies.${i}.loanedOn`]}>
                      <DatePicker
                        id={fid(`loanedOn-${i}`)}
                        value={copy.loanedTo?.trim() ? (copy.loanedOn ?? "") : ""}
                        onChange={(v) => setCopy(i, { loanedOn: v })}
                        placeholder={copy.loanedTo?.trim() ? "Pick a date" : "Not on loan"}
                        disabled={!copy.loanedTo?.trim()}
                      />
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


        <Section title="Personal">
          <Field label="Watch status" htmlFor={fid("watchStatus")}>
            <Select
              items={WATCH_STATUS_LABELS}
              value={values.watchStatus}
              onValueChange={(v) => v && set("watchStatus", v as WatchStatus)}
            >
              <SelectTrigger id={fid("watchStatus")} className="w-full">
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
          <Field label="Rating" htmlFor={fid("rating")} error={errors.rating}>
            <Select
              items={ratingItems}
              value={values.rating || null}
              onValueChange={(v) => set("rating", v ?? "")}
            >
              <SelectTrigger id={fid("rating")} className="w-full">
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
          <Field label="Tags" htmlFor={fid("tags")} error={errors.tags} hint="Comma-separated, e.g. Christmas, Kids" className="sm:col-span-2">
            <Input
              id={fid("tags")}
              list={TAG_SUGGESTIONS_ID}
              placeholder="Date night, Christmas…"
              value={values.tags ?? ""}
              onChange={(e) => set("tags", e.target.value)}
            />
          </Field>
          <Field
            label="Notes"
            htmlFor={fid("notes")}
            error={errors.notes}
            hint="Thoughts, disc quality…"
            className="sm:col-span-2"
          >
            <Textarea id={fid("notes")} rows={4} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t border-primary/10 pt-6 sm:flex-row sm:justify-end">
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
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-card p-5 shadow-sm shadow-primary/5 transition-shadow duration-300 focus-within:shadow-lg focus-within:shadow-primary/10 hover:shadow-md hover:shadow-primary/10">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="h-4 w-1 rounded-full bg-linear-to-b from-violet-500 to-fuchsia-500" aria-hidden />
          {title}
        </h2>
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
