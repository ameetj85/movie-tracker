import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { getCollectionStats } from "@/lib/queries";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");

/**
 * Dashboard header: KPI tiles + owned copies per format as ranked bars
 * (one hue — the bars compare magnitude; format identity is the row label).
 */
export async function CollectionStats() {
  // DB reads must happen per request, not get baked into the prerendered shell.
  await connection();
  const s = await getCollectionStats();
  if (s.owned === 0) return null;

  const watchedPct = Math.round((s.watched / s.owned) * 100);
  // `formats` arrives sorted by copy count, highest first.
  const topFormats = s.formats.slice(0, 5);
  const otherFormats = s.formats.length - topFormats.length;
  const maxFormat = topFormats[0]?.count ?? 0;

  return (
    <section aria-label="Collection stats" className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <StatTile
        label="Movies owned"
        value={nf.format(s.owned)}
        detail={`${nf.format(s.ownedCopies)} ${s.ownedCopies === 1 ? "copy" : "copies"}`}
      />
      <StatTile
        label="Watched"
        value={`${watchedPct}%`}
        detail={`${nf.format(s.watched)} of ${nf.format(s.owned)}${s.inProgress ? ` · ${s.inProgress} in progress` : ""}`}
      >
        <div
          role="meter"
          aria-label="Share of owned movies watched"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={watchedPct}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-chart-track"
        >
          <div className="h-full rounded-full bg-chart-bar" style={{ width: `${watchedPct}%` }} />
        </div>
      </StatTile>
      <TileFrame className="col-span-2 md:col-span-1">
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">Top formats</h2>
        {topFormats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No formats recorded.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {topFormats.map((f) => {
              const share = Math.round((f.count / s.ownedCopies) * 100);
              return (
                <li
                  key={f.format}
                  className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-2 text-xs"
                  title={`${f.format}: ${nf.format(f.count)} ${f.count === 1 ? "copy" : "copies"} (${share}%)`}
                >
                  <span className="truncate">{f.format}</span>
                  <span className="h-2 min-w-0" aria-hidden>
                    <span
                      className="block h-full rounded-r-[4px] bg-chart-bar"
                      style={{ width: `${Math.max((f.count / maxFormat) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {nf.format(f.count)}
                    <span className="sr-only"> copies, {share}%</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {otherFormats > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            + {otherFormats} more format{otherFormats === 1 ? "" : "s"}
          </p>
        )}
      </TileFrame>
    </section>
  );
}

/** Shared card chrome for every stat tile. */
function TileFrame({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card p-3 shadow-sm shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/15",
        // Thin violet → fuchsia accent along the top edge.
        "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-linear-to-r before:from-violet-500 before:to-fuchsia-500",
        className,
      )}
      title={title}
    >
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
  title,
  className,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <TileFrame className={className} title={title}>
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight text-primary">{value}</span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
      {children}
    </TileFrame>
  );
}

export function CollectionStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="col-span-2 h-32 rounded-2xl md:col-span-1" />
    </div>
  );
}
