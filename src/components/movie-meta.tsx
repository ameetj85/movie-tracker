import { HandshakeIcon, StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { WATCH_STATUS_LABELS, type WatchStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Marks a movie/copy that's currently lent out. */
export function OnLoanBadge({ to }: { to?: string | null }) {
  return (
    <Badge className="border-transparent bg-amber-400 text-amber-950 shadow-xs" title={to ? `Loaned to ${to}` : "On loan"}>
      <HandshakeIcon data-icon="inline-start" aria-hidden />
      On loan
    </Badge>
  );
}

/** Color + short label per format family, so formats are scannable at a glance. */
function formatStyle(format: string): { className: string; short: string } {
  if (format === "4K UHD")
    return { className: "bg-zinc-900 text-amber-300 dark:bg-amber-300 dark:text-zinc-900", short: "4K" };
  if (format === "Blu-ray") return { className: "bg-blue-600 text-white dark:bg-blue-500", short: "Blu-ray" };
  if (format === "DVD") return { className: "bg-violet-600 text-white dark:bg-violet-500", short: "DVD" };
  if (format === "VHS") return { className: "bg-stone-500 text-white", short: "VHS" };
  if (format.startsWith("Digital"))
    return {
      className: "bg-emerald-600 text-white dark:bg-emerald-500",
      short: format.replace(/^Digital - /, "").split("/")[0],
    };
  if (format === "Local File") return { className: "bg-slate-600 text-white", short: "File" };
  return { className: "", short: format };
}

export function FormatBadge({ format, short }: { format: string; short?: boolean }) {
  const style = formatStyle(format);
  return (
    <Badge className={cn("border-transparent shadow-xs", style.className)} title={format}>
      {short ? style.short : format}
    </Badge>
  );
}

export function FormatBadges({
  formats,
  short,
  className,
}: {
  formats: string[];
  short?: boolean;
  className?: string;
}) {
  const unique = [...new Set(formats)];
  if (unique.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {unique.map((f) => (
        <FormatBadge key={f} format={f} short={short} />
      ))}
    </div>
  );
}

const statusStyles: Record<WatchStatus, string> = {
  watched: "bg-emerald-600 text-white dark:bg-emerald-500",
  in_progress: "bg-amber-500 text-black",
  unwatched: "",
};

export function WatchStatusBadge({ status }: { status: WatchStatus }) {
  return (
    <Badge variant={status === "unwatched" ? "outline" : "default"} className={statusStyles[status]}>
      {WATCH_STATUS_LABELS[status]}
    </Badge>
  );
}

export function Rating({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm font-medium tabular-nums", className)}
      aria-label={`Rated ${value} out of 10`}
    >
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {value}/10
    </span>
  );
}
