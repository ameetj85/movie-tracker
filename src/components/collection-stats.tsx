import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { CURRENCY } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
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
  const maxFormat = s.formats[0]?.count ?? 0;

  return (
    <section aria-label="Collection stats" className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid grid-cols-3 gap-3">
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
        <StatTile
          label="Total spent"
          value={s.pricedCopies ? compactPrice(s.spentCents) : "—"}
          detail={
            s.pricedCopies
              ? `${nf.format(s.pricedCopies)} of ${nf.format(s.ownedCopies)} copies priced`
              : "Add prices to track"
          }
          title={s.pricedCopies ? formatPrice(s.spentCents) ?? undefined : undefined}
        />
      </div>

      <div className="rounded-xl border p-3">
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">Copies by format</h2>
        {s.formats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No formats recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {s.formats.map((f) => {
              const share = Math.round((f.count / s.ownedCopies) * 100);
              return (
                <li
                  key={f.format}
                  className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs"
                  title={`${f.format}: ${nf.format(f.count)} ${f.count === 1 ? "copy" : "copies"} (${share}%)`}
                >
                  <span className="truncate">{f.format}</span>
                  <span className="h-2 min-w-0" aria-hidden>
                    <span
                      className="block h-full rounded-r-[4px] bg-chart-bar"
                      style={{ width: `${Math.max((f.count / maxFormat) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {nf.format(f.count)}
                    <span className="sr-only"> copies, {share}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const wholeCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Stat-tile value: $1,284 / $12.9K. The exact amount is in the tile's title. */
function compactPrice(cents: number): string {
  const dollars = cents / 100;
  return (dollars >= 10_000 ? compactCurrency : wholeCurrency).format(dollars);
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
    <div className={cn("flex min-w-0 flex-col rounded-xl border p-3", className)} title={title}>
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
      {children}
    </div>
  );
}

export function CollectionStatsSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[92px] rounded-xl" />
    </div>
  );
}
