"use client";

import { LayoutGridIcon, ListIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIGITAL_FILTER, SORTS, type CollectionQuery } from "@/lib/collection-params";
import { FORMATS, WATCH_STATUS_LABELS, WATCH_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  query: CollectionQuery;
  options: { genres: string[]; decades: number[]; formats: string[] };
};

const ALL = "__all";

export function FilterBar({ query, options }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === ALL) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Keep a selected value visible even if it no longer exists in the data.
  const formats = FORMATS.filter((f) => options.formats.includes(f) || f === query.format);
  const hasDigital = formats.some((f) => f.startsWith("Digital"));
  const genres = query.genre && !options.genres.includes(query.genre) ? [query.genre, ...options.genres] : options.genres;
  const decades =
    query.decade && !options.decades.includes(query.decade) ? [query.decade, ...options.decades] : options.decades;

  const formatItems: Record<string, string> = {
    [ALL]: "All formats",
    [DIGITAL_FILTER]: "Any digital",
    ...Object.fromEntries(formats.map((f) => [f, f])),
  };
  const genreItems: Record<string, string> = { [ALL]: "All genres", ...Object.fromEntries(genres.map((g) => [g, g])) };
  const statusItems: Record<string, string> = { [ALL]: "Any status", ...WATCH_STATUS_LABELS };
  const decadeItems: Record<string, string> = {
    [ALL]: "Any decade",
    ...Object.fromEntries(decades.map((d) => [String(d), `${d}s`])),
  };

  const active = Boolean(query.format || query.genre || query.status || query.decade);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-70")}
      aria-busy={pending}
    >
      <FilterSelect
        label="Format"
        items={formatItems}
        value={query.format ?? ALL}
        onChange={(v) => update({ format: v })}
        active={!!query.format}
      >
        <SelectItem value={ALL}>All formats</SelectItem>
        {hasDigital && <SelectItem value={DIGITAL_FILTER}>Any digital</SelectItem>}
        {formats.length > 0 && <SelectSeparator />}
        {formats.map((f) => (
          <SelectItem key={f} value={f}>
            {f}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Genre"
        items={genreItems}
        value={query.genre ?? ALL}
        onChange={(v) => update({ genre: v })}
        active={!!query.genre}
      >
        <SelectItem value={ALL}>All genres</SelectItem>
        {genres.length > 0 && <SelectSeparator />}
        {genres.map((g) => (
          <SelectItem key={g} value={g}>
            {g}
          </SelectItem>
        ))}
      </FilterSelect>

      {query.view === "owned" && (
        <FilterSelect
          label="Watch status"
          items={statusItems}
          value={query.status ?? ALL}
          onChange={(v) => update({ status: v })}
          active={!!query.status}
        >
          <SelectItem value={ALL}>Any status</SelectItem>
          <SelectSeparator />
          {WATCH_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {WATCH_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </FilterSelect>
      )}

      <FilterSelect
        label="Decade"
        items={decadeItems}
        value={query.decade ? String(query.decade) : ALL}
        onChange={(v) => update({ decade: v })}
        active={!!query.decade}
      >
        <SelectItem value={ALL}>Any decade</SelectItem>
        {decades.length > 0 && <SelectSeparator />}
        {decades.map((d) => (
          <SelectItem key={d} value={String(d)}>
            {d}s
          </SelectItem>
        ))}
      </FilterSelect>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update({ format: null, genre: null, status: null, decade: null })}
        >
          <XIcon />
          Clear filters
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <FilterSelect
          label="Sort by"
          items={SORTS}
          value={query.sort}
          onChange={(v) => update({ sort: v === "title" ? null : v })}
        >
          {Object.entries(SORTS).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </FilterSelect>

        <div role="radiogroup" aria-label="Layout" className="inline-flex rounded-lg border p-0.5">
          {(
            [
              { value: "grid", label: "Grid view", Icon: LayoutGridIcon },
              { value: "list", label: "List view", Icon: ListIcon },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={query.layout === value}
              aria-label={label}
              title={label}
              onClick={() => update({ layout: value === "grid" ? null : value })}
              className={cn(
                "rounded-md p-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                query.layout === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
  active,
  children,
}: {
  label: string;
  items: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v != null && onChange(v)}>
      <SelectTrigger size="sm" aria-label={label} className={cn(active && "border-primary bg-primary/5 font-medium")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
